import { NotificationType, UserType } from '~/lib/Api';
import { ChatEventAction } from '~/lib/chat';
import type {
  ChatAttachmentType,
  ChatContentBlock,
  ChatMessageType,
  ChatSessionType,
  ChatToolProgress,
} from '~/lib/chat';

export enum EventType {
  HANDSHAKE = 'handshake',
  CONNECTION_WELCOME = 'connection-welcome',
  CONNECTION_ERROR = 'connection-error',
  NOTIFICATION = 'notification',
  NOTIFICATION_EVENT = 'event-notification',
  USER_EVENT = 'event-user',
  DATA_EVENT = 'event-data',
  META_EVENT = 'event-meta',
  COMMENT_EVENT = 'event-comment',
  DASHBOARD_EVENT = 'event-dashboard',
  WIDGET_EVENT = 'event-widget',
  SCRIPT_EVENT = 'event-script',
  TEAM_EVENT = 'event-team',
  WORKFLOW_EVENT = 'event-workflow',
  WORKFLOW_EXECUTION_EVENT = 'event-workflow-execution',
  INTERFACE_EVENT = 'event-interface',
  PRESENCE_EVENT = 'event-presence',
  FOCUS_EVENT = 'event-focus',
  CHAT_EVENT = 'event-chat',
  DOCUMENT_EVENT = 'event-document',
  DOCUMENT_COMMENT_EVENT = 'event-document-comment',
  DOCUMENT_SYNC_EVENT = 'event-document-sync',
  SMART_TEXT_EVENT = 'event-smart-text',
  CREDIT_EVENT = 'event-credit',
}

/** Client→server socket events for collaborative doc editing (binary Yjs frames). */
export const DocCollabClientEvents = {
  SYNC: 'document:sync',
  UPDATE: 'document:update',
  AWARENESS: 'document:awareness',
} as const;

/** Room key for a doc's collaborative sync channel. */
export function getDocSyncRoom(
  workspaceId: string,
  baseId: string,
  docId: string
): string {
  return `${EventType.DOCUMENT_SYNC_EVENT}:${workspaceId}:${baseId}:${docId}`;
}

/**
 * Room key for a table's focus-presence channel.
 *
 * Keyed by table, not view, so every surface over one table — grid, expanded
 * record, cards, field-config editor — lands in the same room and their
 * occupants see each other.
 */
export function getFocusRoom(
  workspaceId: string,
  baseId: string,
  tableId: string
): string {
  return `${EventType.FOCUS_EVENT}:${workspaceId}:${baseId}:table:${tableId}`;
}

/** Client→server socket event for emitting a connection's current focus. */
export const FOCUS_UPDATE_EVENT = 'focus:update';

/**
 * Client→server: release a focus room once its last local consumer lets go.
 *
 * Rooms are per-table, so without this browsing N tables leaves N live cursor
 * streams attached to the connection.
 */
export const FOCUS_UNSUBSCRIBE_EVENT = 'focus:unsubscribe';

export interface BaseSocketPayload {
  timestamp: number;
  socketId?: string;
  event?: EventType;
}

export interface ConnectionWelcomePayload extends BaseSocketPayload {
  message: string;
  serverInfo: {
    version: string;
    environment: string;
  };
  user?: UserType;
}

