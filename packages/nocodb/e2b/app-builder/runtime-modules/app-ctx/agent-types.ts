/**
 * Wire shapes for the in-app assistant. Copied from
 * `packages/nocodb-sdk/src/lib/app/agent.ts` rather than imported, for the same
 * reason `index.ts` re-declares the action shapes: this module compiles standalone
 * into every built app's node_modules and must not pull the platform SDK in behind
 * it. THAT file is the source of truth — keep these in lockstep.
 *
 * Enums are `const` objects with a companion union type, not TS `enum`s: an `enum`
 * emits runtime code, so a value compared across the module boundary would depend
 * on two separate emitted objects agreeing.
 */

export const AppAgentToolStatus = {
  RUNNING: 'running',
  DONE: 'done',
  ERROR: 'error',
} as const;

export type AppAgentToolStatus =
  (typeof AppAgentToolStatus)[keyof typeof AppAgentToolStatus];

export const AppAgentTurnStatus = {
  STREAMING: 'streaming',
  DONE: 'done',
  ERROR: 'error',
  ABORTED: 'aborted',
} as const;

export type AppAgentTurnStatus =
  (typeof AppAgentTurnStatus)[keyof typeof AppAgentTurnStatus];

export type AppAgentMessageRole = 'user' | 'assistant';

/** How the assistant presents itself; the author picks the default. */
export const AppAgentMode = { FAB: 'fab', PANE: 'pane' } as const;

/**
 * Longest message one turn may carry. The server rejects anything over this, so
 * the composer caps it rather than sending a request that can only 400.
 */
export const APP_AGENT_MAX_MESSAGE = 8000;
export type AppAgentMode = (typeof AppAgentMode)[keyof typeof AppAgentMode];

export type AppAgentContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool';
      id: string;
      actionId: string;
      label?: string;
      status: AppAgentToolStatus;
      input?: unknown;
      output?: unknown;
      error?: string;
    }
  | { type: 'error'; message: string; code?: string };

export interface AppAgentMessageType {
  id: string;
  role: AppAgentMessageRole;
  content?: string;
  parts?: AppAgentContentBlock[];
  created_at?: string;
}

export interface AppAgentSessionType {
  id: string;
  title?: string;
  message_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type AppAgentStreamEvent =
  | { type: 'turn_start'; seq: number; turnId: string; messageId: string }
  | { type: 'text_delta'; seq: number; delta: string }
  | {
      type: 'tool_start';
      seq: number;
      id: string;
      actionId: string;
      label?: string;
      input?: unknown;
    }
  | {
      type: 'tool_end';
      seq: number;
      id: string;
      status: AppAgentToolStatus;
      output?: unknown;
      error?: string;
    }
  | {
      /** TERMINAL — emitted wherever a turn stops, including before the model. */
      type: 'turn_end';
      seq: number;
      status: AppAgentTurnStatus;
      /** Absent when the turn ended before an assistant row existed. */
      messageId?: string;
      parts: AppAgentContentBlock[];
    }
  | { type: 'error'; seq: number; message: string; code?: string };

export interface AppAgentTurnResponse {
  turnId: string;
  sessionId: string;
  sinceSeq: number;
  /** Present only on the turn that names an untitled session. */
  title?: string;
}

export interface AppAgentBootstrapResponse {
  enabled: boolean;
  config: {
    title?: string;
    greeting?: string;
    starters?: string[];
    mode?: AppAgentMode;
  };
  /** Every conversation this person has with this app, newest first. */
  sessions: AppAgentSessionType[];
  session?: AppAgentSessionType;
  messages: AppAgentMessageType[];
  activeTurnId?: string;
}

export interface AppAgentMessagesResponse {
  session: AppAgentSessionType;
  messages: AppAgentMessageType[];
  activeTurnId?: string;
}
