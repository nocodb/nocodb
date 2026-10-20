/** Words that mean the signed-in user. */
export const ME_WORDS = new Set(['me', 'myself', 'mine', 'i', '@me', 'self'])

/**
 * Cues that the next words name a person: "owned by ann", "assigned to me", "created by raj".
 * The cue also hints which user field: "assigned" → Assignee, "owned" → Owner.
 */
export const MEMBER_CUES = new Set([
  'owned',
  'owner',
  'assigned',
  'assign',
  'assignee',
  'belonging',
  'belongs',
  'created',
  'creator',
  'handled',
  'managed',
  'run',
  'led',
  'reviewed',
  'reviewer',
  'responsible',
  'taken',
  'claimed',
  'held',
])

/** Preferred number field when a query compares without naming one ("deals over 10k"). */
export const NUMBER_FIELD_HINTS = [
  'amount',
  'value',
  'price',
  'total',
  'revenue',
  'cost',
  'budget',
  'qty',
  'quantity',
  'count',
  'estimate',
  'score',
  'size',
]

/** Preferred date field for windows and "overdue" ("closing next week", "due today"). */
export const DATE_FIELD_HINTS = ['due', 'deadline', 'close', 'end', 'expiry', 'expires', 'date', 'start', 'created']

/**
 * Everyday names for common fields: a field whose title has the key word is also found by these
 * ("units" → Qty, "deadline" → Due date, "rep" → Owner). Lower quality than the title itself.
 */
export const FIELD_SYNONYMS: Record<string, string[]> = {
  qty: ['quantity', 'units', 'stock', 'inventory', 'count', 'on hand', 'available', 'in stock', 'level', 'stock level'],
  quantity: ['qty', 'units', 'stock', 'count', 'on hand', 'available', 'stock level'],
  stock: ['qty', 'quantity', 'units', 'inventory', 'on hand'],
  amount: ['value', 'size', 'worth', 'deal size', 'deal value', 'money', 'total value'],
  value: ['amount', 'worth'],
  price: ['cost', 'rate', 'pricing', 'unit price', 'msrp', 'price point', 'list price', 'sell price'],
  cost: ['price', 'expense', 'spend', 'spent'],
  revenue: ['sales', 'income', 'turnover', 'arr', 'mrr', 'earnings'],
  budget: ['spend', 'allocation'],
  due: ['deadline', 'due date', 'due by', 'eta', 'target date', 'deliver by', 'due on'],
  deadline: ['due', 'due date', 'eta'],
  close: ['closing', 'closed', 'close date', 'closes', 'expected close'],
  start: ['begins', 'starting', 'kickoff', 'starts', 'start date'],
  end: ['finish', 'ends', 'ending', 'end date'],
  restock: ['reorder', 'replenish', 'restocking', 'refill', 'next restock'],
  created: ['added', 'creation', 'submitted', 'opened', 'logged'],
  updated: ['modified', 'changed', 'edited', 'last touched'],
  owner: ['rep', 'sales rep', 'salesperson', 'account owner', 'account manager', 'owned', 'responsible', 'handler'],
  assignee: ['assigned', 'owner', 'responsible', 'handler', 'who', 'dev', 'developer', 'person', 'worker'],
  reporter: ['reported', 'requester', 'submitter'],
  status: ['state', 'stage', 'progress', 'column'],
  stage: ['status', 'phase', 'step', 'pipeline stage', 'pipeline'],
  priority: ['importance', 'urgency', 'severity', 'level', 'rank'],
  estimate: ['effort', 'points', 'story points', 'hours', 'sizing', 'size', 'time estimate'],
  probability: ['likelihood', 'chance', 'chances', 'odds', 'confidence', 'win rate', 'win chance', 'win probability'],
  category: ['type', 'kind', 'group', 'class', 'segment'],
  type: ['kind', 'category'],
  tags: ['labels', 'tag', 'label', 'tagged', 'labelled', 'labeled'],
  email: ['e-mail', 'mail', 'email address'],
  phone: ['mobile', 'cell', 'telephone', 'tel', 'phone number'],
  city: ['town', 'location', 'place'],
  country: ['nation', 'region'],
  company: ['organization', 'organisation', 'account', 'business', 'client'],
  name: ['title', 'called', 'named'],
  title: ['name', 'subject', 'heading'],
  description: ['details', 'notes', 'summary'],
  notes: ['comments', 'remarks', 'description'],
  supplier: ['vendor', 'provider', 'manufacturer', 'maker', 'brand', 'supplied'],
  warehouse: ['location', 'depot', 'site', 'stored', 'store'],
  project: ['initiative', 'workstream', 'epic'],
  referral: ['source', 'lead source', 'channel', 'referred', 'origin', 'came from'],
  labels: ['tags', 'label', 'tag', 'labelled', 'labeled', 'tagged'],
  sku: ['code', 'item code', 'product code', 'part number'],
  archived: ['archive', 'hidden'],
  signed: ['contract signed', 'closed won'],
  active: ['enabled', 'live', 'on'],
  rating: ['stars', 'score'],
  score: ['rating', 'points'],
}

