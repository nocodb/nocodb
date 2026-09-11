/** A session IS a run — a conversation or one triggered firing, per `trigger_type`. */

export enum AgentSessionStatus {
  ACTIVE = 'active',
  IN_PROGRESS = 'in_progress',
  /** Parked awaiting approval; `resume_at` carries the deadline. */
  WAITING = 'waiting',
  SUCCESS = 'success',
  ERROR = 'error',
  CANCELLED = 'cancelled',
  /** Suppressed before running — loop guard, or already in progress. */
  SKIPPED = 'skipped',
}

/** Why a firing was suppressed. Surfaced in Activity so skips are never silent. */
export enum AgentSkipReason {
  CHAIN_DEPTH_EXCEEDED = 'chain_depth_exceeded',
  SELF_TRIGGERED = 'self_triggered',
  ALREADY_IN_PROGRESS = 'already_in_progress',
  CONDITION_NOT_MET = 'condition_not_met',
}

export interface AgentSessionType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  fk_agent_id?: string;
  /** Null for triggered sessions — nobody started them. */
  fk_user_id?: string;
  title?: string;

  trigger_type?: string;
  trigger_payload?: Record<string, any>;
  /** How many agent-to-agent hops led here. Guards trigger cycles. */
  chain_depth?: number;

  status?: AgentSessionStatus;
  skip_reason?: AgentSkipReason;
  started_at?: string;
  finished_at?: string;
  /** When a WAITING session should be reconsidered. */
  resume_at?: string;
  /** Side-state — e.g. the paused sandbox id a resumed run reconnects to. */
  meta?: Record<string, any>;

  total_input_tokens?: number;
  total_output_tokens?: number;

  created_at?: string;
  updated_at?: string;
}

/** Session origin for a person talking to the agent — not a trigger node. */
export const AGENT_CHAT_TRIGGER = 'chat';

/**
 * Response to a send. `session` is present only when the send opened one —
 * same contract as the assistant chat's `ChatSendMessageResponseType`.
 */
export interface AgentSendMessageResponseType {
  session?: AgentSessionType;
}

export function isAgentChatSession(
  session: Pick<AgentSessionType, 'trigger_type'>
): boolean {
  return session.trigger_type === AGENT_CHAT_TRIGGER;
}
