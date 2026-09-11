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
}

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
    };

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
}

export const NC_NEW_SESSION = 'NC_SESSION';

/** UI navigation context sent with each chat message. */
export interface ChatUIContext {
  tableId?: string;
  viewId?: string;
  dashboardId?: string;
  documentId?: string;
  recordId?: string;
  recordTitle?: string;
}

export interface ChatSendMessageType {
  content: string;
  files?: ChatAttachmentType[];
  approvals?: Record<string, 'approved' | 'denied'>;
  title?: string;
  /** The user's current UI navigation context (active table/view/dashboard/document). */
  uiContext?: ChatUIContext;
}

export interface ChatSendMessageResponseType {
  session?: ChatSessionType;
}