/**
 * State words without a field: "open tasks", "pending", "finished". `open` means "not in a final
 * state" — the select field that has a final option (Done, Closed…); `final` matches those options.
 */
export const OPEN_WORDS = new Set([
  'open',
  'opened',
  'pending',
  'active',
  'remaining',
  'outstanding',
  'unfinished',
  'incomplete',
  'ongoing',
  'current',
  'unresolved',
  'todo',
  'live',
  'in-flight',
])
export const FINAL_OPTIONS = new Set([
  'done',
  'closed',
  'completed',
  'complete',
  'resolved',
  'finished',
  'shipped',
  'delivered',
  'cancelled',
  'canceled',
  'archived',
  'won',
  'lost',
])

const CHECKBOX_ANTONYM_TABLE: Record<string, string[]> = {
  active: ['archived', 'inactive', 'disabled', 'deleted', 'hidden'],
  inactive: ['active', 'enabled', 'live'],
  disabled: ['enabled', 'active'],
  archived: ['active', 'current', 'live'],
  enabled: ['disabled'],
  visible: ['hidden', 'archived'],
  hidden: ['visible', 'shown', 'published'],
  open: ['closed', 'archived', 'done', 'completed'],
  closed: ['open', 'active'],
  incomplete: ['completed', 'complete', 'done', 'finished'],
  pending: ['completed', 'done', 'approved', 'paid'],
  stale: ['active', 'current'],
  expired: ['active', 'valid', 'current'],
  current: ['archived', 'expired'],
  draft: ['published', 'live'],
  discontinued: ['active', 'live', 'enabled', 'available'],
  retired: ['active', 'live', 'enabled'],
  private: ['public', 'published'],
  offline: ['online', 'live'],
}

/** "inactive" → "active", "unpaid" → "paid", "non-billable" → "billable": the word a negation prefix flips. */
function flippedByPrefix(word: string): string | undefined {
  const match = /^(?:non-?|un|in|im|dis|de)([a-z]{4,})$/.exec(word)
  return match ? match[1] : undefined
}

/**
 * Checkbox antonyms: "active tasks" with no Active field means "not Archived"; "inactive products"
 * with an Active field means "Active is unchecked". Any negation-prefixed word ("unpaid", "non-billable")
 * flips the checkbox named by its stem; the table holds the rest.
 */
export const CHECKBOX_ANTONYMS: Record<string, string[] | undefined> = new Proxy(CHECKBOX_ANTONYM_TABLE, {
  get(table, key) {
    if (typeof key !== 'string') return undefined
    const listed = table[key]
    const flipped = flippedByPrefix(key)
    if (!flipped) return listed
    return listed ? [...new Set([...listed, flipped])] : [flipped]
  },
})

/**
 * Superlatives that sort by a kind of field: "newest" → a date field, "priciest" → a price-ish number.
 * The words are the NUMBER/DATE_FIELD_HINTS a field title is matched against, in order.
 */
