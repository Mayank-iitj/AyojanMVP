import { addDays, createInitialEvent, CreateEventInput, getTodayKolkata } from './core';
import { EVENT_TEMPLATES, getDefaultIdeas, getVendorKit } from './templates';
import { BudgetTier, EventIdeas, EventState, EventType, TypedOp } from './types';

// ============================================================================
// 1. Prompt-Injection & Safety Sanitizer (Section 6.2)
// ============================================================================

const INJECTION_PATTERNS = [
  /ignore (all |prior |previous )?(instructions|rules|invariants)/i,
  /disregard (all |prior |previous )?(instructions|rules|invariants)/i,
  /system prompt/i,
  /bypass validator/i,
  /you are now dan/i,
  /drop table/i,
  /<script/i,
  /set contingency to 0/i,
];

export function detectPromptInjection(text: string): {
  suspicious: boolean;
  reason?: string;
} {
  for (const pat of INJECTION_PATTERNS) {
    if (pat.test(text)) {
      return {
        suspicious: true,
        reason: `Untrusted instruction pattern blocked by guardrail (${pat.source}).`,
      };
    }
  }
  return { suspicious: false };
}

// ============================================================================
// 2. Natural-Language Intake Parser (Free Text -> CreateEventInput)
// ============================================================================

export function parseFreeTextToEventInput(rawText: string): CreateEventInput {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  let type: EventType = 'wedding';
  if (
    lower.includes('birthday') ||
    lower.includes('bday') ||
    lower.includes('year-old') ||
    lower.includes('yr old') ||
    lower.includes('kids party')
  ) {
    type = 'birthday';
  } else if (
    lower.includes('community') ||
    lower.includes('mela') ||
    lower.includes('rwa') ||
    lower.includes('festival') ||
    lower.includes('society') ||
    lower.includes('diwali')
  ) {
    type = 'community';
  }

  // Parse guests
  let guests = type === 'wedding' ? 200 : type === 'birthday' ? 60 : 400;
  const guestMatch = text.match(/(\d{1,4})\s*(?:guests|people|pax|visitors|kids|log)/i);
  if (guestMatch) {
    guests = Math.max(10, Math.min(5000, parseInt(guestMatch[1], 10)));
  }

  // Parse budget (supports "Rs 12L", "12 lakh", "₹9,00,000", "90k", "4.5L")
  let budget =
    type === 'wedding' ? 1200000 : type === 'birthday' ? 90000 : 450000;
  const lakhMatch = text.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:l|lakh|lakhs|lac)/i);
  const kMatch = text.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand)/i);
  const rawNumMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]{5,10})/i);

  if (lakhMatch) {
    budget = Math.round(parseFloat(lakhMatch[1]) * 100000);
  } else if (kMatch) {
    budget = Math.round(parseFloat(kMatch[1]) * 1000);
  } else if (rawNumMatch) {
    budget = parseInt(rawNumMatch[1].replace(/,/g, ''), 10);
  }

  // Parse city
  const knownCities = [
    'Jaipur',
    'Udaipur',
    'Mumbai',
    'New Delhi',
    'Delhi',
    'Bengaluru',
    'Bangalore',
    'Pune',
    'Hyderabad',
    'Chennai',
    'Kolkata',
    'Ahmedabad',
    'Chandigarh',
    'Goa',
    'Lucknow',
    'Indore',
  ];
  let city = type === 'wedding' ? 'Jaipur' : type === 'birthday' ? 'Bengaluru' : 'New Delhi';
  for (const c of knownCities) {
    if (lower.includes(c.toLowerCase())) {
      city = c === 'Bangalore' ? 'Bengaluru' : c === 'Delhi' ? 'New Delhi' : c;
      break;
    }
  }

  // Parse date
  const today = getTodayKolkata();
  let event_date =
    type === 'wedding'
      ? '2026-12-18'
      : type === 'birthday'
        ? '2026-11-28'
        : '2026-11-14';
  const isoMatch = text.match(/\b(202[6-9]-\d{2}-\d{2})\b/);
  if (isoMatch) {
    event_date = isoMatch[1];
  } else if (lower.includes('january') || lower.includes('jan')) {
    event_date = '2027-01-18';
  } else if (lower.includes('february') || lower.includes('feb')) {
    event_date = '2027-02-14';
  } else if (lower.includes('december') || lower.includes('dec')) {
    event_date = '2026-12-18';
  }

  // Parse tier
  let tier: BudgetTier = 'standard';
  if (lower.includes('lean') || lower.includes('cheap') || lower.includes('tight')) {
    tier = 'lean';
  } else if (lower.includes('premium') || lower.includes('luxury') || lower.includes('royal')) {
    tier = 'premium';
  }

  const title =
    type === 'wedding'
      ? `${city} Wedding Celebration (${guests} Guests)`
      : type === 'birthday'
        ? `${city} Birthday Adventure (${guests} Guests)`
        : `${city} Community Mela (${guests} Visitors)`;

  return {
    id: `evt-${type}-${Date.now().toString(36).slice(-5)}`,
    type,
    title,
    city,
    guests,
    budget,
    event_date,
    today,
    tier,
    vibe: text.slice(0, 240),
  };
}

