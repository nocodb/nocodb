import { generateRandomUuid } from '~/lib/stringHelpers';
import { WorkflowNodeCategory, WorkflowNodeDefinition } from './node';
import type { WorkflowExecutionStatus } from './interface';

export const WORKFLOW_EXECUTION_STATUSES: readonly WorkflowExecutionStatus[] = [
  'queued',
  'running',
  'waiting',
  'paused',
  'completed',
  'error',
  'cancelled',
  'skipped',
];

/**
 * How many trigger hops a chain of writes may take before the next firing is
 * not run. Shared by workflows and agents: one counter covers mixed chains.
 */
export const TRIGGER_MAX_CHAIN_DEPTH = 3;

/** Why a triggered workflow run was recorded without running. */
export enum WorkflowSkipReason {
  /** The event came from this same workflow's own write. */
  SELF_TRIGGERED = 'self_triggered',
  /** The chain of triggered runs reached TRIGGER_MAX_CHAIN_DEPTH. */
  CHAIN_DEPTH_EXCEEDED = 'chain_depth_exceeded',
}

/** Webhook trigger that can hold the request open for a Respond node. */
export const WEBHOOK_TRIGGER_NODE_TYPE = 'core.trigger.webhook';
/** Sends the reply to a webhook trigger's waiting caller. */
export const RESPOND_NODE_TYPE = 'core.flow.respond';

/** Seconds a waiting webhook caller is held open. */
export const WEBHOOK_RESPONSE_TIMEOUT_DEFAULT = 10;
export const WEBHOOK_RESPONSE_TIMEOUT_MAX = 20;

export const WEBHOOK_RESPONSE_STATUS_CODES = [
  200, 201, 202, 204, 400, 401, 403, 404, 405, 409, 422, 429, 500, 503,
] as const;

/**
 * Response headers a Respond node may set; anything else could act on the app's
 * origin for whoever opens the webhook URL (NEL, WWW-Authenticate, cookies, CORS, …).
 */
export const WEBHOOK_RESPONSE_ALLOWED_HEADERS = [
  'cache-control',
  'location',
  'retry-after',
  'etag',
  'last-modified',
  'content-language',
];
/** Custom headers are allowed, except these, which the server owns. */
export const WEBHOOK_RESPONSE_ALLOWED_HEADER_PREFIX = 'x-';
export const WEBHOOK_RESPONSE_RESERVED_X_HEADERS = [
  'x-content-type-options',
  'x-frame-options',
  'x-xss-protection',
  'x-dns-prefetch-control',
  'x-permitted-cross-domain-policies',
  'x-download-options',
  'x-powered-by',
  'x-real-ip',
];
/** Reverse proxies act on these (internal redirects, file serving), so they are refused too. */
export const WEBHOOK_RESPONSE_RESERVED_X_PREFIXES = [
  'x-accel-',
  'x-sendfile',
  'x-lighttpd-',
  'x-forwarded-',
  'x-litespeed-',
];
/** Cache-Control may only keep the reply out of shared caches. */
const WEBHOOK_RESPONSE_CACHE_DIRECTIVES = [
  'no-store',
  'no-cache',
  'private',
  'must-revalidate',
];

export function isAllowedWebhookResponseHeader(
  name: string,
  value?: unknown
): boolean {
  const lower = String(name ?? '')
    .trim()
    .toLowerCase();
  if (!lower) return false;
  if (lower === 'cache-control') {
    return String(value ?? '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
      .every((d) => WEBHOOK_RESPONSE_CACHE_DIRECTIVES.includes(d));
  }
  if (WEBHOOK_RESPONSE_ALLOWED_HEADERS.includes(lower)) return true;
  return (
    lower.startsWith(WEBHOOK_RESPONSE_ALLOWED_HEADER_PREFIX) &&
    !WEBHOOK_RESPONSE_RESERVED_X_HEADERS.includes(lower) &&
    !WEBHOOK_RESPONSE_RESERVED_X_PREFIXES.some((p) => lower.startsWith(p))
  );
}

export function isBlockedWebhookResponseHeader(
  name: string,
  value?: unknown
): boolean {
  return !isAllowedWebhookResponseHeader(name, value);
}

export const GeneralNodeID = {
  TRIGGER: 'core.trigger',
  PLUS: 'core.plus',
  NOTE: 'note',
} as const;

/**
 * Trigger activation types determine how triggers are managed when workflow is published/unpublished
 */
export enum TriggerActivationType {
  NONE = 'none', // Manual triggers - no activation needed
  WEBHOOK = 'webhook', // External webhooks (GitHub, GitLab, etc.)
  CRON = 'cron', // Scheduled/cron-based
  POLLING = 'polling', // Polling-based triggers for services without webhooks
}

/**
 * Trigger test modes determine how a trigger can be tested
 * A trigger can support multiple test modes (array)
 */
export enum TriggerTestMode {
  /** Use sample/mock data for testing (default) */
  SAMPLE_DATA = 'sample_data',
  /** Create temporary webhook URL and wait for real request */
  LISTEN_WEBHOOK = 'listen_webhook',
  /** User must trigger event on external service (GitHub, Stripe, etc.) */
  TRIGGER_EVENT = 'trigger_event',
}

/**
 * Check if a node is a trigger node
 * Trigger nodes include:
 * - core.trigger (generic trigger placeholder)
 * - nocodb.trigger.* (NocoDB-specific triggers)
 * - *.trigger (external service triggers like github.trigger, gitlab.trigger)
 */
export function isTriggerNode(nodeType: string | undefined): boolean {
  if (!nodeType) return false;

  return (
    nodeType === GeneralNodeID.TRIGGER ||
    nodeType.startsWith('nocodb.trigger.') ||
    nodeType.includes('.trigger')
  );
}

export const GENERAL_DEFAULT_NODES: WorkflowNodeDefinition[] = [
  {
    id: GeneralNodeID.PLUS,
    title: 'Add Action / Condition',
    icon: 'ncPlus',
    description: 'Add a new action or condition to the workflow',
    category: WorkflowNodeCategory.ACTION,
    hidden: true,
    ports: [],
  },
  {
    id: GeneralNodeID.TRIGGER,
    title: 'Add Trigger',
    icon: 'ncPlus',
    description: 'Start your workflow',
    category: WorkflowNodeCategory.TRIGGER,
    hidden: true,
    ports: [],
  },
];

const initWorkflowNodes = [
  {
    id: generateRandomUuid(),
    type: GeneralNodeID.TRIGGER,
    position: { x: 250, y: 50 },
    data: {
      title: 'Trigger',
    },
  },
];

export const INIT_WORKFLOW_NODES = initWorkflowNodes;