export const SUPERLATIVE_FIELD_HINTS: Record<string, { kind: 'number' | 'date'; hints: string[] }> = {
  newest: { kind: 'date', hints: ['created', 'date', 'start', 'close', 'due'] },
  oldest: { kind: 'date', hints: ['created', 'date', 'start', 'close', 'due'] },
  latest: { kind: 'date', hints: ['created', 'updated', 'date', 'close', 'due'] },
  earliest: { kind: 'date', hints: ['created', 'date', 'start', 'close', 'due'] },
  soonest: { kind: 'date', hints: ['due', 'deadline', 'close', 'end', 'restock', 'date'] },
  priciest: { kind: 'number', hints: ['price', 'cost', 'amount', 'value', 'total'] },
  costliest: { kind: 'number', hints: ['cost', 'price', 'amount', 'value', 'total'] },
  cheapest: { kind: 'number', hints: ['price', 'cost', 'amount', 'value', 'total'] },
  biggest: { kind: 'number', hints: ['amount', 'value', 'size', 'qty', 'quantity', 'revenue', 'total'] },
  largest: { kind: 'number', hints: ['amount', 'value', 'size', 'qty', 'quantity', 'revenue', 'total'] },
  smallest: { kind: 'number', hints: ['amount', 'value', 'size', 'qty', 'quantity', 'revenue', 'total'] },
}

/**
 * Everyday names for common select options (BRIDGE-style value synonyms): an option titled like the
 * key is also found by these words. "finished tasks" → Done, "stuck" → Blocked, "our wins" → Won.
 */
export const OPTION_SYNONYMS: Record<string, string[]> = {
  'done': ['finished', 'completed', 'complete', 'closed', 'resolved', 'shipped', 'delivered'],
  'complete': ['finished', 'completed', 'done', 'closed'],
  'completed': ['finished', 'done', 'complete', 'closed'],
  'closed': ['finished', 'resolved', 'done'],
  'in progress': ['working', 'started', 'ongoing', 'doing', 'worked on', 'being worked on', 'underway', 'active'],
  'doing': ['working', 'in progress', 'ongoing', 'worked on'],
  'blocked': ['stuck', 'on hold', 'waiting', 'impeded', 'held up', 'blocker'],
  'on hold': ['paused', 'hold', 'parked', 'waiting'],
  'todo': ['to do', 'backlog', 'not started', 'queued', 'unstarted'],
  'to do': ['todo', 'backlog', 'not started', 'queued'],
  'backlog': ['todo', 'to do', 'later', 'icebox'],
  'won': ['wins', 'win', 'closed won', 'successful', 'closed-won'],
  'closed won': ['won', 'wins', 'win'],
  'lost': ['losses', 'loss', 'lose', 'closed lost', 'dead', 'closed-lost'],
  'closed lost': ['lost', 'losses', 'dead'],
  'lead': ['leads', 'prospect', 'prospects', 'new lead'],
  'qualified': ['sql', 'qualified lead'],
  'cancelled': ['canceled', 'dropped', 'abandoned'],
  'canceled': ['cancelled', 'dropped', 'abandoned'],
  'high': ['urgent', 'important', 'critical'],
  'low': ['minor', 'trivial'],
  'bug': ['bugs', 'defect', 'defects', 'issue', 'issues'],
  'feature': ['features', 'enhancement', 'feature request'],
  'docs': ['documentation', 'doc'],
  'cold call': ['cold calls', 'cold calling', 'outbound'],
  'website': ['web', 'site', 'online', 'inbound'],
  'event': ['events', 'conference', 'trade show'],
  'partner': ['partners', 'partnership', 'referral partner'],
  'hardware': ['hw'],
  'software': ['sw'],
}

/** "how many hardware units": a count of things on a quantity field is its sum. */
export const QUANTITY_NOUNS = new Set(['units', 'unit', 'pieces', 'pcs', 'items', 'qty', 'quantity', 'stock'])

/** "overdue", "past due", "late": before today on the due-ish date field. */
export const OVERDUE_WORDS: Array<[string[], true]> = [
  [['past', 'due'], true],
  [['overdue'], true],
  [['over', 'due'], true],
  [['late'], true],
  [['behind', 'schedule'], true],
  [['missed', 'deadline'], true],
]
