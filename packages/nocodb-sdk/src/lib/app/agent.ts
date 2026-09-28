/**
 * The in-app AI assistant — the chat widget a published app serves to its own end
 * users.
 *
 * Deliberately NOT the console chat (`lib/chat`): that stack authorizes against a
 * BASE role and streams over the console socket, an app runner may hold no base
 * role at all, and the app origin's CSP (`connect-src 'self'`) cannot reach that
 * socket. The two share only the AI integration and the credit meter.
 *
 * The agent's entire tool surface is the app's own published actions, narrowed to
 * the caller's capability grants and invoked through the SAME dispatch path as
 * `ctx.actions` — so the agent holds no authority the caller does not.
 */

/**
 * How the assistant presents itself. The app author picks the DEFAULT here; the
 * person using the app can switch at runtime and that choice is remembered
 * per-browser, so this is a starting point rather than a lock.
 */
export enum AppAgentMode {
  /** Floating button, bottom-right. Opens a compact panel. */
  FAB = 'fab',
  /** Docked to the right, reflowing the app beside it. */
  PANE = 'pane',
}

/** Per-app agent configuration, persisted at `App.meta.agent`. */
export interface AppAgentConfig {
  /**
   * Master switch. Absent/false = no widget is injected and the agent routes
   * refuse. There is no second gate: an enabled assistant is available to
   * everyone who can open the app, doing only what that person's own capability
   * grants already allow.
   */
  enabled?: boolean;
  /** Widget header label. Defaults to the app title. */
  title?: string;
  /** Assistant persona, appended to the platform's own system prompt. */
  instructions?: string;
  /** First message rendered before the user has said anything. */
  greeting?: string;
  /** Prompt chips shown on the empty state. */
  starters?: string[];
  /** Presentation the app opens with. Defaults to FAB. */
  mode?: AppAgentMode;
}

/**
 * Limits on the author-supplied config. Enforced SERVER-SIDE, in
 * `sanitizeAppAgentConfig` on the app-update path — the console's `:maxlength`
 * is only the courtesy copy, and `instructions` is concatenated into the system
 * prompt of every turn, so an oversized value is a recurring cost on the app
 * owner's workspace rather than a one-off.
 */
export const APP_AGENT_MAX_STARTERS = 4;
export const APP_AGENT_MAX_INSTRUCTIONS = 10000;
export const APP_AGENT_MAX_TITLE = 120;
export const APP_AGENT_MAX_STARTER = 200;
export const APP_AGENT_MAX_GREETING = 500;

/**
 * Longest instruction one turn may carry. The caller is an app END USER and the
 * payer is the app owner's workspace, so the prompt's size is not the sender's
 * problem to bound — it has to be bounded here.
 */
export const APP_AGENT_MAX_MESSAGE = 8000;

/** Terminal + progress states of one agent turn. */
export enum AppAgentTurnStatus {
  STREAMING = 'streaming',
  DONE = 'done',
  ERROR = 'error',
  ABORTED = 'aborted',
}

export enum AppAgentMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

/**
 * Lifecycle of one tool call.
 *
 * There is no approval state: the assistant's tools ARE the app's actions, and
 * every call is already gated server-side by the caller's capability grant, the
 * APP_USE permission and the action's own input schema. A per-call confirmation
 * on top of that asked the person to re-authorise what they were already
 * authorised to do — and made bulk work (a dozen records) unusable.
 */
export enum AppAgentToolStatus {
  RUNNING = 'running',
  DONE = 'done',
  ERROR = 'error',
}

/** One rendered block of an assistant message. */
export type AppAgentContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool';
      /** Tool-call id, as the model issued it. */
      id: string;
      /** The dotted action id this call dispatches. */
      actionId: string;
      /** Human label, from `AppAction.title`. */
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
  /** Absent until the first turn names it — see AppAgentTurnResponse.title. */
  title?: string;
  message_count?: number;
  created_at?: string;
  updated_at?: string;
}

/** `POST …/_agent/sessions/:id/rename` */
export interface AppAgentRenameRequest {
  title: string;
}

/**
 * Stream frame, SSE `data:` payload. Every frame carries `seq` — monotonic and
 * contiguous within a turn — so a reconnecting client resumes with
 * `Last-Event-ID` instead of replaying the turn.
 */
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
      /**
       * TERMINAL. Emitted wherever a turn stops — including the ones that stop
       * before the model is reached (no AI provider, no credits), because the
       * widget's composer unlocks on this frame and nothing else.
       */
      type: 'turn_end';
      seq: number;
      status: AppAgentTurnStatus;
      /**
       * The persisted assistant row. Absent when the turn ended before one was
       * created — there is nothing to reconcile against, and the `error` frame
       * already carries what to show.
       */
      messageId?: string;
      parts: AppAgentContentBlock[];
    }
  | { type: 'error'; seq: number; message: string; code?: string };

/**
 * A frame before the producer stamps its `seq`.
 *
 * Distributive on purpose: a bare `Omit<Union, 'seq'>` collapses to the keys the
 * variants SHARE (just `type`), which would silently accept a frame with no
 * payload at all. Conditional-over-union keeps each variant whole.
 */
export type AppAgentStreamFrame = AppAgentStreamEvent extends infer T
  ? T extends AppAgentStreamEvent
    ? Omit<T, 'seq'>
    : never
  : never;

/** `POST /api/v1/app/:appId/_agent/turn` request body. */
export interface AppAgentTurnRequest {
  /** Omit to open a new conversation; the response carries the created id. */
  sessionId?: string;
  message: string;
}

/**
 * `POST …/_agent/turn` response. The turn runs detached — the caller opens
 * `GET …/_agent/stream?turnId=` to watch it, so a dropped POST never loses work
 * already in flight.
 */
export interface AppAgentTurnResponse {
  turnId: string;
  sessionId: string;
  /** Echoed so a client can subscribe from the very first frame. */
  sinceSeq: number;
  /**
   * Set only on the turn that names an untitled session, so the sidebar can
   * relabel without refetching. Generated from the first message.
   */
  title?: string;
}

/** `GET /api/v1/app/:appId/_agent/session` — bootstrap for the widget. */
export interface AppAgentBootstrapResponse {
  enabled: boolean;
  config: Pick<
    AppAgentConfig,
    'title' | 'greeting' | 'starters' | 'mode'
  >;
  /** Every conversation this person has with this app, newest first. */
  sessions: AppAgentSessionType[];
  /** The one whose messages are included — the most recent, or a fresh one. */
  session?: AppAgentSessionType;
  messages: AppAgentMessageType[];
  /** Set when a turn is still streaming — the widget reattaches instead of idling. */
  activeTurnId?: string;
}

/** `GET …/_agent/sessions/:id/messages` — switching conversations. */
export interface AppAgentMessagesResponse {
  session: AppAgentSessionType;
  messages: AppAgentMessageType[];
  activeTurnId?: string;
}
