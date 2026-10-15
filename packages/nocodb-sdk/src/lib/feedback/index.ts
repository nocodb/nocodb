import type { McpToolSection } from '../mcpToken';

/** Agent feedback reports (REST `POST /api/v3/meta/feedback`, MCP `submitFeedback`). */

export enum FeedbackType {
  BUG = 'bug',
  /** The call reported success but did the wrong thing. */
  SILENT_BUG = 'silent_bug',
  MISSING_CAPABILITY = 'missing_capability',
  CONFUSING_BEHAVIOR = 'confusing_behavior',
  DOCS_GAP = 'docs_gap',
}

export enum FeedbackOrigin {
  USER_REQUEST = 'user_request',
  AGENT_OBSERVED = 'agent_observed',
}

export enum FeedbackDeployment {
  CLOUD = 'cloud',
  ON_PREM = 'on_prem',
}

export enum FeedbackEndpoint {
  API = 'api',
  MCP = 'mcp',
}

/** Always `received`: delivery is best effort and a drop is never reported to the caller. */
export enum FeedbackStatus {
  RECEIVED = 'received',
}

export const FEEDBACK_LIMITS = {
  summary: 120,
  intent: 2000,
  details: 4000,
  suggestion: 4000,
  userQuote: 2000,
  agentName: 100,
  agentModel: 100,
  toolName: 100,
  method: 10,
  path: 500,
  requestId: 100,
  errorMessage: 2000,
  scopeId: 100,
  /** Serialized body cap for the on-prem → cloud ingest route; fits every field at its cap in multi-byte text. */
  ingestBodyBytes: 64 * 1024,
} as const;

export interface FeedbackAgent {
  name?: string;
  model?: string;
}

export interface FeedbackEvidence {
  toolName?: string;
  method?: string;
  path?: string;
  requestId?: string;
  errorMessage?: string;
}

/** What the caller sends. Server-owned `source` fields are not part of it. */
export interface FeedbackPayload {
  source: {
    origin: FeedbackOrigin | `${FeedbackOrigin}`;
    agent?: FeedbackAgent;
  };
  type: FeedbackType | `${FeedbackType}`;
  summary: string;
  intent: string;
  details?: string;
  suggestion?: string;
  /** Required when `source.origin` is `agent_observed`. */
  evidence?: FeedbackEvidence;
  /** `user_request` only. */
  userQuote?: string;
  /** The MCP tool section the issue falls under. */
  area?: McpToolSection | `${McpToolSection}` | 'other';
  /** The MCP tool family, e.g. `fields`, `filters`, or `other`. */
  feature?: string;
}

/** Where the issue happened. Kept only when the caller can access it. */
export interface FeedbackScope {
  workspaceId?: string;
  baseId?: string;
}

/** The request body: the payload plus its scope, which is stored apart from it. */
export type FeedbackSubmitBody = FeedbackPayload & FeedbackScope;

export interface FeedbackClient {
  name: string;
  version?: string;
}

/** `source` as stored, completed by the server. */
export interface FeedbackSource {
  origin: FeedbackOrigin;
  deployment: FeedbackDeployment;
  endpoint: FeedbackEndpoint;
  installationId?: string;
  appVersion: string;
  client?: FeedbackClient;
  agent?: FeedbackAgent;
}

export interface FeedbackResponse {
  feedbackId: string;
  status: FeedbackStatus | `${FeedbackStatus}`;
  /** Only when cloud stored the report and it matched an earlier one. */
  duplicateOf?: string;
}