export interface ConnectionErrorPayload extends BaseSocketPayload {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface DataPayload extends BaseSocketPayload {
  id: string;
  action: 'add' | 'update' | 'delete' | 'reorder' | 'bulk';
  payload: Record<string, any>;
  before?: string;
  matchedViewIds?: string[];
  rows?: DataPayload[];
}

export interface CommentPayload extends BaseSocketPayload {
  id: string; // rowId
  action: 'add' | 'update' | 'delete';
  payload: Record<string, any>;
}

export interface DocumentCommentPayload extends BaseSocketPayload {
  id: string; // docId
  action: 'add' | 'update' | 'delete' | 'resolve';
  payload: Record<string, any>;
  /** Absolute, post-mutation comment count for the doc. Self-correcting on the
   *  client (delta is the fallback when absent). Set on add/delete. */
  count?: number;
}

export interface SmartTextPayload extends BaseSocketPayload {
  tableId: string;
  columnId: string;
  rowId: string;
  action: 'update';
  pm: Record<string, any> | null;
  md: string | null;
  mdHash: string | null;
}

export interface MetaPayload<T = any> extends BaseSocketPayload {
  action:
    | 'source_create'
    | 'source_update'
    | 'source_delete'
    | 'source_meta_sync'
    | 'table_create'
    | 'table_update'
    | 'table_permission_update'
    | 'table_delete'
    | 'column_add'
    | 'column_update'
    | 'column_delete'
    | 'view_create'
    | 'view_update'
    | 'view_delete'
    | 'view_restore'
    | 'permission_update'
    | 'filter_create'
    | 'filter_update'
    | 'filter_delete'
    | 'hook_create'
    | 'hook_update'
    | 'hook_delete'
    | 'sort_create'
    | 'sort_update'
    | 'sort_delete'
    | 'view_column_update'
    | 'view_column_refresh' // hide/show all
    | 'row_color_update'
    | 'extension_update'
    | 'extension_create'
    | 'extension_delete'
    | 'extension_restore'
    | 'rls_policy_update'
    | 'document_permission_update'
    | 'date_dependency_update'
    | 'date_dependency_delete'
    | 'view_section_create'
    | 'view_section_update'
    | 'view_section_delete'
    | 'base_section_create'
    | 'base_section_update'
    | 'base_section_delete'
    | 'automation_section_create'
    | 'automation_section_update'
    | 'automation_section_delete'
    | 'record_template_create'
    | 'record_template_update'
    | 'record_template_delete'
    | 'table_sync_create'
    | 'table_sync_update'
    | 'table_sync_delete'
    | 'app_sync_create'
    | 'app_sync_update'
    | 'app_sync_delete';
  payload: T;
  baseId?: string;
}

export interface UserEventPayload<T = any> extends BaseSocketPayload {
  action:
    | 'base_update'
    | 'base_user_add'
    | 'base_user_remove'
    | 'base_user_update'
    | 'workspace_update'
    | 'workspace_user_add'
    | 'workspace_user_remove'
    | 'workspace_user_update'
    | 'base_meta_reload';
  payload: T;
  baseId?: string;
  workspaceId?: string;
}

export interface NotificationPayload extends BaseSocketPayload {
  action: 'create';
  payload: Partial<NotificationType>;
}

export enum PresencePageType {
  TABLE = 'table',
  AUTOMATION = 'automation',
  DASHBOARD = 'dashboard',
  SCRIPT = 'script',
  DOCUMENT = 'document',
  /** Settings, base home — a page with no addressable resource. Renders as "Active". */
  OTHER = 'other',
}

/**
 * A user as carried on realtime presence / focus payloads. Only `id` is
 * guaranteed — name, email and avatar (`meta`) may be absent depending on the
 * source (e.g. a focus broadcast derives identity from the JWT). Receivers
 * resolve the canonical avatar/colour from the base-presence list keyed by `id`.
 */
export interface RealtimeUser {
  id: string;
  email?: string;
  display_name?: string;
  meta?: Record<string, any> | null;
}

/**
 * Where a collaborator is, at whatever detail the recipient is entitled to.
 *
 * - **located** — `id` (and optionally `viewId`) present: the recipient can reach it
 * - **typed** — `type` only: the recipient cannot access this resource
 * - **active** — the whole `resource` is absent: there is no addressable resource
 *
 * Server→client frames broadcast to the base room never carry `id`; the located tier is
 * emitted into access-scoped rooms instead. See the tiering in `NocoPresence`.
 */
export interface PresenceResource {
  id?: string;
  type: PresencePageType;
  viewId?: string;
}

export interface PresenceAnnouncePayload extends BaseSocketPayload {
  action: 'announce';
  user: RealtimeUser;
  resource?: PresenceResource;
}

/**
 * Client→server: liveness plus the sender's current location.
 *
 * Also broadcast server→client (identity only, no `resource`) when a heartbeat did NOT
 * change location — receivers expire a collaborator they have not heard from within
 * their own timeout, so a stationary user needs *something* on the wire to stay alive.
 */
export interface PresenceHeartbeatPayload extends BaseSocketPayload {
  action: 'heartbeat';
  user: {
    id: string;
  };
  resource?: PresenceResource;
}

/**
 * Server-side batched form of the heartbeat relay: the ids of users whose
 * heartbeats arrived in the room since its last flush. Liveness only —
 * receivers refresh `lastSeen` for ids they already track; an unknown id is
 * introduced by its own announce, never by this.
 */
export interface PresenceHeartbeatBatchPayload extends BaseSocketPayload {
  action: 'heartbeat-batch';
  userIds: string[];
}

export interface PresenceLocationChangePayload extends BaseSocketPayload {
  action: 'location-change';
  user: {
    id: string;
  };
  resource?: PresenceResource;
}

export interface PresenceLeavePayload extends BaseSocketPayload {
  action: 'leave';
  user: {
    id: string;
  };
}

export interface PresenceBatchPayload extends BaseSocketPayload {
  action: 'batch';
  users: Array<{
    user: RealtimeUser;
    resource?: PresenceResource;
    lastSeen: number;
  }>;
}

export type PresencePayload =
  | PresenceAnnouncePayload
  | PresenceHeartbeatPayload
  | PresenceHeartbeatBatchPayload
  | PresenceLocationChangePayload
  | PresenceLeavePayload
  | PresenceBatchPayload;

/**
 * A connection's current focus within a table. Typed by `type` so additional
 * focus kinds can be added without a protocol change. `null` means the
 * connection has no focus (cleared selection / left the table).
 *
 * - `cell` — a grid cell. `editing` = actively typing; `uploading` = attachment
 *   upload in flight.
 * - `record` — the connection has the record open (expanded form / card).
 *   `editing` = unsaved changes; `typing: 'comment'` = composing a comment.
 * - `field` — the connection has the field's config editor (column edit
 *   dropdown) open.
 */
export type FocusValue =
  | {
      type: 'cell';
      rowPk: string;
      fieldId: string;
      /**
       * View the cursor sits in — grids hide cell cursors from other views.
       * Absent on view-agnostic frames (attachment upload).
       */
      viewId?: string;
      editing?: boolean;
      uploading?: boolean;
      /**
       * Record open in the expanded-form SIDE PANEL, which — unlike the modal —
       * leaves the grid interactive. So a connection holds a cursor and an open
       * record at the same time, and they may be different rows.
       *
       * Rides on the cell frame rather than being a second focus: one frame per
       * connection is what the presence tiering's `.except()` routing depends on.
       * The modal path still emits a plain `record` focus.
       */
      openRecordPk?: string;
    }
  | {
      type: 'record';
      rowPk: string;
      editing?: boolean;
      typing?: 'comment';
    }
  | {
      type: 'field';
      fieldId: string;
    }
  | null;

/** Server→client: a single connection's focus changed. */
export interface FocusUpdatePayload extends BaseSocketPayload {
  action: 'focus';
  /** Per-connection id (socket id) — distinct from user id. */
  presenceId: string;
  user: RealtimeUser;
  focus: FocusValue;
}

/** Server→client: a connection left the view / disconnected; drop its focus. */
export interface FocusLeavePayload extends BaseSocketPayload {
  action: 'focus-leave';
  presenceId: string;
  user: RealtimeUser;
}

/** Server→client: bootstrap snapshot of all current focuses, sent on subscribe. */
export interface FocusBatchPayload extends BaseSocketPayload {
  action: 'focus-batch';
  focuses: Array<{
    presenceId: string;
    user: RealtimeUser;
    focus: FocusValue;
  }>;
}

export type FocusPayload =
  | FocusUpdatePayload
  | FocusLeavePayload
  | FocusBatchPayload;

export interface ChatEventPayload extends BaseSocketPayload {
  action: ChatEventAction;
  sessionId: string;
  /**
   * Monotonic per-turn sequence, for replay dedup — drop anything <= the
   * highest seq already applied for the same turnId. Absent on HEARTBEAT and
   * session lifecycle events.
   */
  seq?: number;
  /** Turn the event belongs to; seq numbering restarts per turn. */
  turnId?: string;
  // action: 'token'
  content?: string;
  // action: 'tool-start' | 'tool-call'
  toolCallId?: string;
  name?: string;
  args?: any;
  // action: 'tool-progress' — live step update from a long-running tool
  progress?: ChatToolProgress;
  // action: 'tool-result'
  output?: any;
  isError?: boolean;
  // action: 'message-done'
  workspaceId?: string;
  messageId?: string;
  /** Final ordered content blocks — single source of truth for the persisted message. */
  parts?: ChatContentBlock[];
  /** Files the assistant generated this turn (sandbox output → storage). */
  createdFiles?: ChatAttachmentType[];
  /** Braintrust span ID — used for thumbs up/down feedback submission. */
  btSpanId?: string | null;
  /** Follow-up suggestions generated after the assistant response */
  followUps?: string[];
  // action: 'error'
  error?: string;
  /** Machine-readable `NcErrorType` when the failure has one (e.g.
   * `ERR_CREDITS_EXHAUSTED`) — the UI branches on it for recovery CTAs. */
  code?: string;
  /** Structured payload of the coded error (remaining balance, period end). */
  details?: Record<string, unknown>;
  // action: 'session-create' | 'session-update' | 'session-delete'
  session?: ChatSessionType;
  // action: 'user-message'
  message?: ChatMessageType;
  // action: 'agent-switch' — multi-agent system
  /** Current active agent name */
  agent?: string;
  /** Human-readable status label (e.g. "Building table structure...") */
  agentLabel?: string;
  /** Tool visibility level for filtering in the UI */
  visibility?: 'hidden' | 'action' | 'data' | 'ui';
}

/**
 * Server-derived state of a chat session's in-flight turn, served by
 * `GET .../chat/sessions/:sessionId/stream-state` — lets a client that
 * reloaded or reconnected mid-stream replay the partial turn and tell a slow
 * turn from a dead one.
 */
export enum ChatStreamStatus {
  IDLE = 'idle',
  /** Job is queued but has not started emitting yet. */
  QUEUED = 'queued',
  STREAMING = 'streaming',
  FAILED = 'failed',
}

export interface ChatStreamStateType {
  status: ChatStreamStatus;
  /** Turn the journal belongs to, if any. */
  turnId?: string | null;
  /** Highest seq in the journal — client resumes live dedup from here. */
  lastSeq?: number;
  /** Journaled events after `sinceSeq`, in emit order, for replay. */
  events?: ChatEventPayload[];
  error?: string;
  /**
   * Set when this FAILED response persisted the crashed turn's partial work
   * as a durable assistant message — render it instead of promoting the
   * transient streaming state.
   */
  draftMessage?: ChatMessageType;
}

export type SocketEventPayload =
  | ConnectionWelcomePayload
  | ConnectionErrorPayload
  | DataPayload
  | MetaPayload
  | CommentPayload
  | DocumentCommentPayload
  | NotificationPayload
  | PresencePayload
  | FocusPayload
  | ChatEventPayload
  | SmartTextPayload;

// Type mapping for event types to their corresponding payloads
export type SocketEventPayloadMap = {
  [EventType.NOTIFICATION_EVENT]: NotificationPayload;
  [EventType.CONNECTION_WELCOME]: ConnectionWelcomePayload;
  [EventType.CONNECTION_ERROR]: ConnectionErrorPayload;
  [EventType.DATA_EVENT]: DataPayload;
  [EventType.META_EVENT]: MetaPayload;
  [EventType.USER_EVENT]: UserEventPayload;
  [EventType.COMMENT_EVENT]: CommentPayload;
  [EventType.DOCUMENT_COMMENT_EVENT]: DocumentCommentPayload;
  [EventType.PRESENCE_EVENT]: PresencePayload;
  [EventType.FOCUS_EVENT]: FocusPayload;
  [EventType.CHAT_EVENT]: ChatEventPayload;
  [EventType.SMART_TEXT_EVENT]: SmartTextPayload;
  [key: string]: BaseSocketPayload;
};

// Helper type to get payload type for a specific event
export type PayloadForEvent<T extends EventType> = SocketEventPayloadMap[T];
