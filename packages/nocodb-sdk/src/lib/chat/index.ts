import type { ModelMeta } from '~/lib/v3/record-transform';

export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool',
}

export enum ChatEventAction {
  TOKEN = 'token',
  TOOL_START = 'tool-start',
  TOOL_CALL = 'tool-call',
  /** Live step update from a long-running tool (e.g. "Creating page 3/7"). */
  TOOL_PROGRESS = 'tool-progress',
  TOOL_RESULT = 'tool-result',
  MESSAGE_DONE = 'message-done',
  MESSAGE_UPDATE = 'message-update',
  ERROR = 'error',
  SESSION_CREATE = 'session-create',
  SESSION_UPDATE = 'session-update',
  SESSION_DELETE = 'session-delete',
  USER_MESSAGE = 'user-message',
  AGENT_SWITCH = 'agent-switch',
  FOLLOW_UPS = 'follow-ups',
  HEARTBEAT = 'heartbeat',
  STATUS = 'status',
  PREVIEW_READY = 'preview-ready',
}

/** `ChatMessageType.agent` value for messages produced by the App Builder (sandbox build turns). */
export const CHAT_AGENT_APP_BUILDER = 'app_builder';
/**
 * Payload of a TOOL_PROGRESS event — a live step update from a long-running
 * tool call ("Designing table 3: Deals…", "Creating page 2/7: Pipeline").
 * Transient: streamed for UX only, never persisted on the message.
 */
export interface ChatToolProgress {
  label: string;
  current?: number;
  total?: number;
}

export enum ChatToolCallStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  ERROR = 'error',
  AWAITING_APPROVAL = 'awaiting_approval',
  AWAITING_INPUT = 'awaiting_input',
  DENIED = 'denied',
}

export interface ChatSessionMetaType {
  turnSummaries?: Array<{
    agent: string;
    summary: string;
    completed: string[];
    remaining: string[];
  }>;
  /** The session's paused compute instance, resumed by the next turn. */
  computeId?: string;
  /** @deprecated `computeId` since the AI layer stopped calling it a sandbox.
   *  Read-only, so sessions paused before the rename still resolve. */
  sandboxId?: string;
  /**
   * Per-app build continuity for this conversation. One conversation can
   * build/edit any number of apps; each entry tracks the sandbox Claude
   * session to `--resume` and the last draft sha this conversation saw.
   */
  appBuilds?: Record<
    string,
    { claudeSessionId?: string; lastSeenSha?: string }
  >;
  /**
   * Follow-up prompts generated at turn end, persisted so reopening the
   * session serves them from storage instead of re-generating (a model call).
   * `messageId` pins them to the assistant message they were generated for.
   */
  followUps?: {
    messageId: string;
    items: string[];
  };
}

export interface ChatSessionType {
  id?: string;
  title?: string;
  fk_workspace_id: string;
  base_id: string;
  fk_user_id?: string;
  summary?: string;
  total_input_tokens?: number;
  total_output_tokens?: number;
  message_count?: number;
  meta?: ChatSessionMetaType;
  created_at?: string;
  updated_at?: string;
}

export type ChatToolVisibility = 'hidden' | 'action' | 'data' | 'ui';

/**
 * Typed metadata attached to tool_use blocks for frontend rendering.
 * Each tool populates only the fields it needs via its `buildMeta` function.
 */
export interface WebSearchResultMeta {
  title: string;
  url: string;
  publishedDate?: string | null;
  favicon?: string | null;
}

export interface ChatToolMetadata {
  /** Primary model this tool operated on */
  model?: ModelMeta;
  /** modelId → ModelMeta for related models (LTAR, Links, Lookup, Rollup) */
  modelMap?: Record<string, ModelMeta>;
  /** columnId → modelId index for quick column → related model lookup */
  columnModelMap?: Record<string, string>;
  /** Web search/scrape results for ThinkingSection rendering */
  webResults?: WebSearchResultMeta[];
}

export type ChatContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input?: Record<string, any>;
      status: ChatToolCallStatus;
      output?: any;
      is_error?: boolean;
      agent?: string;
      visibility?: ChatToolVisibility;
      metadata?: ChatToolMetadata;
    }
  /** A durable turn failure (e.g. an app build that failed) rendered as an error bubble. */
  | { type: 'error'; text: string }
  /**
   * `@` mentions the user attached to a USER message, persisted verbatim (see
   * {@link ChatMentionRef}) so an approval resume — which can happen long after
   * the turn that created them, even after a reload — can re-derive them by
   * re-reading this message. Never rendered by the UI and never fed to the
   * model as-is: the resolver re-reads every name from the DB and
   * re-authorizes every id at the point of use.
   */
  | { type: 'mention_refs'; refs: ChatMentionRef[] };

export interface ChatAttachmentType {
  id?: string;
  title: string;
  mimetype: string;
  size: number;
  path?: string;
  url?: string;
  signedPath?: string;
  signedUrl?: string;
  icon?: string;
}

