import {
  ESTIMATED_PER_GUEST_BANDS,
  EVENT_TEMPLATES,
  getDefaultIdeas,
  inferCityTier,
} from './templates';
import {
  BudgetLine,
  BudgetLineDiff,
  BudgetTier,
  CityTier,
  EventBrief,
  EventFunction,
  EventState,
  EventTask,
  EventType,
  EventVendor,
  HealthDeduction,
  HealthReport,
  InvariantViolation,
  PlanDiff,
  RiskItem,
  TaskDiff,
  TypedOp,
  ValidationResult,
  VendorDiff,
} from './types';

// ============================================================================
// 1. ISO Date Utilities (Asia/Kolkata Calendar-Safe Math, No Naive Datetimes)
// ============================================================================

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(d: string): boolean {
  if (!ISO_DATE_RE.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === day
  );
}

export function toEpochDays(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function fromEpochDays(days: number): string {
  const dt = new Date(days * 86400000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(isoDate: string, deltaDays: number): string {
  return fromEpochDays(toEpochDays(isoDate) + Math.round(deltaDays));
}

export function diffDays(fromIso: string, toIso: string): number {
  return toEpochDays(toIso) - toEpochDays(fromIso);
}

export function getTodayKolkata(): string {
  // Deterministic fallback or current date in Asia/Kolkata
  return '2026-11-01';
}

export function sanitizeText(input: string, maxLen = 400): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

// ============================================================================
// 2. Budget Baseline & Proportional Rescaling Engine (I1, I2, I6)
// ============================================================================

export function buildBaselineBudget(
  type: EventType,
  totalBudget: number,
  _cityTier: CityTier,
  _tier: BudgetTier
): BudgetLine[] {
  const total = Math.max(10000, Math.round(totalBudget));
  const templates = EVENT_TEMPLATES[type];
  const lines: BudgetLine[] = [];
  let runningSum = 0;

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const planned = Math.round((total * t.pct) / 100);
    runningSum += planned;
    const isContingency = t.category === 'Contingency';
    // Floor is 5% of total for Contingency, or 30% of baseline planned for other lines
    const floor = isContingency
      ? Math.ceil(total * 0.05)
      : Math.max(500, Math.round(planned * 0.25));

    lines.push({
      category: t.category,
      planned,
      actual: 0,
      locked: false,
      floor,
      templatePct: t.pct,
    });
  }

  // Fix rounding drift on the largest unlocked non-contingency line (I1)
  const drift = total - runningSum;
  if (drift !== 0) {
    let largestIdx = 0;
    for (let i = 1; i < lines.length; i++) {
      if (
        lines[i].category !== 'Contingency' &&
        lines[i].planned > lines[largestIdx].planned
      ) {
        largestIdx = i;
      }
    }
    lines[largestIdx].planned += drift;
  }

  // Ensure Contingency >= ceil(total * 0.05) (I2)
  const contIdx = lines.findIndex((l) => l.category === 'Contingency');
  if (contIdx !== -1) {
    const minCont = Math.ceil(total * 0.05);
    if (lines[contIdx].planned < minCont) {
      const needed = minCont - lines[contIdx].planned;
      lines[contIdx].planned += needed;
      const donorIdx = lines.findIndex(
        (l, idx) => idx !== contIdx && !l.locked && l.planned - needed >= l.floor
      );
      if (donorIdx !== -1) {
        lines[donorIdx].planned -= needed;
      }
    }
  }

  return lines;
}

export interface RescaleResult {
  feasible: boolean;
  minFeasibleTotal: number;
  lines: BudgetLine[];
  reason?: string;
}

export function rescaleBudget(
  currentLines: BudgetLine[],
  newTotalRaw: number
): RescaleResult {
  const newTotal = Math.round(newTotalRaw);
  const cloned = currentLines.map((l) => ({ ...l }));

  // Update contingency floor to at least 5% of newTotal (I2)
  const minContingency = Math.ceil(newTotal * 0.05);
  for (const line of cloned) {
    if (line.category === 'Contingency') {
      line.floor = Math.max(500, minContingency);
    } else if (!line.locked) {
      // Dynamic floor scales gently so reasonable budget cuts remain feasible unless locked
      line.floor = Math.min(
        line.floor,
        Math.max(500, Math.floor((newTotal * line.templatePct * 0.25) / 100))
      );
    }
  }

  const lockedSum = cloned
    .filter((l) => l.locked)
    .reduce((acc, l) => acc + l.planned, 0);

  const unlockedLines = cloned.filter((l) => !l.locked);
  const unlockedFloorSum = unlockedLines.reduce((acc, l) => acc + l.floor, 0);
  const minFeasibleTotal = lockedSum + unlockedFloorSum;

  if (newTotal < minFeasibleTotal || unlockedLines.length === 0) {
    return {
      feasible: false,
      minFeasibleTotal,
      lines: currentLines,
      reason:
        unlockedLines.length === 0
          ? 'All budget categories are locked; unlock at least one category to rescale.'
          : `Target budget ₹${newTotal.toLocaleString('en-IN')} is below minimum feasible ₹${minFeasibleTotal.toLocaleString('en-IN')} due to locked categories (₹${lockedSum.toLocaleString('en-IN')}) and category/contingency floors.`,
    };
  }

  // Ensure locked Contingency still meets 5% of newTotal
  const contLine = cloned.find((l) => l.category === 'Contingency');
  if (contLine && contLine.locked && contLine.planned < minContingency) {
    return {
      feasible: false,
      minFeasibleTotal: Math.floor(contLine.planned / 0.05),
      lines: currentLines,
      reason: `Locked Contingency (₹${contLine.planned.toLocaleString('en-IN')}) would fall below 5% of ₹${newTotal.toLocaleString('en-IN')}.`,
    };
  }

  const currentSum = cloned.reduce((acc, l) => acc + l.planned, 0);
  if (
    currentSum === newTotal &&
    cloned.every((l) => l.planned >= l.floor) &&
    (!contLine || contLine.planned >= minContingency)
  ) {
    return {
      feasible: true,
      minFeasibleTotal,
      lines: cloned,
    };
  }

  const remainingForUnlocked = newTotal - lockedSum;
  const extraAboveFloors = remainingForUnlocked - unlockedFloorSum;

  const totalUnlockedWeight = unlockedLines.reduce(
    (acc, l) => acc + Math.max(1, l.templatePct),
    0
  );

  let allocatedUnlocked = 0;
  for (const line of unlockedLines) {
    const weight = Math.max(1, line.templatePct) / totalUnlockedWeight;
    const allocation = line.floor + Math.floor(extraAboveFloors * weight);
    line.planned = allocation;
    allocatedUnlocked += allocation;
  }

  // Distribute exact integer rupee remainder to largest unlocked line (or Contingency if needed)
  let drift = remainingForUnlocked - allocatedUnlocked;
  if (drift !== 0) {
    const sortedUnlocked = [...unlockedLines].sort(
      (a, b) => b.planned - a.planned
    );
    const receiver = sortedUnlocked[0];
    if (receiver) {
      receiver.planned += drift;
    }
  }

  // Final check on I2: Contingency >= 5% of newTotal
  if (contLine && !contLine.locked && contLine.planned < minContingency) {
    const deficit = minContingency - contLine.planned;
    contLine.planned += deficit;
    // Subtract deficit from largest other unlocked line above floor
    const candidates = unlockedLines
      .filter((l) => l.category !== 'Contingency' && l.planned - l.floor >= deficit)
      .sort((a, b) => b.planned - a.planned);
    if (candidates.length > 0) {
      candidates[0].planned -= deficit;
    }
  }

  return {
    feasible: true,
    minFeasibleTotal,
    lines: cloned,
  };
}

// ============================================================================
// 3. Backward Timeline & Critical Path Engine (I3, I4, I5)
// ============================================================================

export function buildBaselineTimeline(
  type: EventType,
  today: string,
  eventDate: string
): { tasks: EventTask[]; risks: RiskItem[] } {
  const templates = EVENT_TEMPLATES[type];
  const categoryToTaskId: Record<string, string> = {};

  templates.forEach((t, idx) => {
    categoryToTaskId[t.category] = `tsk-${type.slice(0, 3)}-${idx + 1}`;
  });

  const rawTasks: EventTask[] = templates.map((t, idx) => {
    const id = `tsk-${type.slice(0, 3)}-${idx + 1}`;
    const depends_on = t.dependsOnCategories
      .map((c) => categoryToTaskId[c])
      .filter(Boolean);
    const idealDue = addDays(eventDate, -t.defaultLeadDays);
    const idealStart = addDays(idealDue, -t.defaultDurationDays);

    return {
      id,
      title: t.defaultTaskTitle,
      category: t.category,
      start: idealStart,
      due: idealDue,
      duration_days: t.defaultDurationDays,
      depends_on,
      owner: t.defaultOwner,
      status: 'todo',
      critical: false,
      lead_time_days: t.defaultLeadDays,
      template_id:
        type === 'wedding'
          ? 'TPL-WED-01'
          : type === 'birthday'
            ? 'TPL-BIR-03'
            : 'TPL-COM-01',
    };
  });

  return scheduleTimeline(rawTasks, today, eventDate);
}

export function scheduleTimeline(
  inputTasks: EventTask[],
  today: string,
  eventDate: string
): { tasks: EventTask[]; risks: RiskItem[] } {
  const tasks = inputTasks.map((t) => ({
    ...t,
    depends_on: [...t.depends_on],
  }));
  const byId = new Map<string, EventTask>();
  tasks.forEach((t) => byId.set(t.id, t));

  // Topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  const dependentsMap = new Map<string, string[]>();
  tasks.forEach((t) => {
    inDegree.set(t.id, 0);
    dependentsMap.set(t.id, []);
  });

  for (const t of tasks) {
    for (const depId of t.depends_on) {
      if (byId.has(depId)) {
        inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
        dependentsMap.get(depId)?.push(t.id);
      }
    }
  }

  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    topoOrder.push(curr);
    for (const nextId of dependentsMap.get(curr) ?? []) {
      const nextDeg = (inDegree.get(nextId) ?? 1) - 1;
      inDegree.set(nextId, nextDeg);
      if (nextDeg === 0) queue.push(nextId);
    }
  }

  // If graph is acyclic, enforce I3 (open task due in [today, eventDate]) and I5 (dep.due <= dependent.start)
  const risks: RiskItem[] = [];
  const compressedTaskIds: string[] = [];

  if (topoOrder.length === tasks.length) {
    const totalWindowDays = Math.max(1, diffDays(today, eventDate));

    // Forward pass from roots to ensure dependencies finish on or before dependent starts
    // and open tasks have due >= today and due <= eventDate
    for (const id of topoOrder) {
      const t = byId.get(id)!;
      if (t.status === 'done') continue;

      let duration = Math.max(1, t.duration_days);
      // Ideal backward due date from lead_time_days if not manually overridden
      let earliestStart = today;

      for (const depId of t.depends_on) {
        const dep = byId.get(depId);
        if (dep && toEpochDays(dep.due) > toEpochDays(earliestStart)) {
          earliestStart = dep.due;
        }
      }

      // If ideal start is before earliestStart (or before today), task is compressed!
      if (toEpochDays(t.start) < toEpochDays(earliestStart)) {
        compressedTaskIds.push(t.id);
        t.start = earliestStart;
        // Compress duration if needed so it fits before eventDate
        const maxAvailableDuration = Math.max(
          1,
          Math.floor(diffDays(t.start, eventDate) * 0.6)
        );
        duration = Math.min(duration, maxAvailableDuration);
        t.duration_days = duration;
        t.due = addDays(t.start, duration);
      }

      // Clamp due date into [today, eventDate] to satisfy I3
      if (toEpochDays(t.due) < toEpochDays(today)) {
        compressedTaskIds.push(t.id);
        t.start = today;
        t.due = addDays(today, Math.min(duration, Math.max(1, totalWindowDays - 1)));
      }
      if (toEpochDays(t.due) > toEpochDays(eventDate)) {
        t.due = eventDate;
        t.start = addDays(t.due, -Math.min(duration, Math.max(1, diffDays(today, t.due))));
      }
      if (toEpochDays(t.start) > toEpochDays(t.due)) {
        t.start = t.due;
      }
    }

    // Second pass: strictly verify I5 (dep.due <= dependent.start)
    for (const id of topoOrder) {
      const t = byId.get(id)!;
      let maxDepDue = t.start;
      for (const depId of t.depends_on) {
        const dep = byId.get(depId);
        if (dep && toEpochDays(dep.due) > toEpochDays(maxDepDue)) {
          maxDepDue = dep.due;
        }
      }
      if (toEpochDays(maxDepDue) > toEpochDays(t.start)) {
        t.start = maxDepDue;
        if (toEpochDays(t.due) < toEpochDays(t.start)) {
          t.due = Math.min(toEpochDays(eventDate), toEpochDays(t.start) + 1) === toEpochDays(eventDate)
            ? eventDate
            : addDays(t.start, 1);
        }
        t.duration_days = Math.max(0, diffDays(t.start, t.due));
      }
    }

    // Critical path calculation (longest chain by duration)
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    for (const id of topoOrder) {
      const t = byId.get(id)!;
      let bestDist = Math.max(1, t.duration_days);
      let bestPrev: string | null = null;
      for (const depId of t.depends_on) {
        const d = (dist.get(depId) ?? 0) + Math.max(1, t.duration_days);
        if (d > bestDist) {
          bestDist = d;
          bestPrev = depId;
        }
      }
      dist.set(id, bestDist);
      prev.set(id, bestPrev);
    }

    let endNode: string | null = null;
    let maxChain = -1;
    dist.forEach((val, id) => {
      if (val > maxChain) {
        maxChain = val;
        endNode = id;
      }
    });

    const criticalSet = new Set<string>();
    let curr: string | null = endNode;
    while (curr) {
      criticalSet.add(curr);
      curr = prev.get(curr) ?? null;
    }

    tasks.forEach((t) => {
      t.critical = criticalSet.has(t.id);
    });
  }

  if (compressedTaskIds.length > 0) {
    const uniqueCompressed = Array.from(new Set(compressedTaskIds));
    risks.push({
      code: 'COMPRESSED_TIMELINE',
      severity: uniqueCompressed.length > 3 ? 'high' : 'medium',
      message: `${uniqueCompressed.length} task(s) had lead times longer than the remaining days until ${eventDate} and were compressed to fit.`,
      affectedIds: uniqueCompressed,
    });
  }

  return { tasks, risks };
}

// ============================================================================
// 4. Plan Health Score (0–100) with Itemized Deductions & One-Tap Fixes (FR-8)
// ============================================================================

export function computeHealth(state: EventState): HealthReport {
  const deductions: HealthDeduction[] = [];

  // 1. Budget per guest vs tier band (max 30 points)
  const perGuest = Math.round(state.budget / Math.max(1, state.guests));
  const band = ESTIMATED_PER_GUEST_BANDS[state.type][state.tier];
  if (perGuest < band.min) {
    const ratio = (band.min - perGuest) / band.min;
    const pts = Math.min(30, Math.max(5, Math.round(ratio * 45)));
    const recommendedBudget = band.min * state.guests;
    deductions.push({
      code: 'BUDGET_PER_GUEST_LOW',
      points: pts,
      why: `₹${perGuest.toLocaleString('en-IN')}/guest is below the estimated ${state.tier} ${state.type} minimum band (₹${band.min.toLocaleString('en-IN')}/guest for ${state.guests} guests).`,
      fix:
        state.tier !== 'lean'
          ? `Switch tier to Lean or raise budget to ₹${recommendedBudget.toLocaleString('en-IN')}`
          : `Raise budget to ₹${recommendedBudget.toLocaleString('en-IN')} or trim guest list to ${Math.floor(state.budget / band.min)}`,
      fixOps:
        state.tier !== 'lean'
          ? [{ op: 'SetTier', tier: 'lean' }]
          : [{ op: 'SetBudget', total: recommendedBudget }],
    });
  }

  // 2. Lead-time risk from compressed or at-risk tasks (max 30 points)
  const daysToEvent = Math.max(1, diffDays(state.today, state.event_date));
  const compressedTasks = state.tasks.filter(
    (t) =>
      t.status !== 'done' &&
      (t.status === 'at_risk' || t.lead_time_days > daysToEvent)
  );
  if (compressedTasks.length > 0) {
    const pts = Math.min(30, compressedTasks.length * 4);
    const firstTask = compressedTasks[0];
    deductions.push({
      code: 'LEAD_TIME_COMPRESSED',
      points: pts,
      why: `${compressedTasks.length} open task(s) have standard lead times exceeding the ${daysToEvent} days remaining until ${state.event_date}.`,
      fix: `Mark "${firstTask.title.slice(0, 36)}..." in-progress/done or push event date out by 30 days`,
      fixOps: [{ op: 'SetStatus', id: firstTask.id, status: 'done' }],
    });
  }

  // 3. Contingency shortfall below 8% comfort buffer (I2 enforces >=5%, health warns if <8%, max 10 pts)
  const contLine = state.lines.find((l) => l.category === 'Contingency');
  const contPct = contLine ? (contLine.planned / state.budget) * 100 : 0;
  if (contPct < 7) {
    const pts = Math.min(10, Math.max(3, Math.round((7 - contPct) * 3)));
    const targetCont = Math.round(state.budget * 0.08);
    deductions.push({
      code: 'CONTINGENCY_LOW',
      points: pts,
      why: `Contingency buffer is ${contPct.toFixed(1)}% (₹${(contLine?.planned ?? 0).toLocaleString('en-IN')}); 8% is recommended for last-minute vendor variations.`,
      fix: `Boost Contingency allocation to 8% (₹${targetCont.toLocaleString('en-IN')})`,
      fixOps: [{ op: 'SetLine', category: 'Contingency', amount: targetCont }],
    });
  }

  // 4. Critical-path slack under 2 days (max 15 points)
  const criticalOpen = state.tasks.filter(
    (t) => t.critical && t.status !== 'done'
  );
  let minSlack = 999;
  for (const t of criticalOpen) {
    const slack = diffDays(t.due, state.event_date);
    if (slack < minSlack) minSlack = slack;
  }
  if (criticalOpen.length > 0 && minSlack < 7) {
    const pts = minSlack <= 2 ? 15 : 8;
    const bottleneck = criticalOpen[criticalOpen.length - 1];
    deductions.push({
      code: 'CRITICAL_PATH_SLACK_TIGHT',
      points: pts,
      why: `Critical-path task "${bottleneck.title}" finishes only ${minSlack} day(s) before ${state.event_date}.`,
      fix: `Pull "${bottleneck.category}" due date 5 days earlier`,
      fixOps: [
        {
          op: 'MoveTask',
          id: bottleneck.id,
          due: addDays(
            bottleneck.due,
            -Math.min(5, Math.max(1, diffDays(state.today, bottleneck.due) - 1))
          ),
        },
      ],
    });
  }

  // 5. Unassigned owners (max 5 points)
  const unassigned = state.tasks.filter(
    (t) => !t.owner || t.owner.trim().toLowerCase() === 'unassigned'
  );
  if (unassigned.length > 0) {
    const pts = Math.min(5, unassigned.length * 2);
    deductions.push({
      code: 'UNASSIGNED_OWNERS',
      points: pts,
      why: `${unassigned.length} task(s) have no assigned owner (${unassigned.map((u) => u.category).join(', ')}).`,
      fix: `Assign "${unassigned[0].title.slice(0, 30)}..." to Coordinator`,
      fixOps: [
        { op: 'AssignTask', id: unassigned[0].id, owner: 'Lead Coordinator' },
      ],
    });
  }

  // 6. Overruns in actuals (max 10 points)
  const overrunLines = state.lines.filter((l) => l.actual > l.planned);
  if (overrunLines.length > 0) {
    const pts = Math.min(10, overrunLines.length * 5);
    const worst = overrunLines[0];
    deductions.push({
      code: 'ACTUALS_OVERRUN',
      points: pts,
      why: `${overrunLines.length} category actual spend exceeds planned budget (${worst.category}: ₹${worst.actual.toLocaleString('en-IN')} vs ₹${worst.planned.toLocaleString('en-IN')}).`,
      fix: `Reallocate planned budget for ${worst.category} to ₹${worst.actual.toLocaleString('en-IN')}`,
      fixOps: [{ op: 'SetLine', category: worst.category, amount: worst.actual }],
    });
  }

  const totalDeductions = deductions.reduce((acc, d) => acc + d.points, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeductions));

  return { score, deductions };
}

