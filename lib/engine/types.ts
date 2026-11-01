export type EventType = 'wedding' | 'birthday' | 'community';
export type BudgetTier = 'lean' | 'standard' | 'premium';
export type CityTier = 1 | 2 | 3;
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'at_risk';
export type VendorStatus = 'shortlisted' | 'contacted' | 'booked' | 'cancelled';
export type ShareRole = 'family' | 'vendor' | 'volunteer';

export interface EventBrief {
  title: string;
  vibe: string;
  constraints: string[];
  assumptions: string[];
  followUpQuestions?: string[];
  indoorOutdoor: 'indoor' | 'outdoor' | 'hybrid';
  cultureOrTheme: string;
}

export interface EventFunction {
  name: string;
  date: string; // YYYY-MM-DD in Asia/Kolkata
  guests: number;
}

export interface BudgetLine {
  category: string;
  planned: number; // integer rupees
  actual: number;  // integer rupees
  locked: boolean;
  floor: number;   // integer rupees minimum feasible floor
  templatePct: number;
}

export interface EventTask {
  id: string;
  title: string;
  category: string;
  start: string; // YYYY-MM-DD
  due: string;   // YYYY-MM-DD
  duration_days: number;
  depends_on: string[];
  owner: string;
  status: TaskStatus;
  critical: boolean;
  lead_time_days: number;
  template_id?: string;
}

export interface EventVendor {
  category: string;
  name: string;
  status: VendorStatus;
  quote: number; // integer rupees (estimate or quote)
  capacity?: number; // for Venue category (I7 invariant)
  notes?: string;
}

export interface IdeaItem {
  title: string;
  description: string;
  estimatedBand: string;
  templateCitation: string; // e.g., "TPL-WED-01"
}

export interface EventIdeas {
  themes: IdeaItem[];
  menu: IdeaItem[];
  games: IdeaItem[];
  decor: IdeaItem[];
  runOfShow: IdeaItem[];
  permitsAndVolunteers?: IdeaItem[]; // especially for community events
}

export interface RiskItem {
  code: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  affectedIds?: string[];
}

export interface EventState {
  id: string;
  version: number;
  parent_version: number | null;
  type: EventType;
  event_date: string; // YYYY-MM-DD in Asia/Kolkata
  today: string;      // YYYY-MM-DD in Asia/Kolkata
  guests: number;
  city: string;
  city_tier: CityTier;
  budget: number;     // integer rupees
  tier: BudgetTier;
  brief: EventBrief;
  functions: EventFunction[];
  lines: BudgetLine[];
  tasks: EventTask[];
  vendors: EventVendor[];
  ideas: EventIdeas;
  risks: RiskItem[];
}

// Closed vocabulary of 17 typed operations (Section 5.2)
export type TypedOp =
  | { op: 'SetBudget'; total: number }
  | { op: 'SetGuests'; n: number; functionName?: string }
  | { op: 'SetDate'; date: string }
  | { op: 'SetCity'; city: string; city_tier?: CityTier }
  | { op: 'SetTier'; tier: BudgetTier }
  | { op: 'LockLine'; category: string }
  | { op: 'UnlockLine'; category: string }
  | { op: 'SetLine'; category: string; amount: number }
  | { op: 'CancelVendor'; category: string; name?: string }
  | { op: 'SelectVendor'; category: string; name: string; quote?: number; capacity?: number }
  | {
      op: 'AddTask';
      id: string;
      title: string;
      category: string;
      due?: string;
      duration_days: number;
      depends_on?: string[];
      owner?: string;
      lead_time_days?: number;
    }
  | { op: 'RemoveTask'; id: string }
  | { op: 'MoveTask'; id: string; due: string }
  | { op: 'AssignTask'; id: string; owner: string }
  | { op: 'SetStatus'; id: string; status: TaskStatus }
  | { op: 'AddFunction'; name: string; date: string; guests: number }
  | { op: 'RemoveFunction'; name: string }
  | { op: 'SetIdeas'; section: keyof EventIdeas; content: IdeaItem[] };

export interface HealthDeduction {
  code:
    | 'BUDGET_PER_GUEST_LOW'
    | 'LEAD_TIME_COMPRESSED'
    | 'CONTINGENCY_LOW'
    | 'CRITICAL_PATH_SLACK_TIGHT'
    | 'UNASSIGNED_OWNERS'
    | 'ACTUALS_OVERRUN';
  points: number;
  why: string;
  fix: string;
  fixOps: TypedOp[];
}

export interface HealthReport {
  score: number; // 0..100
  deductions: HealthDeduction[];
}

export type InvariantCode =
  | 'I1_BUDGET_SUM_MISMATCH'
  | 'I2_CONTINGENCY_BELOW_5_PCT'
  | 'I3_TASK_DATE_OUT_OF_RANGE'
  | 'I4_DEPENDENCY_GRAPH_INVALID'
  | 'I5_DEPENDENCY_ORDER_VIOLATION'
  | 'I6_LOCKED_LINE_MODIFIED'
  | 'I7_VENUE_CAPACITY_EXCEEDED'
  | 'I8_INVALID_TASK_CATEGORY'
  | 'I9_VERSION_SEQUENCE_INVALID'
  | 'I10_TEXT_BOUNDS_OR_UNSAFE'
  | 'INFEASIBLE_BUDGET'
  | 'UNSUPPORTED_OPERATION';

export interface InvariantViolation {
  code: InvariantCode;
  invariant: string;
  detail: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: InvariantViolation[];
  repairOps?: TypedOp[];
  repairExplanation?: string;
}

export interface BudgetLineDiff {
  category: string;
  before: number;
  after: number;
  delta: number;
  locked: boolean;
}

export interface TaskDiff {
  id: string;
  title: string;
  change: 'added' | 'removed' | 'moved' | 'status_changed' | 'owner_changed';
  beforeDue?: string;
  afterDue?: string;
  beforeStatus?: TaskStatus;
  afterStatus?: TaskStatus;
  beforeOwner?: string;
  afterOwner?: string;
}

export interface VendorDiff {
  category: string;
  beforeName: string;
  afterName: string;
  beforeStatus: VendorStatus;
  afterStatus: VendorStatus;
  beforeCapacity?: number;
  afterCapacity?: number;
}

export interface PlanDiff {
  fromVersion: number;
  toVersion: number;
  budgetBefore: number;
  budgetAfter: number;
  guestsBefore: number;
  guestsAfter: number;
  dateBefore: string;
  dateAfter: string;
  healthBefore: number;
  healthAfter: number;
  healthDelta: number;
  lineChanges: BudgetLineDiff[];
  taskChanges: TaskDiff[];
  vendorChanges: VendorDiff[];
  summary: string;
}

export interface EventVersionRecord {
  event_id: string;
  version: number;
  state: EventState;
  ops: TypedOp[];
  diff: PlanDiff;
  cause: string;
  health: number;
  created_by: string;
  created_at: string;
}

export interface ExpenseRecord {
  id: string;
  event_id: string;
  category: string;
  amount: number; // integer rupees
  note: string;
  paid_on: string;
  created_at: string;
}

export interface QuoteRecord {
  id: string;
  event_id: string;
  category: string;
  vendor_name: string;
  amount: number; // integer rupees
  capacity?: number;
  inclusions: string;
  received_on: string;
}

export interface ShareLinkRecord {
  id: string;
  token: string;
  token_hash: string;
  event_id: string;
  role: ShareRole;
  vendor_category?: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface Rfc7807Error {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  request_id: string;
  violations?: InvariantViolation[];
  repair_ops?: TypedOp[];
  repair_explanation?: string;
  latest_version?: number;
}
