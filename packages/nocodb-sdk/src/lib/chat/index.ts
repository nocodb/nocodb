import type { ModelMeta } from '~/lib/v3/record-transform';
import type { ChatEventPayload } from '~/lib/realtime';

export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool',
}

export enum ChatEventAction {
  TOKEN = 'token',
  /** Thinking, streamed like TOKEN. Persisted as a reasoning part, not rendered. */
  REASONING = 'reasoning',
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
  TURN_PROGRESS = 'turn-progress',
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

/**
 * Where a session stands. A person's conversation (`trigger_type = 'chat'`)
 * stays open across turns and this reflects its latest one; a triggered firing
 * is one session that opens, runs and closes.
 */
export enum ChatSessionStatus {
  ACTIVE = 'active',
  IN_PROGRESS = 'in_progress',
  /** Parked on a tool approval, for as long as the person takes. */
  WAITING = 'waiting',
  SUCCESS = 'success',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

/** `trigger_type` of a session a person started, as opposed to a trigger node. */
export const CHAT_TRIGGER_TYPE = 'chat';

export interface ChatSessionMetaType {
  trigger?: {
    payload?: Record<string, any>;
    depth?: number;
  };
  turnSummaries?: Array<{
    agent: string;
    summary: string;
    completed: string[];
    remaining: string[];
  }>;
  /** The session's paused compute instance, resumed by the next turn. */
  computeId?: string;
  /**
   * The app-build sandbox running RIGHT NOW, so a Stop on any instance can kill
   * it by id. Separate from `computeId`, which is the chat analyst's PAUSED
   * compute — a build session can run a chat turn concurrently.
   */
  buildComputeId?: string;
  /** Set by a user Stop, so the build turn reports "stopped", not "failed". */
  buildAborted?: boolean;
  /**
   * Hash of the `nocodb_agent` prompt currently running. A tunnel blip can make
   * the sandbox re-send an identical request; without this the same schema
   * mutation would be applied twice.
   */
  buildSchemaPromptHash?: string;
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
  /**
   * Why the sandbox never came up, when it didn't.
   *
   * The boot runs after the session row exists, so a failure has somewhere to
   * be recorded — without this a failed boot is indistinguishable from one
   * still in progress.
   */
  bootError?: string;
  /**
   * Set while an App Factory session is archived: its sandbox is gone and this
   * is where the work that was in it went. Cleared when the session resumes.
   */
  factoryArchive?: {
    /** Bundle key holding the patch and every untracked file. */
    hash: string;
    fileCount: number;
    archivedAt: string;
  };
  /** The pull request on this session's branch, resolved from the host each turn. */
  factoryPullRequest?: FactoryPullRequest;
}

/**
 * One item on the agent's plan for the current task.
 *
 * Written by the `todo_write` tool and carried on that tool call's block, so
 * the frontend renders the plan from the transcript it already has rather than
 * needing a second channel for it.
 */
export interface FactoryTodo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/** What an App Factory session was started from. */
export enum FactorySourceKind {
  PROMPT = 'prompt',
  BRANCH = 'branch',
  PR = 'pr',
  ISSUE = 'issue',
}

/** The repository behind a code project. */
export interface FactoryRepoType {
  id?: string;
  fk_workspace_id?: string;
  /** The code project — one repo per base. */
  base_id?: string;
  fk_integration_id?: string;
  provider_repo_id?: string;
  full_name?: string;
  remote_url?: string;
  default_branch?: string;
  is_private?: boolean;
  enabled?: boolean;
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

/** A repository the connection can reach, whether or not it is set up here. */
export interface FactoryAvailableRepo {
  providerRepoId: string;
  fullName: string;
  remoteUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  description?: string;
  /** Whether a code project in this workspace already uses it. */
  configured: boolean;
}

/** A branch, pull request or issue a session can start from. */
export interface FactorySourceOption {
  kind: FactorySourceKind;
  /** Branch name, or the PR / issue number as text. */
  ref: string;
  label: string;
  sub?: string;
}

/**
 * All three source kinds for a repo, in one response.
 *
 * The picker always shows the three together, so fetching them separately cost
 * three round trips — and three provider calls — per keystroke burst.
 */
export interface FactorySourceBundle {
  branch: FactorySourceOption[];
  pr: FactorySourceOption[];
  issue: FactorySourceOption[];
}

/**
 * `archived` is a pause, not an end: the sandbox is released and the session's
 * uncommitted work is stored, so resuming rebuilds a checkout and carries on.
 */
export type FactorySessionStatus =
  | 'starting'
  | 'running'
  | 'idle'
  | 'archived'
  | 'dead';

/**
 * A session as the sidebar lists it.
 *
 * `status` is derived from the stored row, not from the sandbox: asking the
 * compute provider once per row would make opening a list an N-call operation.
 */
export interface FactorySessionSummary {
  id: string;
  title?: string;
  status: FactorySessionStatus;
  repo?: { id: string; full_name: string };
  updated_at?: string;
  /**
   * Set on a spawned agent: the session that started it. The sidebar nests
   * these under their parent instead of listing them alongside real sessions.
   *
   * Only agents still running are listed — a finished one is part of the
   * transcript, not something to navigate to.
   */
  parent_session_id?: string | null;
  /** The agent's role, e.g. `explorer`. Absent on a user's own session. */
  agent_role?: string | null;
}

/**
 * Whether a session's turn is actually running, asked for on open and on
 * reconnect. A socket that dropped mid-turn leaves the client believing a turn
 * is live forever; this is how it finds out otherwise.
 */
export interface FactoryStreamState {
  status: 'idle' | 'streaming' | 'failed';
  /** Why it failed, when the turn died without reporting one itself. */
  error?: string;
  /**
   * Highest seq in the journal — the client resumes live dedup from here.
   *
   * Without these two a reader that arrives mid-turn sees only what streams
   * after it connected: the transcript is written when the turn ends, so
   * everything before the moment it opened is simply missing.
   */
  lastSeq?: number;
  /** Journaled events after `sinceSeq`, in emit order, for replay. */
  events?: ChatEventPayload[];
}

/** How a file in the checkout differs from HEAD, as `git status` reports it. */
export type FactoryFileStatus = 'modified' | 'added' | 'deleted' | 'untracked';

/** One file in the session's checkout. */
export interface FactoryFileEntry {
  /** Repo-relative, always — the sandbox path is not the user's business. */
  path: string;
  /** Absent when the file is unchanged against HEAD. */
  status?: FactoryFileStatus;
}

/** One command run in the session's checkout, as the terminal shows it. */
export interface FactoryExecResult {
  /** Combined stdout and stderr, in the order the shell produced them. */
  output: string;
  exitCode: number;
  /** Cut off at the output cap — what is shown is the head of it. */
  truncated: boolean;
  /** Where it ran, repo-relative. Empty string is the checkout root. */
  cwd: string;
}

/** A file's contents, as the editor gets them. */
export interface FactoryFile {
  path: string;
  content: string;
  size: number;
  /** Not text: there is nothing to show and nothing to edit. */
  binary: boolean;
  /** Only the head of the file came back, so saving it would truncate it. */
  truncated: boolean;
  /**
   * Hash of what was read. Sent back on save so an edit that raced the agent
   * is refused rather than silently overwriting its work.
   */
  hash: string;
}

/**
 * A changed file's two sides, for the diff viewer.
 *
 * Both sides are sent rather than a unified patch: the viewer is the same
 * Monaco the file reader uses, and it wants two documents to align, not a
 * patch it would have to apply first.
 */
export interface FactoryFileDiff {
  path: string;
  status: FactoryFileStatus;
  /** The file as the session found it. Empty when the session added it. */
  original: string;
  /** The file as it stands now. Empty when the session deleted it. */
  modified: string;
  /** Not text on one side or both — there is nothing to line up. */
  binary: boolean;
  /** A side came back capped, so what is shown is the head of the file. */
  truncated: boolean;
  /**
   * Lines added and removed, as git counts them.
   *
   * Counted over the whole file even when a side was capped, which a count
   * taken from the two strings could not do.
   */
  additions?: number;
  deletions?: number;
}

/** A port something inside a session's sandbox is listening on. */
export interface FactoryPort {
  port: number;
  /** The process holding it, when `ss` could name one. */
  process?: string;
}

/**
 * Where a browser can reach a port in the sandbox.
 *
 * A public origin, not anything resolvable inside the sandbox: the app is
 * served from there but runs in the user's own browser.
 */
export interface FactoryPreview {
  port: number;
  url: string;
}

/** A pull request open on a session's branch. */
export interface FactoryPullRequest {
  number: number;
  url: string;
  title?: string;
  /** `open`, `closed`, or `merged` once the host reports it merged. */
  state?: 'open' | 'closed' | 'merged';
  /** The head branch it was opened from — this session's working branch. */
  branch?: string;
  /** When this was last resolved from the host. */
  checkedAt?: string;
}

/** The session row as stored, plus the repository it is pinned to. */
export interface FactorySessionView extends ChatSessionType {
  repo?: { id: string; full_name: string };
}

/** Archive outranks the row's status: the row keeps whatever its last turn ended on. */
export function factorySessionStatus(
  session?: Pick<ChatSessionType, 'status' | 'meta'>
): FactorySessionStatus {
  if (session?.meta?.factoryArchive) return 'archived';

  switch (session?.status) {
    case ChatSessionStatus.IN_PROGRESS:
      return 'running';
    case ChatSessionStatus.ERROR:
    case ChatSessionStatus.CANCELLED:
      return 'dead';
    default:
      return 'idle';
  }
}

export interface ChatSessionType {
  id?: string;
  title?: string;
  fk_workspace_id: string;
  /** Absent on an App Factory session — those are pinned to a repo, not a base. */
  base_id?: string | null;
  /** Absent on a triggered session — nobody started it. */
  fk_user_id?: string;
  /** The agent this session belongs to; absent means the assistant. */
  fk_agent_id?: string | null;
  /** `'chat'` for a person; a trigger node id for a firing. */
  trigger_type?: string;
  status?: ChatSessionStatus;
  /** The App Factory repo this session runs against; absent on a normal chat. */
  fk_factory_repo_id?: string | null;
  source_kind?: FactorySourceKind;
  /** Branch name, or the PR / issue number as text. */
  source_ref?: string;
  /** Set on a spawned agent's session: the conversation that started it. */
  fk_parent_session_id?: string | null;
  /** The spawned agent's role, e.g. `explorer`. Absent on a user's session. */
  agent_role?: string | null;
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
  /**
   * A write's before-state: the touched fields as they were, or the deleted
   * rows.
   */
  previous?: Array<{
    id: string | number;
    id_fields?: Record<string, unknown>;
    fields: Record<string, unknown>;
  }>;
}

export type ChatContentBlock =
  | {
      type: 'text';
      text: string;
      visibility?: ChatToolVisibility;
      agent?: string;
    }
  | {
      /** The model's reasoning for a step, kept with the turn; never shown or replayed. */
      type: 'reasoning';
      text: string;
      agent?: string;
    }
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

/**
 * How the user resolved a paused tool call. A bare `'approved'`/`'denied'` for
 * an approval gate (dangerous tools); the object form also carries `input` to
 * merge into the tool's arguments on resume (input tools like `import_file`,
 * whose card returns a config). One shape for both, so every approval and
 * input feature rides the same resume path.
 */
export type ChatApprovalDecision =
  | 'approved'
  | 'denied'
  | { decision: 'approved' | 'denied'; input?: Record<string, unknown> };

export interface ChatSendMessageType {
  content: string;
  files?: ChatAttachmentType[];
  approvals?: Record<string, 'approved' | 'denied'>;
  title?: string;
  /** New sessions only: the agent to chat with. An existing session keeps its agent. */
  agentId?: string;
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