// ============================================================================
// 5. Strict Invariant Validator (I1–I10) + Automatic Conflict Repair
// ============================================================================

export function validateEvent(
  candidate: EventState,
  priorState?: EventState
): ValidationResult {
  const violations: InvariantViolation[] = [];
  let repairOps: TypedOp[] | undefined;
  let repairExplanation: string | undefined;

  // I1: Budget lines sum exactly to total budget (integer rupees)
  const isIntBudget = Number.isInteger(candidate.budget) && candidate.budget > 0;
  const lineSum = candidate.lines.reduce((acc, l) => acc + l.planned, 0);
  const allLinesInt = candidate.lines.every(
    (l) => Number.isInteger(l.planned) && l.planned >= 0
  );
  if (!isIntBudget || !allLinesInt || lineSum !== candidate.budget) {
    violations.push({
      code: 'I1_BUDGET_SUM_MISMATCH',
      invariant: 'I1',
      detail: `Budget lines sum to ₹${lineSum.toLocaleString('en-IN')}, which does not equal total budget ₹${candidate.budget.toLocaleString('en-IN')}.`,
      field: 'lines',
    });
  }

  // I2: Contingency >= 5% of budget
  const contLine = candidate.lines.find((l) => l.category === 'Contingency');
  const minContingency = Math.floor(candidate.budget * 0.05);
  if (!contLine || contLine.planned < minContingency) {
    violations.push({
      code: 'I2_CONTINGENCY_BELOW_5_PCT',
      invariant: 'I2',
      detail: `Contingency is ₹${(contLine?.planned ?? 0).toLocaleString('en-IN')}, below the mandatory 5% floor (₹${minContingency.toLocaleString('en-IN')}).`,
      field: 'lines.Contingency',
    });
  }

  // I3: Every open task due date lies between today and event_date
  if (!isValidIsoDate(candidate.today) || !isValidIsoDate(candidate.event_date)) {
    violations.push({
      code: 'I3_TASK_DATE_OUT_OF_RANGE',
      invariant: 'I3',
      detail: 'Event date or today date is not a valid ISO YYYY-MM-DD date.',
      field: 'event_date',
    });
  } else {
    const todayEpoch = toEpochDays(candidate.today);
    const eventEpoch = toEpochDays(candidate.event_date);
    if (eventEpoch < todayEpoch) {
      violations.push({
        code: 'I3_TASK_DATE_OUT_OF_RANGE',
        invariant: 'I3',
        detail: `Event date (${candidate.event_date}) cannot be earlier than today (${candidate.today}).`,
        field: 'event_date',
      });
    }
    for (const t of candidate.tasks) {
      if (!isValidIsoDate(t.due) || !isValidIsoDate(t.start)) {
        violations.push({
          code: 'I3_TASK_DATE_OUT_OF_RANGE',
          invariant: 'I3',
          detail: `Task "${t.title}" has an invalid ISO date (${t.start} -> ${t.due}).`,
          field: `tasks.${t.id}`,
        });
        continue;
      }
      if (t.status !== 'done') {
        const dueEpoch = toEpochDays(t.due);
        if (dueEpoch < todayEpoch || dueEpoch > eventEpoch) {
          violations.push({
            code: 'I3_TASK_DATE_OUT_OF_RANGE',
            invariant: 'I3',
            detail: `Open task "${t.title}" due date (${t.due}) must lie between today (${candidate.today}) and event date (${candidate.event_date}).`,
            field: `tasks.${t.id}.due`,
          });
        }
      }
    }
  }

  // I4: Every dependency id exists and the graph is acyclic
  const taskMap = new Map<string, EventTask>();
  candidate.tasks.forEach((t) => taskMap.set(t.id, t));
  for (const t of candidate.tasks) {
    for (const depId of t.depends_on) {
      if (!taskMap.has(depId)) {
        violations.push({
          code: 'I4_DEPENDENCY_GRAPH_INVALID',
          invariant: 'I4',
          detail: `Task "${t.title}" references non-existent dependency ID "${depId}".`,
          field: `tasks.${t.id}.depends_on`,
        });
      }
    }
  }

  // Cycle check via DFS
  const visitState = new Map<string, 0 | 1 | 2>();
  let hasCycle = false;
  function dfs(nodeId: string) {
    visitState.set(nodeId, 1);
    const node = taskMap.get(nodeId);
    if (node) {
      for (const depId of node.depends_on) {
        if (!taskMap.has(depId)) continue;
        const st = visitState.get(depId) ?? 0;
        if (st === 1) {
          hasCycle = true;
          return;
        }
        if (st === 0) dfs(depId);
      }
    }
    visitState.set(nodeId, 2);
  }
  for (const t of candidate.tasks) {
    if ((visitState.get(t.id) ?? 0) === 0) dfs(t.id);
  }
  if (hasCycle) {
    violations.push({
      code: 'I4_DEPENDENCY_GRAPH_INVALID',
      invariant: 'I4',
      detail: 'Task dependency graph contains a circular dependency cycle.',
      field: 'tasks',
    });
  }

  // I5: A dependency never finishes after its dependent starts (dep.due <= task.start)
  if (!hasCycle) {
    for (const t of candidate.tasks) {
      for (const depId of t.depends_on) {
        const dep = taskMap.get(depId);
        if (
          dep &&
          isValidIsoDate(dep.due) &&
          isValidIsoDate(t.start) &&
          toEpochDays(dep.due) > toEpochDays(t.start)
        ) {
          violations.push({
            code: 'I5_DEPENDENCY_ORDER_VIOLATION',
            invariant: 'I5',
            detail: `Dependency "${dep.title}" finishes on ${dep.due}, which is after dependent task "${t.title}" starts (${t.start}).`,
            field: `tasks.${t.id}`,
          });
          repairOps = [{ op: 'MoveTask', id: t.id, due: addDays(dep.due, Math.max(1, t.duration_days)) }];
          repairExplanation = `Push "${t.title}" due date to ${addDays(dep.due, Math.max(1, t.duration_days))} so it starts after "${dep.title}" finishes.`;
        }
      }
    }
  }

  // I6: Locked budget lines are never changed by automatic rebalancing
  if (priorState) {
    for (const priorLine of priorState.lines) {
      if (priorLine.locked) {
        const nextLine = candidate.lines.find(
          (l) => l.category === priorLine.category
        );
        if (nextLine && nextLine.locked && nextLine.planned !== priorLine.planned) {
          violations.push({
            code: 'I6_LOCKED_LINE_MODIFIED',
            invariant: 'I6',
            detail: `Locked budget category "${priorLine.category}" was modified from ₹${priorLine.planned.toLocaleString('en-IN')} to ₹${nextLine.planned.toLocaleString('en-IN')}.`,
            field: `lines.${priorLine.category}`,
          });
        }
      }
    }
  }

  // I7: Venue capacity >= guest count where the venue declares capacity
  const venueVendors = candidate.vendors.filter(
    (v) =>
      (v.category === 'Venue' || v.category === 'Venue, permits, infrastructure') &&
      v.status !== 'cancelled' &&
      typeof v.capacity === 'number'
  );
  for (const v of venueVendors) {
    if (v.capacity !== undefined && v.capacity < candidate.guests) {
      violations.push({
        code: 'I7_VENUE_CAPACITY_EXCEEDED',
        invariant: 'I7',
        detail: `Selected venue "${v.name}" has a declared maximum capacity of ${v.capacity} guests, which cannot accommodate ${candidate.guests} guests.`,
        field: 'vendors.Venue',
      });
      const upgradedCapacity = Math.ceil(candidate.guests / 50) * 50 + 50;
      const upgradedVenueName =
        candidate.type === 'wedding'
          ? `Jaipur Grand Durbar Lawn & Hall (${upgradedCapacity} pax)`
          : candidate.type === 'birthday'
            ? `Grand Celebration Banquet (${upgradedCapacity} pax)`
            : `Sector Central Mela Maidan (${upgradedCapacity} pax)`;
      repairOps = [
        {
          op: 'SelectVendor',
          category: v.category,
          name: upgradedVenueName,
          capacity: upgradedCapacity,
          quote: Math.round(v.quote * (candidate.guests / Math.max(1, v.capacity))),
        },
        { op: 'SetGuests', n: candidate.guests },
      ];
      repairExplanation = `Switch venue to "${upgradedVenueName}" (capacity ${upgradedCapacity} guests) to accommodate ${candidate.guests} guests while preserving Invariant I7.`;
    }
  }

  // I8: Every task category exists in the event-type template
  const allowedCategories = new Set(
    EVENT_TEMPLATES[candidate.type].map((t) => t.category)
  );
  for (const t of candidate.tasks) {
    if (!allowedCategories.has(t.category)) {
      violations.push({
        code: 'I8_INVALID_TASK_CATEGORY',
        invariant: 'I8',
        detail: `Task "${t.title}" uses category "${t.category}", which is not in the ${candidate.type} template.`,
        field: `tasks.${t.id}.category`,
      });
    }
  }

  // I9: Version number increases by exactly 1 and parent version exists
  if (priorState) {
    if (
      candidate.version !== priorState.version + 1 ||
      candidate.parent_version !== priorState.version
    ) {
      violations.push({
        code: 'I9_VERSION_SEQUENCE_INVALID',
        invariant: 'I9',
        detail: `Candidate version (${candidate.version}, parent ${candidate.parent_version}) must increment prior version (${priorState.version}) by exactly 1.`,
        field: 'version',
      });
    }
  }

  // I10: All text fields are length-bounded and sanitized
  const unsafeRe = /<script/i;
  const hasInvalidTaskText = candidate.tasks.some(
    (t) => t.title.length > 280 || unsafeRe.test(t.title)
  );
  if (
    candidate.brief.title.length > 200 ||
    candidate.brief.vibe.length > 1000 ||
    unsafeRe.test(candidate.brief.title) ||
    unsafeRe.test(candidate.brief.vibe) ||
    hasInvalidTaskText
  ) {
    violations.push({
      code: 'I10_TEXT_BOUNDS_OR_UNSAFE',
      invariant: 'I10',
      detail: 'Event brief or task text exceeds length bounds or contains unsafe script tags.',
      field: 'brief',
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    repairOps,
    repairExplanation,
  };
}

// ============================================================================
// 6. Deterministic Diff & Template Summary Engine (Section 5.3)
// ============================================================================

export function computeDiff(before: EventState, after: EventState): PlanDiff {
  const healthBefore = computeHealth(before).score;
  const healthAfter = computeHealth(after).score;
  const healthDelta = healthAfter - healthBefore;

  const lineChanges: BudgetLineDiff[] = [];
  for (const afterLine of after.lines) {
    const beforeLine = before.lines.find(
      (l) => l.category === afterLine.category
    );
    const prevAmt = beforeLine ? beforeLine.planned : 0;
    if (prevAmt !== afterLine.planned) {
      lineChanges.push({
        category: afterLine.category,
        before: prevAmt,
        after: afterLine.planned,
        delta: afterLine.planned - prevAmt,
        locked: afterLine.locked,
      });
    }
  }

  const taskChanges: TaskDiff[] = [];
  const beforeTaskMap = new Map(before.tasks.map((t) => [t.id, t]));
  const afterTaskMap = new Map(after.tasks.map((t) => [t.id, t]));

  for (const [id, afterTask] of afterTaskMap.entries()) {
    const beforeTask = beforeTaskMap.get(id);
    if (!beforeTask) {
      taskChanges.push({
        id,
        title: afterTask.title,
        change: 'added',
        afterDue: afterTask.due,
        afterStatus: afterTask.status,
        afterOwner: afterTask.owner,
      });
    } else if (beforeTask.due !== afterTask.due) {
      taskChanges.push({
        id,
        title: afterTask.title,
        change: 'moved',
        beforeDue: beforeTask.due,
        afterDue: afterTask.due,
      });
    } else if (beforeTask.status !== afterTask.status) {
      taskChanges.push({
        id,
        title: afterTask.title,
        change: 'status_changed',
        beforeStatus: beforeTask.status,
        afterStatus: afterTask.status,
      });
    } else if (beforeTask.owner !== afterTask.owner) {
      taskChanges.push({
        id,
        title: afterTask.title,
        change: 'owner_changed',
        beforeOwner: beforeTask.owner,
        afterOwner: afterTask.owner,
      });
    }
  }

  for (const [id, beforeTask] of beforeTaskMap.entries()) {
    if (!afterTaskMap.has(id)) {
      taskChanges.push({
        id,
        title: beforeTask.title,
        change: 'removed',
        beforeDue: beforeTask.due,
      });
    }
  }

  const vendorChanges: VendorDiff[] = [];
  for (const afterVendor of after.vendors) {
    const beforeVendor = before.vendors.find(
      (v) => v.category === afterVendor.category
    );
    if (
      beforeVendor &&
      (beforeVendor.name !== afterVendor.name ||
        beforeVendor.status !== afterVendor.status ||
        beforeVendor.capacity !== afterVendor.capacity)
    ) {
      vendorChanges.push({
        category: afterVendor.category,
        beforeName: beforeVendor.name,
        afterName: afterVendor.name,
        beforeStatus: beforeVendor.status,
        afterStatus: afterVendor.status,
        beforeCapacity: beforeVendor.capacity,
        afterCapacity: afterVendor.capacity,
      });
    }
  }

  // Deterministic one-sentence summary generated from diff data (never LLM)
  const parts: string[] = [];
  if (before.budget !== after.budget) {
    const dir = after.budget > before.budget ? 'increased' : 'reduced';
    parts.push(
      `budget ${dir} from ₹${before.budget.toLocaleString('en-IN')} to ₹${after.budget.toLocaleString('en-IN')}`
    );
  }
  if (before.guests !== after.guests) {
    parts.push(`guests updated from ${before.guests} to ${after.guests}`);
  }
  if (before.event_date !== after.event_date) {
    parts.push(`event date shifted from ${before.event_date} to ${after.event_date}`);
  }
  if (lineChanges.length > 0) {
    parts.push(`${lineChanges.length} budget category allocation(s) rebalanced`);
  }
  if (taskChanges.length > 0) {
    parts.push(`${taskChanges.length} timeline task(s) updated`);
  }
  if (vendorChanges.length > 0) {
    parts.push(
      `vendor status updated for ${vendorChanges.map((v) => v.category).join(', ')}`
    );
  }
  const healthSign = healthDelta >= 0 ? `+${healthDelta}` : `${healthDelta}`;
  const summary =
    parts.length > 0
      ? `Version ${after.version}: ${parts.join('; ')} (Health ${healthBefore} → ${healthAfter}, ${healthSign}).`
      : `Version ${after.version}: verified configuration update (Health ${healthAfter}).`;

  return {
    fromVersion: before.version,
    toVersion: after.version,
    budgetBefore: before.budget,
    budgetAfter: after.budget,
    guestsBefore: before.guests,
    guestsAfter: after.guests,
    dateBefore: before.event_date,
    dateAfter: after.event_date,
    healthBefore,
    healthAfter,
    healthDelta,
    lineChanges,
    taskChanges,
    vendorChanges,
    summary,
  };
}

// ============================================================================
// 7. Closed-Vocabulary Operation Applier (`applyOps`)
// ============================================================================

const ALLOWED_OP_NAMES = new Set([
  'SetBudget',
  'SetGuests',
  'SetDate',
  'SetCity',
  'SetTier',
  'LockLine',
  'UnlockLine',
  'SetLine',
  'CancelVendor',
  'SelectVendor',
  'AddTask',
  'RemoveTask',
  'MoveTask',
  'AssignTask',
  'SetStatus',
  'AddFunction',
  'RemoveFunction',
  'SetIdeas',
]);

export interface ApplyOpsOutcome {
  ok: boolean;
  nextState: EventState;
  validation: ValidationResult;
  diff: PlanDiff;
  health: HealthReport;
}

export function applyOps(
  currentState: EventState,
  ops: TypedOp[]
): ApplyOpsOutcome {
  // Deep clone currentState
  const next: EventState = JSON.parse(JSON.stringify(currentState));
  next.parent_version = currentState.version;
  next.version = currentState.version + 1;

  for (const opItem of ops) {
    if (!opItem || !ALLOWED_OP_NAMES.has(opItem.op)) {
      const violation: InvariantViolation = {
        code: 'UNSUPPORTED_OPERATION',
        invariant: 'OP_VOCABULARY',
        detail: `Operation "${(opItem as { op?: string })?.op ?? 'unknown'}" is outside the closed operation vocabulary. Use one of: ${Array.from(ALLOWED_OP_NAMES).join(', ')}.`,
      };
      return {
        ok: false,
        nextState: currentState,
        validation: { valid: false, violations: [violation] },
        diff: computeDiff(currentState, currentState),
        health: computeHealth(currentState),
      };
    }

    switch (opItem.op) {
      case 'LockLine': {
        const line = next.lines.find(
          (l) => l.category.toLowerCase() === opItem.category.toLowerCase()
        );
        if (line) line.locked = true;
        break;
      }

      case 'UnlockLine': {
        const line = next.lines.find(
          (l) => l.category.toLowerCase() === opItem.category.toLowerCase()
        );
        if (line) line.locked = false;
        break;
      }

      case 'SetBudget': {
        const target = Math.round(opItem.total);
        const rescaled = rescaleBudget(next.lines, target);
        if (!rescaled.feasible) {
          const lockedCategories = next.lines
            .filter((l) => l.locked)
            .map((l) => l.category);
          const repairOps: TypedOp[] =
            lockedCategories.length > 0
              ? [
                  ...lockedCategories.map(
                    (c): TypedOp => ({ op: 'UnlockLine', category: c })
                  ),
                  { op: 'SetBudget', total: target },
                ]
              : [{ op: 'SetBudget', total: rescaled.minFeasibleTotal }];

          return {
            ok: false,
            nextState: currentState,
            validation: {
              valid: false,
              violations: [
                {
                  code: 'INFEASIBLE_BUDGET',
                  invariant: 'I1/I2/I6',
                  detail:
                    rescaled.reason ??
                    `Budget ₹${target.toLocaleString('en-IN')} is below minimum feasible ₹${rescaled.minFeasibleTotal.toLocaleString('en-IN')}.`,
                  field: 'budget',
                },
              ],
              repairOps,
              repairExplanation:
                lockedCategories.length > 0
                  ? `Unlock ${lockedCategories.join(', ')} or set budget to minimum feasible ₹${rescaled.minFeasibleTotal.toLocaleString('en-IN')}.`
                  : `Set budget to minimum feasible ₹${rescaled.minFeasibleTotal.toLocaleString('en-IN')}.`,
            },
            diff: computeDiff(currentState, currentState),
            health: computeHealth(currentState),
          };
        }
        next.budget = target;
        next.lines = rescaled.lines;
        break;
      }

      case 'SetLine': {
        const targetLine = next.lines.find(
          (l) => l.category.toLowerCase() === opItem.category.toLowerCase()
        );
        if (targetLine) {
          const newAmt = Math.round(opItem.amount);
          const wasLocked = targetLine.locked;
          targetLine.planned = newAmt;
          targetLine.locked = true;
          const rescaled = rescaleBudget(next.lines, next.budget);
          if (!rescaled.feasible) {
            return {
              ok: false,
              nextState: currentState,
              validation: {
                valid: false,
                violations: [
                  {
                    code: 'INFEASIBLE_BUDGET',
                    invariant: 'I1/I2/I6',
                    detail:
                      rescaled.reason ??
                      `Setting ${targetLine.category} to ₹${newAmt.toLocaleString('en-IN')} exceeds remaining unlocked budget.`,
                    field: `lines.${targetLine.category}`,
                  },
                ],
              },
              diff: computeDiff(currentState, currentState),
              health: computeHealth(currentState),
            };
          }
          next.lines = rescaled.lines;
          const updatedTarget = next.lines.find(
            (l) => l.category === targetLine.category
          );
          if (updatedTarget) updatedTarget.locked = wasLocked;
        }
        break;
      }

      case 'SetGuests': {
        const n = Math.max(5, Math.round(opItem.n));
        if (opItem.functionName) {
          const fn = next.functions.find(
            (f) => f.name.toLowerCase() === opItem.functionName!.toLowerCase()
          );
          if (fn) fn.guests = n;
          next.guests = Math.max(
            next.guests,
            ...next.functions.map((f) => f.guests)
          );
        } else {
          next.guests = n;
          next.functions.forEach((f) => {
            f.guests = Math.min(n, f.guests);
          });
        }
        break;
      }

      case 'SetDate': {
        if (!isValidIsoDate(opItem.date)) {
          return {
            ok: false,
            nextState: currentState,
            validation: {
              valid: false,
              violations: [
                {
                  code: 'I3_TASK_DATE_OUT_OF_RANGE',
                  invariant: 'I3',
                  detail: `Date "${opItem.date}" is not a valid YYYY-MM-DD date.`,
                  field: 'event_date',
                },
              ],
            },
            diff: computeDiff(currentState, currentState),
            health: computeHealth(currentState),
          };
        }
        const dayShift = diffDays(next.event_date, opItem.date);
        next.event_date = opItem.date;
        for (const fn of next.functions) {
          fn.date = addDays(fn.date, dayShift);
        }
        // Recompute non-completed task dates from lead times & re-run schedule pass
        for (const t of next.tasks) {
          if (t.status !== 'done') {
            t.due = addDays(next.event_date, -t.lead_time_days);
            t.start = addDays(t.due, -t.duration_days);
          }
        }
        const scheduled = scheduleTimeline(next.tasks, next.today, next.event_date);
        next.tasks = scheduled.tasks;
        next.risks = scheduled.risks;
        break;
      }

      case 'SetCity': {
        next.city = sanitizeText(opItem.city, 80);
        next.city_tier = opItem.city_tier ?? inferCityTier(next.city);
        break;
      }

      case 'SetTier': {
        next.tier = opItem.tier;
        break;
      }

      case 'CancelVendor': {
        const v = next.vendors.find(
          (item) =>
            item.category.toLowerCase() === opItem.category.toLowerCase()
        );
        if (v) {
          v.status = 'cancelled';
          v.name = `${v.name.replace(/ \(Cancelled\)$/i, '')} (Cancelled)`;
        }
        // Cascade timeline: reopen or create urgent replacement task in that category
        const relatedTasks = next.tasks.filter(
          (t) => t.category.toLowerCase() === opItem.category.toLowerCase()
        );
        for (const rt of relatedTasks) {
          rt.status = 'at_risk';
          rt.due = addDays(
            next.today,
            Math.min(7, Math.max(1, diffDays(next.today, next.event_date) - 2))
          );
          rt.start = next.today;
          rt.duration_days = Math.max(1, diffDays(rt.start, rt.due));
          rt.title = `[Urgent Replacement] Re-book ${rt.category} & verify tasting/contract`;
        }
        const scheduled = scheduleTimeline(next.tasks, next.today, next.event_date);
        next.tasks = scheduled.tasks;
        next.risks = [
          ...scheduled.risks,
          {
            code: 'VENDOR_CANCELLED',
            severity: 'high',
            message: `${opItem.category} vendor was cancelled; replacement task moved to urgent 7-day window and outreach kit prepared.`,
          },
        ];
        break;
      }

      case 'SelectVendor': {
        const existing = next.vendors.find(
          (item) =>
            item.category.toLowerCase() === opItem.category.toLowerCase()
        );
        if (existing) {
          existing.name = sanitizeText(opItem.name, 120);
          existing.status = 'booked';
          if (opItem.quote !== undefined) {
            existing.quote = Math.round(opItem.quote);
          }
          if (opItem.capacity !== undefined) {
            existing.capacity = Math.round(opItem.capacity);
          }
        } else {
          next.vendors.push({
            category: opItem.category,
            name: sanitizeText(opItem.name, 120),
            status: 'booked',
            quote: opItem.quote ? Math.round(opItem.quote) : 0,
            capacity: opItem.capacity,
          });
        }
        // Clear at_risk status on matching category task if booked
        for (const t of next.tasks) {
          if (
            t.category.toLowerCase() === opItem.category.toLowerCase() &&
            t.status === 'at_risk'
          ) {
            t.status = 'in_progress';
          }
        }
        break;
      }

      case 'AddTask': {
        const duration = Math.max(1, Math.round(opItem.duration_days));
        const leadDays = opItem.lead_time_days ?? 14;
        const due =
          opItem.due && isValidIsoDate(opItem.due)
            ? opItem.due
            : addDays(next.event_date, -leadDays);
        const start = addDays(due, -duration);
        next.tasks.push({
          id: sanitizeText(opItem.id, 40),
          title: sanitizeText(opItem.title, 200),
          category: opItem.category,
          start,
          due,
          duration_days: duration,
          depends_on: opItem.depends_on ?? [],
          owner: sanitizeText(opItem.owner ?? 'Coordinator', 60),
          status: 'todo',
          critical: false,
          lead_time_days: leadDays,
        });
        const scheduled = scheduleTimeline(next.tasks, next.today, next.event_date);
        next.tasks = scheduled.tasks;
        next.risks = scheduled.risks;
        break;
      }

      case 'RemoveTask': {
        next.tasks = next.tasks.filter((t) => t.id !== opItem.id);
        for (const t of next.tasks) {
          t.depends_on = t.depends_on.filter((d) => d !== opItem.id);
        }
        const scheduled = scheduleTimeline(next.tasks, next.today, next.event_date);
        next.tasks = scheduled.tasks;
        next.risks = scheduled.risks;
        break;
      }

      case 'MoveTask': {
        const task = next.tasks.find((t) => t.id === opItem.id);
        if (task && isValidIsoDate(opItem.due)) {
          task.due = opItem.due;
          task.start = addDays(opItem.due, -Math.max(1, task.duration_days));
          // Ensure start is not before latest dependency due date so direct move remains valid if feasible
          for (const depId of task.depends_on) {
            const dep = next.tasks.find((d) => d.id === depId);
            if (dep && toEpochDays(dep.due) > toEpochDays(task.start)) {
              task.start = dep.due;
              task.duration_days = Math.max(0, diffDays(task.start, task.due));
            }
          }
        }
        break;
      }

      case 'AssignTask': {
        const task = next.tasks.find((t) => t.id === opItem.id);
        if (task) {
          task.owner = sanitizeText(opItem.owner, 60);
        }
        break;
      }

      case 'SetStatus': {
        const task = next.tasks.find((t) => t.id === opItem.id);
        if (task) {
          task.status = opItem.status;
        }
        break;
      }

      case 'AddFunction': {
        if (next.type === 'wedding') {
          next.functions.push({
            name: sanitizeText(opItem.name, 80),
            date: opItem.date,
            guests: Math.max(10, Math.round(opItem.guests)),
          });
        }
        break;
      }

      case 'RemoveFunction': {
        next.functions = next.functions.filter(
          (f) => f.name.toLowerCase() !== opItem.name.toLowerCase()
        );
        break;
      }

      case 'SetIdeas': {
        next.ideas[opItem.section] = opItem.content;
        break;
      }
    }
  }

  const validation = validateEvent(next, currentState);
  if (!validation.valid) {
    return {
      ok: false,
      nextState: currentState,
      validation,
      diff: computeDiff(currentState, currentState),
      health: computeHealth(currentState),
    };
  }

  const diff = computeDiff(currentState, next);
  const health = computeHealth(next);

  return {
    ok: true,
    nextState: next,
    validation,
    diff,
    health,
  };
}

// ============================================================================
// 8. Verified Initial Event Factory & Persona Presets (Section 1.3 & 15)
// ============================================================================

export interface CreateEventInput {
  id?: string;
  type: EventType;
  title: string;
  city: string;
  guests: number;
  budget: number;
  event_date: string;
  today?: string;
  tier?: BudgetTier;
  vibe?: string;
  constraints?: string[];
  assumptions?: string[];
  followUpQuestions?: string[];
  indoorOutdoor?: 'indoor' | 'outdoor' | 'hybrid';
  cultureOrTheme?: string;
}

export function createInitialEvent(input: CreateEventInput): EventState {
  const today = input.today ?? getTodayKolkata();
  const city_tier = inferCityTier(input.city);
  const tier: BudgetTier = input.tier ?? 'standard';
  const budget = Math.max(15000, Math.round(input.budget));
  const guests = Math.max(10, Math.round(input.guests));

  const lines = buildBaselineBudget(input.type, budget, city_tier, tier);
  const { tasks, risks } = buildBaselineTimeline(
    input.type,
    today,
    input.event_date
  );

  const venueCapacity =
    input.type === 'wedding'
      ? Math.max(guests + 50, 250)
      : input.type === 'birthday'
        ? Math.max(guests + 20, 80)
        : Math.max(guests + 100, 500);

  const vendors: EventVendor[] = lines
    .filter((l) => l.category !== 'Contingency')
    .map((l) => {
      if (
        l.category === 'Venue' ||
        l.category === 'Venue, permits, infrastructure'
      ) {
        return {
          category: l.category,
          name:
            input.type === 'wedding'
              ? `${input.city} Heritage Haveli Courtyard (Suggested Estimate)`
              : input.type === 'birthday'
                ? `${input.city} Terrace Studio & Play Lounge (Suggested Estimate)`
                : `${input.city} RWA Central Park Ground (Suggested Estimate)`,
          status: 'booked',
          quote: l.planned,
          capacity: venueCapacity,
        };
      }
      if (l.category === 'Catering' || l.category === 'Food and beverage') {
        return {
          category: l.category,
          name:
            input.type === 'wedding'
              ? 'Shree Annapurna Royal Halwai & Caterers (Suggested)'
              : input.type === 'birthday'
                ? 'Little Bites Kitchen & Bakehouse (Suggested)'
                : 'RWA Verified Food Stall Collective (Suggested)',
          status: 'booked',
          quote: l.planned,
        };
      }
      return {
        category: l.category,
        name: `${input.city} ${l.category} Specialist (Suggested Estimate)`,
        status: 'shortlisted',
        quote: l.planned,
      };
    });

  const functions: EventFunction[] =
    input.type === 'wedding'
      ? [
          {
            name: 'Mehendi & Folk Welcome',
            date: addDays(input.event_date, -1),
            guests: Math.round(guests * 0.75),
          },
          {
            name: 'Sangeet & Ring Ceremony',
            date: addDays(input.event_date, -1),
            guests,
          },
          {
            name: 'Haldi, Baraat & Dusk Pheras',
            date: input.event_date,
            guests,
          },
        ]
      : [];

  const brief: EventBrief = {
    title: sanitizeText(input.title, 140),
    vibe: sanitizeText(
      input.vibe ??
        (input.type === 'wedding'
          ? 'Warm Rajasthani courtyard elegance with brass & marigold accents'
          : input.type === 'birthday'
            ? 'Playful interactive mystery quest with split kid/adult menus'
            : 'Safe, zero-waste neighborhood Diwali mela with sponsor stalls'),
      400
    ),
    constraints: input.constraints ?? [
      'All budget figures in integer INR with >=5% contingency',
      'Outdoor amplified music concludes by 10:00 PM',
    ],
    assumptions: input.assumptions ?? [
      `City tier ${city_tier} benchmark split applied (${input.city}) — editable assumption`,
      `Venue capacity initialized at ${venueCapacity} guests (estimate)`,
      'Per-guest price bands are unverified seed estimates until real quotes are logged',
    ],
    followUpQuestions: input.followUpQuestions ?? [
      'Should we lock the Venue budget line so future budget adjustments only scale other categories?',
      'Do you need indoor rain/winter backup seating for 100% of guests?',
      'Are vegetarian-only and Jain counter separations required for Catering?',
    ],
    indoorOutdoor: input.indoorOutdoor ?? 'hybrid',
    cultureOrTheme:
      input.cultureOrTheme ??
      (input.type === 'wedding'
        ? 'Rajasthani / North Indian Multi-Function'
        : input.type === 'birthday'
          ? 'Age 10 Explorer & Maker Theme'
          : 'RWA Community Diwali Mela'),
  };

  const state: EventState = {
    id: input.id ?? 'evt-jaipur-wedding',
    version: 1,
    parent_version: null,
    type: input.type,
    event_date: input.event_date,
    today,
    guests,
    city: input.city,
    city_tier,
    budget,
    tier,
    brief,
    functions,
    lines,
    tasks,
    vendors,
    ideas: getDefaultIdeas(input.type),
    risks,
  };

  return state;
}

export const PERSONA_PRESETS: Record<string, CreateEventInput> = {
  wedding_riya: {
    id: 'evt-jaipur-wedding',
    type: 'wedding',
    title: "Sister's Jaipur Winter Wedding (Riya)",
    city: 'Jaipur',
    guests: 200,
    budget: 1200000, // Rs 12L
    event_date: '2026-12-18',
    today: '2026-11-01',
    tier: 'standard',
    vibe: 'Intimate heritage haveli courtyard wedding with kesariya marigold decor, folk sangeet, and royal pangat feast.',
    constraints: [
      'Total budget capped at ₹12,00,000 across 3 functions',
      'Pure vegetarian menu with live Rajasthani chaat & Dal Baati Churma station',
      'Venue capacity currently 250 guests (Samode/Amer Road Haveli)',
    ],
    assumptions: [
      'Standard Tier-2 Jaipur percentage split applied (Catering 30%, Venue 18%, Decor 10%)',
      'Venue capacity assumed at 250 pax based on courtyard lawn declaration',
      'All vendor figures labeled as editable estimates until quotes are finalized',
    ],
    followUpQuestions: [
      'Lock Venue at ₹2,16,000 before testing a ₹9L budget cut?',
      'Add a 40-guest morning Haldi brunch to the catering scope?',
      'Include station shuttle pickups in Accommodation & Travel?',
    ],
  },
  birthday_arjun: {
    id: 'evt-arjun-birthday',
    type: 'birthday',
    title: "Aarav's 10th Birthday Mystery Quest (Arjun)",
    city: 'Bengaluru',
    guests: 60,
    budget: 90000, // Rs 90k
    event_date: '2026-11-28',
    today: '2026-11-01',
    tier: 'standard',
    vibe: 'Fast, high-energy Galactic Mystery & Science Maker birthday for 35 ten-year-olds and 25 parents.',
    constraints: [
      'Strict nut-free kids menu + evening masala chai high tea for parents',
      '3-hour indoor clubhouse slot (4:30 PM to 7:30 PM)',
    ],
    assumptions: [
      'Tier-1 Bengaluru standard split (Catering 35%, Venue 20%, Decor 12%, Games 12%)',
      'Clubhouse hall capacity assumed at 80 guests',
    ],
    followUpQuestions: [
      'Lock Venue and Cake lines before adjusting total budget?',
      'Switch return gifts to DIY STEM kits (₹250/child)?',
      'Add a 30-minute science liquid-nitrogen show?',
    ],
  },
  community_meena: {
    id: 'evt-diwali-mela',
    type: 'community',
    title: 'Vasant Vihar RWA Community Diwali Mela (Meena)',
    city: 'New Delhi',
    guests: 400,
    budget: 450000, // Rs 4.5L
    event_date: '2026-11-14',
    today: '2026-11-01',
    tier: 'standard',
    vibe: 'Zero-waste community Diwali mela with 20 artisan & food stalls, police/fire NOC compliance, sponsor banners, and a 2-shift volunteer roster.',
    constraints: [
      'Mandatory 3-meter fire corridor and twin-bin waste segregation',
      'Loudspeaker permit cut-off strictly at 10:00 PM',
      '7% RWA treasury contingency floor enforced',
    ],
    assumptions: [
      'Community event template split (Infrastructure & Permits 25%, Food 20%, Stalls 15%, Safety 8%, Contingency 7%)',
      'Central RWA ground capacity set to 500 concurrent visitors',
    ],
    followUpQuestions: [
      'Generate volunteer role-scoped share link for the 20 shift marshals?',
      'Lock Safety, medical, insurance budget line against cuts?',
      'Add a Title Sponsor stall package task?',
    ],
  },
};
