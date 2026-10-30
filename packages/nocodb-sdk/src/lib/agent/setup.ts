/**
 * A general agent's guided setup: the draft it builds in its own chat before it
 * is turned on. The draft lives in `config.setup` of a disabled agent; finishing
 * writes it into the real config, and turning on clears it.
 */

export type AgentSetupSource = 'describe' | 'template' | 'manual';

/** `day` is every day, `weekday` Monday to Friday. */
export const AGENT_SETUP_DAYS = [
  'day',
  'weekday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type AgentSetupDay = (typeof AGENT_SETUP_DAYS)[number];

export type AgentSetupWhen =
  | { kind: 'schedule'; day: AgentSetupDay; time: string }
  /** Created or updated. The table is the title in the base; unset until someone names it. */
  | { kind: 'record'; table?: string }
  | { kind: 'manual' };

export type AgentSetupShare =
  | { kind: 'chat' }
  | { kind: 'email' }
  | { kind: 'slack'; channel?: string };

export interface AgentSetupDraft {
  name?: string;
  /** An emoji, written to `meta.icon`. */
  icon?: string;
  /** What it should do, in the author's words. Becomes the instructions. */
  job?: string;
  /** Table titles it works with, named in the instructions. */
  reads?: string[];
  /** Needs to change records: editor role and write tools. */
  writes?: boolean;
  /** Needs the web: the web tools. */
  web?: boolean;
  when?: AgentSetupWhen;
  share?: AgentSetupShare;
}

export type AgentSetupQuestion = 'when' | 'table' | 'share' | 'channel';

export interface AgentSetupState {
  source: AgentSetupSource;
  template?: string;
  draft: AgentSetupDraft;
  /** Describe: nothing said yet, the chat waits for the first description. */
  awaiting?: boolean;
  /** `review` once the draft is written into the config, until it is turned on. */
  stage?: 'chat' | 'review';
  /** The setup chat. */
  session_id?: string;
  /** IANA timezone of the person setting it up; schedules run in it. */
  timezone?: string;
}

/** Where a triggered run's final answer goes. Unset is chat: the run's own history. */
export type AgentDelivery =
  | { kind: 'chat' }
  | { kind: 'email'; fk_user_id: string }
  /** Posts through this Slack connection, or the workspace's first when unset. */
  | { kind: 'slack'; channel: string; fk_integration_id?: string };

/** What the setup chat still has to ask, in the order it asks. */
export function agentSetupQuestions(
  draft: AgentSetupDraft | undefined
): AgentSetupQuestion[] {
  const out: AgentSetupQuestion[] = [];
  if (!draft?.when) out.push('when');
  else if (draft.when.kind === 'record' && !draft.when.table) out.push('table');
  if (!draft?.share) out.push('share');
  else if (draft.share.kind === 'slack' && !draft.share.channel)
    out.push('channel');
  return out;
}

export function agentSetupNeed(
  draft: AgentSetupDraft | undefined
): AgentSetupQuestion | null {
  return agentSetupQuestions(draft)[0] ?? null;
}

/** "9:00", "16:30": 24-hour, no leading zero on the hour. */
export function isAgentSetupTime(time: string): boolean {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(time);
}

export function agentSetupCron(day: AgentSetupDay, time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const dow =
    day === 'day'
      ? '*'
      : day === 'weekday'
      ? '1-5'
      : String((AGENT_SETUP_DAYS.indexOf(day) - 1) % 7);
  return `${minute} ${hour} * * ${dow}`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function agentSetupWhenLabel(when: AgentSetupWhen): string {
  if (when.kind === 'manual') return 'Only when asked';
  if (when.kind === 'record')
    return when.table
      ? `When a record changes in ${when.table}`
      : 'When a record changes';
  // Weekday names are capitalised; "day" and "weekday" are not.
  const day =
    when.day === 'day' || when.day === 'weekday'
      ? when.day
      : capitalize(when.day);
  return `Every ${day} at ${when.time}`;
}

/** The label as it reads mid-sentence: "I'll run {phrase}". */
export function agentSetupWhenPhrase(when: AgentSetupWhen): string {
  if (when.kind === 'manual') return 'when someone asks';
  const label = agentSetupWhenLabel(when);
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export function agentSetupShareLabel(share: AgentSetupShare): string {
  if (share.kind === 'chat') return 'Here in chat';
  if (share.kind === 'email') return 'Email to you';
  return share.channel ? `Slack ${share.channel}` : 'Slack';
}

/** "share what I find {phrase}". */
export function agentSetupSharePhrase(share: AgentSetupShare): string {
  if (share.kind === 'chat') return 'here in chat';
  if (share.kind === 'email') return 'by email';
  return share.channel ? `in ${share.channel}` : 'in Slack';
}

/** "#sales" from "sales", "#sales" or " #Sales "; '' for a name Slack refuses. */
export function agentSlackChannel(channel: string): string {
  const name = channel.trim().replace(/^#+/, '').toLowerCase();
  return /^[\p{L}\p{N}_-]{1,80}$/u.test(name) ? `#${name}` : '';
}

/** The quick answers the setup chat offers for a question. */
export function agentSetupWhenChips(table?: string): AgentSetupWhen[] {
  return [
    { kind: 'schedule', day: 'weekday', time: '9:00' },
    { kind: 'schedule', day: 'monday', time: '9:00' },
    { kind: 'record', table },
    { kind: 'manual' },
  ];
}

export function agentSetupShareChips(channel?: string): AgentSetupShare[] {
  return [{ kind: 'chat' }, { kind: 'slack', channel }, { kind: 'email' }];
}

export type AgentSetupTemplateCategory =
  | 'everyone'
  | 'sales'
  | 'ops'
  | 'marketing'
  | 'support';

export const AGENT_SETUP_TEMPLATE_CATEGORIES: readonly AgentSetupTemplateCategory[] =
  ['everyone', 'sales', 'ops', 'marketing', 'support'];

export interface AgentSetupTemplate {
  key: string;
  category: AgentSetupTemplateCategory;
  title: string;
  description: string;
  icon: string;
  job: string;
  when: AgentSetupWhen;
  writes?: boolean;
  web?: boolean;
  isNew?: boolean;
}

export const AGENT_SETUP_TEMPLATES: readonly AgentSetupTemplate[] = [
  {
    key: 'weekly-digest',
    category: 'everyone',
    title: 'Weekly digest',
    description:
      'Sums up what changed in your tables and posts it every Monday.',
    icon: '📰',
    job: 'Every Monday, read what was added or changed in the last 7 days. Write a short digest: what is new, what moved, and what looks stuck. Lead with the three things that matter most.',
    when: { kind: 'schedule', day: 'monday', time: '9:00' },
  },
  {
    key: 'answer-bot',
    category: 'everyone',
    title: 'Answer bot',
    description:
      'Answers questions about your tables and docs whenever someone asks.',
    icon: '💬',
    job: 'Answer questions about the work in this base. Look up the records and documents that hold the answer, quote the values you read, and say plainly when the base does not have it. When someone corrects you, use the correction for the rest of the conversation.',
    when: { kind: 'manual' },
    isNew: true,
  },
  {
    key: 'morning-brief',
    category: 'everyone',
    title: 'Morning brief',
    description:
      'Turns what changed in your tables and docs into a short plan, every weekday morning.',
    icon: '☀️',
    job: 'Every weekday morning, pull together what changed since yesterday in the tables and documents. Write a short plan for the day: what needs attention first, what is due, and what is waiting on someone.',
    when: { kind: 'schedule', day: 'weekday', time: '9:00' },
  },
  {
    key: 'meeting-prep',
    category: 'everyone',
    title: 'Meeting prep',
    description:
      "Every weekday morning, preps today's meetings from your meetings table: the account, open deals and the last notes.",
    icon: '🗓️',
    job: "Every weekday morning, find today's meetings in the table that tracks them. For each one, pull up the account, its open deals and the latest notes, and write a short brief: who is attending, where things stand, and what to ask.",
    when: { kind: 'schedule', day: 'weekday', time: '8:00' },
  },
  {
    key: 'follow-up-drafter',
    category: 'sales',
    title: 'Follow-up drafter',
    description: 'Drafts follow-up emails when a record needs a nudge.',
    icon: '✉️',
    job: 'Every weekday, find records that need a nudge: an open next step and no activity in the last 7 days. Draft a short, friendly follow-up email for each, addressed to its contact. List the drafts for review and never send them.',
    when: { kind: 'schedule', day: 'weekday', time: '10:00' },
  },
  {
    key: 'record-enricher',
    category: 'sales',
    title: 'Record enricher',
    description: 'Fills in missing details on new records from the web.',
    icon: '🔎',
    job: 'When a record is added or changed, fill in the details it is missing, such as website, industry, size and location, from what you find on the web. Only fill empty fields, and say where each value came from.',
    when: { kind: 'record' },
    writes: true,
    web: true,
  },
  {
    key: 'deal-risk-watcher',
    category: 'sales',
    title: 'Deal risk watcher',
    description: 'Flags deals that have stalled and tells the owner why.',
    icon: '📉',
    job: 'Every Monday, go through the open deals and flag the ones that have stalled: no activity in 14 days, a close date that has passed, or a stage that has not moved. For each, say why it looks at risk and who owns it.',
    when: { kind: 'schedule', day: 'monday', time: '9:00' },
  },
  {
    key: 'reorder-alerts',
    category: 'ops',
    title: 'Reorder alerts',
    description:
      'Watches stock levels and drafts purchase orders before you run out.',
    icon: '📦',
    job: "Every weekday, check stock levels against each item's reorder point. For every item at or below it, draft a purchase order line: the item, the quantity to order and the supplier. List them, most urgent first.",
    when: { kind: 'schedule', day: 'weekday', time: '9:00' },
  },
  {
    key: 'data-cleaner',
    category: 'ops',
    title: 'Data cleaner',
    description:
      'Finds duplicates and missing values and fixes them, with a log of every change.',
    icon: '🧹',
    job: 'Every Monday, look for duplicate records and missing values. Fill a missing value only when the right one is clear from the record itself, and list duplicates instead of deleting them. End with a log of every change: the record, the field, the old value and the new one.',
    when: { kind: 'schedule', day: 'monday', time: '9:00' },
    writes: true,
  },
  {
    key: 'campaign-report',
    category: 'marketing',
    title: 'Campaign report',
    description:
      'Every Friday, sums up campaign results and posts them to Slack.',
    icon: '📣',
    job: "Every Friday afternoon, sum up this week's campaign results: what ran, how each did against its goal, and what to change next week. Keep it short and keep the numbers that matter.",
    when: { kind: 'schedule', day: 'friday', time: '16:00' },
  },
  {
    key: 'content-calendar-keeper',
    category: 'marketing',
    title: 'Content calendar keeper',
    description:
      'Reminds owners of upcoming posts and flags anything past due.',
    icon: '📅',
    job: 'Every weekday, check the content calendar. Remind each owner of posts due in the next three days, and flag anything past its date that has not gone out.',
    when: { kind: 'schedule', day: 'weekday', time: '9:00' },
  },
  {
    key: 'ticket-triage',
    category: 'support',
    title: 'Ticket triage',
    description:
      'Tags new requests, sets priority and routes them to the right person.',
    icon: '🎫',
    job: 'When a request comes in or changes, read it and set its tags and priority: urgent for outages and blocked customers, high for broken features, normal otherwise. Assign it to the person who handles that area when the base says who, and add a one-line summary.',
    when: { kind: 'record' },
    writes: true,
  },
  {
    key: 'customer-check-in',
    category: 'support',
    title: 'Customer check-in',
    description:
      'Drafts a check-in for customers who went quiet, ready for review.',
    icon: '🤝',
    job: 'Every Monday, find customers who have gone quiet: no activity in the last 30 days. Draft a short, personal check-in for each from what you know about the account. List the drafts for review and never send them.',
    when: { kind: 'schedule', day: 'monday', time: '10:00' },
  },
];

export function agentSetupTemplate(
  key: string | undefined
): AgentSetupTemplate | undefined {
  return AGENT_SETUP_TEMPLATES.find((t) => t.key === key);
}