// ============================================================================
// 3. Deterministic Natural-Language -> TypedOp[] Compiler (Section 5.2 & 6)
// ============================================================================

export function compileInstructionToOps(
  instruction: string,
  state: EventState
): { ops: TypedOp[]; explanation: string; injectionBlocked?: boolean } {
  const clean = instruction.trim();
  const lower = clean.toLowerCase();
  const ops: TypedOp[] = [];
  const notes: string[] = [];

  // Guardrail against prompt injection trying to zero out contingency or corrupt state
  const inj = detectPromptInjection(clean);
  if (inj.suspicious) {
    return {
      ops: [],
      explanation: inj.reason ?? 'Blocked untrusted instruction.',
      injectionBlocked: true,
    };
  }

  // Helper to match a category in current event
  const findCategory = (text: string): string | null => {
    for (const line of state.lines) {
      const catLower = line.category.toLowerCase();
      if (text.includes(catLower)) return line.category;
    }
    if (text.includes('caterer') || text.includes('halwai') || text.includes('food')) {
      const c = state.lines.find(
        (l) =>
          l.category.toLowerCase().includes('catering') ||
          l.category.toLowerCase().includes('food')
      );
      if (c) return c.category;
    }
    if (text.includes('venue') || text.includes('hall') || text.includes('ground') || text.includes('lawn')) {
      const c = state.lines.find((l) => l.category.toLowerCase().includes('venue'));
      if (c) return c.category;
    }
    if (text.includes('decor') || text.includes('floral') || text.includes('flower')) {
      const c = state.lines.find((l) => l.category.toLowerCase().includes('decor'));
      if (c) return c.category;
    }
    if (text.includes('photo') || text.includes('video') || text.includes('camera')) {
      const c = state.lines.find((l) => l.category.toLowerCase().includes('photo'));
      if (c) return c.category;
    }
    if (text.includes('music') || text.includes('dj') || text.includes('entertain') || text.includes('game')) {
      const c = state.lines.find((l) => l.category.toLowerCase().includes('entertain'));
      if (c) return c.category;
    }
    if (text.includes('safety') || text.includes('medical') || text.includes('fire')) {
      const c = state.lines.find((l) => l.category.toLowerCase().includes('safety'));
      if (c) return c.category;
    }
    if (text.includes('contingency')) return 'Contingency';
    return null;
  };

  // 1. Lock / Unlock category
  if (/\bunlock\b/i.test(lower)) {
    const cat = findCategory(lower);
    if (cat) {
      ops.push({ op: 'UnlockLine', category: cat });
      notes.push(`Unlock ${cat} budget line`);
    }
  } else if (/\block\b/i.test(lower)) {
    const cat = findCategory(lower);
    if (cat) {
      ops.push({ op: 'LockLine', category: cat });
      notes.push(`Lock ${cat} budget line`);
    }
  }

  // 2. Vendor cancelled / backed out / fell through
  if (
    lower.includes('cancel') ||
    lower.includes('backed out') ||
    lower.includes('fell through') ||
    lower.includes('dropped out') ||
    lower.includes('mana kar diya')
  ) {
    const cat = findCategory(lower) ?? state.lines[0].category;
    ops.push({ op: 'CancelVendor', category: cat });
    notes.push(`Mark ${cat} vendor as cancelled and trigger urgent replacement task`);
  }

  // 3. Select / Book vendor
  const bookMatch = clean.match(/(?:book|select|hire)\s+([A-Za-z0-9 &'-]+?)\s+for\s+([A-Za-z &]+)/i);
  if (bookMatch) {
    const vendorName = bookMatch[1].trim();
    const cat = findCategory(bookMatch[2].toLowerCase()) ?? state.lines[0].category;
    const capMatch = clean.match(/(\d{2,4})\s*(?:capacity|pax|guests)/i);
    ops.push({
      op: 'SelectVendor',
      category: cat,
      name: vendorName,
      capacity: capMatch ? parseInt(capMatch[1], 10) : undefined,
    });
    notes.push(`Book "${vendorName}" for ${cat}`);
  }

  // 4. Guest count change (e.g. "Guests 200 to 350", "guests to 150", "350 guests", "guests badha ke 250")
  const guestToMatch =
    clean.match(/guests?\s+(?:(?:from\s+)?\d+\s+)?(?:to|->|badha\s+ke|kam\s+karke)\s*(\d{1,4})/i) ||
    clean.match(/(?:increase|raise|cut|reduce|set|change)\s+guests?\s+(?:to\s+)?(\d{1,4})/i) ||
    clean.match(/(\d{2,4})\s+guests/i);
  if (guestToMatch && !lower.includes('capacity')) {
    const newGuests = parseInt(guestToMatch[1], 10);
    if (newGuests > 0 && newGuests !== state.guests) {
      ops.push({ op: 'SetGuests', n: newGuests });
      notes.push(`Update guest count from ${state.guests} to ${newGuests}`);
    }
  }

  // 5. Budget change (e.g. "budget to Rs 9L", "cut budget to 9L", "raise budget by 2L", "budget 15L")
  const lakhBudgetMatch = clean.match(
    /(?:budget|total)[\s\w]*?(?:to|at|=|of|ke)?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:l|lakh|lakhs|lac)\b/i
  ) || clean.match(/(?:cut|reduce|raise|increase|set|drag)\s+(?:the\s+)?(?:budget\s+)?(?:to\s+)?(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:l|lakh|lakhs|lac)\b/i);
  const kBudgetMatch = clean.match(
    /(?:budget|total|cut|set|raise)[\s\w]*?(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand)\b/i
  );
  const exactBudgetMatch = clean.match(
    /(?:budget|total)\s+(?:to\s+)?(?:rs\.?|inr|₹)?\s*([\d,]{5,10})\b/i
  );

  if (lakhBudgetMatch) {
    const total = Math.round(parseFloat(lakhBudgetMatch[1]) * 100000);
    ops.push({ op: 'SetBudget', total });
    notes.push(`Rescale total budget to ₹${total.toLocaleString('en-IN')}`);
  } else if (kBudgetMatch) {
    const total = Math.round(parseFloat(kBudgetMatch[1]) * 1000);
    ops.push({ op: 'SetBudget', total });
    notes.push(`Rescale total budget to ₹${total.toLocaleString('en-IN')}`);
  } else if (exactBudgetMatch) {
    const total = parseInt(exactBudgetMatch[1].replace(/,/g, ''), 10);
    ops.push({ op: 'SetBudget', total });
    notes.push(`Rescale total budget to ₹${total.toLocaleString('en-IN')}`);
  } else if (lower.includes('cut budget by 10%') || lower.includes('reduce budget by 10%')) {
    const total = Math.round(state.budget * 0.9);
    ops.push({ op: 'SetBudget', total });
    notes.push(`Reduce total budget by 10% to ₹${total.toLocaleString('en-IN')}`);
  } else if (lower.includes('increase budget by 10%') || lower.includes('raise budget by 10%')) {
    const total = Math.round(state.budget * 1.1);
    ops.push({ op: 'SetBudget', total });
    notes.push(`Increase total budget by 10% to ₹${total.toLocaleString('en-IN')}`);
  }

  // 6. Date shift (e.g., "move date to 2026-12-25", "push date 10 days later", "1 week earlier")
  const isoDateMatch = clean.match(/\b(202[6-9]-\d{2}-\d{2})\b/);
  const daysLaterMatch = clean.match(/(\d{1,3})\s+days?\s+(later|postpone|out)/i);
  const daysEarlierMatch = clean.match(/(\d{1,3})\s+days?\s+(earlier|sooner|prepone)/i);

  if (isoDateMatch) {
    ops.push({ op: 'SetDate', date: isoDateMatch[1] });
    notes.push(`Move event date to ${isoDateMatch[1]} and cascade non-completed tasks`);
  } else if (daysLaterMatch) {
    const newDate = addDays(state.event_date, parseInt(daysLaterMatch[1], 10));
    ops.push({ op: 'SetDate', date: newDate });
    notes.push(`Postpone event date by ${daysLaterMatch[1]} days to ${newDate}`);
  } else if (daysEarlierMatch) {
    const newDate = addDays(state.event_date, -parseInt(daysEarlierMatch[1], 10));
    ops.push({ op: 'SetDate', date: newDate });
    notes.push(`Move event date earlier by ${daysEarlierMatch[1]} days to ${newDate}`);
  }

  // 7. Tier switch
  if (lower.includes('lean tier') || lower.includes('switch to lean')) {
    ops.push({ op: 'SetTier', tier: 'lean' });
    notes.push('Switch event tier to Lean');
  } else if (lower.includes('premium tier') || lower.includes('switch to premium')) {
    ops.push({ op: 'SetTier', tier: 'premium' });
    notes.push('Switch event tier to Premium');
  } else if (lower.includes('standard tier') || lower.includes('switch to standard')) {
    ops.push({ op: 'SetTier', tier: 'standard' });
    notes.push('Switch event tier to Standard');
  }

  // 8. Assign owner
  const assignMatch = clean.match(/assign\s+([A-Za-z &]+?)\s+to\s+([A-Za-z ]+)$/i);
  if (assignMatch) {
    const cat = findCategory(assignMatch[1].toLowerCase());
    const owner = assignMatch[2].trim();
    const task = state.tasks.find(
      (t) =>
        (cat && t.category === cat) ||
        t.title.toLowerCase().includes(assignMatch[1].toLowerCase())
    );
    if (task) {
      ops.push({ op: 'AssignTask', id: task.id, owner });
      notes.push(`Assign task "${task.title}" to ${owner}`);
    }
  }

  // 9. Complete task
  if (lower.includes('complete ') || lower.includes('mark ') && lower.includes('done')) {
    const cat = findCategory(lower);
    const task = state.tasks.find((t) => cat && t.category === cat);
    if (task) {
      ops.push({ op: 'SetStatus', id: task.id, status: 'done' });
      notes.push(`Mark "${task.title}" as done`);
    }
  }

  // 10. Add Function (wedding)
  if (lower.includes('add function') || lower.includes('add haldi') || lower.includes('add welcome dinner')) {
    const fnName = lower.includes('haldi')
      ? 'Morning Haldi & Dhol'
      : lower.includes('welcome')
        ? 'Welcome Folk Dinner'
        : 'After-Party Lounge';
    ops.push({
      op: 'AddFunction',
      name: fnName,
      date: addDays(state.event_date, -1),
      guests: Math.min(state.guests, 120),
    });
    notes.push(`Add wedding function "${fnName}"`);
  }

  return {
    ops,
    explanation:
      notes.length > 0
        ? notes.join(' · ')
        : 'No matching typed operation detected from instruction.',
  };
}

// ============================================================================
// 4. Vendor Outreach Draft Generator (WhatsApp / Email, English / Hinglish)
// ============================================================================

export function generateVendorOutreachDraft(params: {
  state: EventState;
  category: string;
  channel: 'whatsapp' | 'email';
  language: 'english' | 'hinglish';
}): { subject?: string; message: string; kitUsed: string[] } {
  const { state, category, channel, language } = params;
  const line = state.lines.find(
    (l) => l.category.toLowerCase() === category.toLowerCase()
  );
  const budgetEstimate = line ? line.planned : Math.round(state.budget * 0.15);
  const perGuest = Math.round(budgetEstimate / Math.max(1, state.guests));
  const kit = getVendorKit(category);

  if (language === 'hinglish') {
    if (channel === 'whatsapp') {
      return {
        message: `Namaste ji! 🙏 Hum *${state.city}* mein *${state.event_date}* ko *${state.brief.title}* (${state.guests} guests) plan kar rahe hain.\n\nHumein *${category}* ke liye aapka detailed quote chahiye. Humara target budget band approx *₹${budgetEstimate.toLocaleString('en-IN')}* (~₹${perGuest.toLocaleString('en-IN')}/guest estimate) hai.\n\nKripya yeh 3 points confirm karein:\n1. ${kit.whatToAsk[0]}\n2. ${kit.whatToAsk[1]}\n3. Kya GST, transport aur backup power isme included hai?\n\nAgar aap ${state.event_date} ke liye available hain toh aaj sham ko call pe baat karein? Dhanyawad!`,
        kitUsed: kit.whatToAsk,
      };
    }
    return {
      subject: `Quote Inquiry: ${category} for ${state.brief.title} (${state.event_date}, ${state.city})`,
      message: `Namaste Team,\n\nHum ${state.city} mein ${state.event_date} ko ${state.guests} guests ke liye ${state.brief.title} organize kar rahe hain. Humein ${category} services ke liye aapka itemized proposal chahiye (target allocation ~₹${budgetEstimate.toLocaleString('en-IN')}).\n\nPlease apne quote mein yeh details zaroor mention karein:\n- ${kit.whatToAsk.join('\n- ')}\n- Expected inclusions: ${kit.benchmarkInclusions}\n\nLooking forward to your itemized quote.\n\nWarm regards,\n${state.tasks[0]?.owner ?? 'Event Coordinator'}`,
      kitUsed: kit.whatToAsk,
    };
  }

  if (channel === 'whatsapp') {
    return {
      message: `Hi! We are planning *${state.brief.title}* in *${state.city}* on *${state.event_date}* for *${state.guests} guests*.\n\nWe are shortlisting *${category}* partners (target allocation ~*₹${budgetEstimate.toLocaleString('en-IN')}* / ₹${perGuest.toLocaleString('en-IN')} per guest estimate).\n\nCould you share your itemized package and confirm:\n1. ${kit.whatToAsk[0]}\n2. ${kit.whatToAsk[1]}\n3. ${kit.whatToAsk[2]}\n\nPlease let us know your availability for ${state.event_date}. Thank you!`,
      kitUsed: kit.whatToAsk,
    };
  }

  return {
    subject: `RFP / Quote Request: ${category} — ${state.brief.title} (${state.event_date}, ${state.guests} Guests)`,
    message: `Dear ${category} Partner,\n\nWe are organizing ${state.brief.title} in ${state.city} on ${state.event_date} for ${state.guests} guests. Our planned budget allocation for ${category} is approximately ₹${budgetEstimate.toLocaleString('en-IN')}.\n\nPlease share an itemized quotation covering:\n• ${kit.benchmarkInclusions}\n\nSpecifically, please clarify:\n1. ${kit.whatToAsk[0]}\n2. ${kit.whatToAsk[1]}\n3. ${kit.whatToAsk[2]}\n\nBest regards,\n${state.tasks[0]?.owner ?? 'Event Coordinator'}`,
    kitUsed: kit.whatToAsk,
  };
}

export function regenerateConstrainedIdeas(
  state: EventState,
  constraint: string
): EventIdeas {
  const base = getDefaultIdeas(state.type);
  const tag = constraint.trim() || 'Zero-waste & local artisan focus';
  const citation =
    state.type === 'wedding'
      ? 'TPL-WED-03'
      : state.type === 'birthday'
        ? 'TPL-BIR-01'
        : 'TPL-COM-04';

  return {
    ...base,
    themes: [
      {
        title: `${base.themes[0]?.title ?? 'Curated Concept'} (${tag})`,
        description: `Adapted for "${tag}" across ${state.guests} guests in ${state.city} within the ₹${state.budget.toLocaleString('en-IN')} ${state.tier} budget.`,
        estimatedBand: `Aligned to ₹${Math.round(state.budget / state.guests).toLocaleString('en-IN')}/guest`,
        templateCitation: citation,
      },
      ...base.themes.slice(0, 1),
    ],
  };
}
