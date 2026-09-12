/**
 * Public type surface of `@nocodb/app-ctx/agent`.
 *
 * Shapes are copied from `packages/nocodb-sdk/src/lib/app/agent.ts` — that file
 * is the source of truth; keep these in lockstep. See `agent-types.ts` for why
 * the status enums are const objects rather than TS `enum`s.
 */

export declare const AppAgentToolStatus: {
  readonly RUNNING: 'running';
  readonly DONE: 'done';
  readonly ERROR: 'error';
};
export type AppAgentToolStatus =
  (typeof AppAgentToolStatus)[keyof typeof AppAgentToolStatus];

export declare const AppAgentTurnStatus: {
  readonly STREAMING: 'streaming';
  readonly DONE: 'done';
  readonly ERROR: 'error';
  readonly ABORTED: 'aborted';
};
export type AppAgentTurnStatus =
  (typeof AppAgentTurnStatus)[keyof typeof AppAgentTurnStatus];

export type AppAgentMessageRole = 'user' | 'assistant';

export declare const AppAgentMode: { readonly FAB: 'fab'; readonly PANE: 'pane' };
export type AppAgentMode = (typeof AppAgentMode)[keyof typeof AppAgentMode];

/** Longest message one turn may carry; the server rejects anything over it. */
export declare const APP_AGENT_MAX_MESSAGE: number;

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

export interface AgentStreamHandle {
  close: () => void;
}

export declare function loadAgentSession(): Promise<AppAgentBootstrapResponse>;

export declare function sendAgentTurn(input: {
  message: string;
  sessionId?: string;
}): Promise<AppAgentTurnResponse>;

export declare function loadAgentMessages(
  sessionId: string,
): Promise<AppAgentMessagesResponse | null>;

export declare function createAgentSession(): Promise<AppAgentSessionType>;

export declare function renameAgentSession(
  sessionId: string,
  title: string,
): Promise<null>;

export declare function deleteAgentSession(sessionId: string): Promise<null>;

export declare function stopAgentTurn(
  turnId: string,
): Promise<{ stopped: boolean }>;

export declare function watchAgentTurn(
  turnId: string,
  handlers: {
    onEvent: (event: AppAgentStreamEvent) => void;
    onClose?: () => void;
    onError?: (message: string) => void;
  },
  opts?: { sinceSeq?: number },
): AgentStreamHandle;