/** A published web artifact (see publish_web_artifact) — tracked separately
 *  from ChatMessageType.created_files (nc_chat_artifacts, not a JSON blob
 *  field), so it has a real, stable `id` to mint/serve against. Rendered live
 *  in a sandboxed iframe via a separate, isolated route (chatArtifactRead). */
export interface ChatArtifactType {
  id: string;
  title: string;
  mimetype: string;
  size: number;
  /** Groups versions of the same published project — the root version's own
   *  id, shared by every later version of it. */
  rootId?: string;
  /** 1-based, incrementing per republish of the same project. */
  version?: number;
  /** Share-link id — the page lives at `/nc/artifact/<uuid>`. */
  uuid?: string;
  /** Whether that link serves without sign-in. */
  isPublic?: boolean;
  created_at?: string;
}

export const WEB_ARTIFACT_MIMETYPE = 'text/vnd.nocodb.web-artifact+html';

export interface ChatMessageType {
  id?: string;
  fk_session_id: string;
  role: ChatMessageRole;
  content?: string | null;
  parts?: ChatContentBlock[];
  files?: ChatAttachmentType[];
  created_files?: ChatAttachmentType[];
  artifacts?: ChatArtifactType[];
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  bt_span_id?: string | null;
  created_at?: string;
  uiContextRecord?: { tableId: string; recordId: string; recordTitle?: string };
  /** Producing persona — absent for the assistant, {@link CHAT_AGENT_APP_BUILDER} for build turns. */
  agent?: string;
  /** The app a build turn targeted — set only when `agent` is the App Builder. */
  fk_app_id?: string;
}

export const NC_NEW_SESSION = 'NC_SESSION';

/**
 * What a first-run onboarding build should produce. The landing page's target
 * picker sends this across the origin boundary as `buildScope`; absent or
 * unrecognized means `app`, so a hand-off link minted before this existed keeps
 * working.
 *
 * `website` runs the same phases as `app` and differs only in the brief: its pages
 * are declared public. `interfaces` stops at NocoDB's own interface pages and never
 * reaches the app builder. `workflow` stops at the automation plus the tables it
 * acts on, since the workflow itself is the deliverable.
 */
export const BUILD_SCOPES = [
  'app',
  'website',
  'interfaces',
  'table',
  'form',
  'workflow',
] as const;

export type BuildScope = (typeof BUILD_SCOPES)[number];

export const isBuildScope = (value: unknown): value is BuildScope =>
  typeof value === 'string' && (BUILD_SCOPES as readonly string[]).includes(value);

/** UI navigation context sent with each chat message. */
export interface ChatUIContext {
  tableId?: string;
  viewId?: string;
  dashboardId?: string;
  documentId?: string;
  recordId?: string;
  recordTitle?: string;
  /** The app whose canvas the user is currently viewing — biases build-turn routing. */
  appId?: string;
  appTitle?: string;
  /** First-run onboarding turn — the agent should perform a complete one-shot build. */
  onboarding?: boolean;
  /** What that build should produce. Absent means a full app. */
  buildScope?: BuildScope;
}

export interface ChatSendMessageType {
  content: string;
  files?: ChatAttachmentType[];
  approvals?: Record<string, 'approved' | 'denied'>;
  title?: string;
  /** The user's current UI navigation context (active table/view/dashboard/document). */
  uiContext?: ChatUIContext;
  /** Entities the user @-mentioned in this message. Resolved server-side by id. */
  mentions?: ChatMentionRef[];
}

export interface ChatSendMessageResponseType {
  session?: ChatSessionType;
}

export enum ChatMentionType {
  TABLE = 'table',
  VIEW = 'view',
  FIELD = 'field',
  INTEGRATION = 'integration',
  INTERFACE = 'interface',
  INTERFACE_PAGE = 'interfacePage',
  DASHBOARD = 'dashboard',
  SCRIPT = 'script',
  DOCUMENT = 'document',
}

/**
 * One entity the user pointed at with `@` in a chat message.
 *
 * Persisted on the triggering USER message (a `mention_refs` block in `parts`) so
 * a paused tool-call approval can re-derive it on resume — which can happen long
 * after the turn that created it, even after a reload, by which point nothing else
 * about the original request survives. Every consumer re-resolves and
 * re-authorizes from this raw ref against the caller's live `NcContext`, never
 * trusting a name or a decision cached from the original turn.
 *
 * Carries NO display name on purpose: the server re-resolves every name from `id`,
 * so a client-supplied string can never reach the agent's prompt.
 */
export interface ChatMentionRef {
  type: ChatMentionType;
  id: string;
  /** Table id for view/field; interface id for interfacePage. */
  parentId?: string;
}

/** Max mentions carried by one message — enforced client- and server-side. */
export const CHAT_MENTION_LIMIT = 20;
