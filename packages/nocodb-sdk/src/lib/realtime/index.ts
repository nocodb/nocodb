import { NotificationType, UserType } from '~/lib/Api';
import { ChatEventAction } from '~/lib/chat';
import type { ChatContentBlock, ChatMessageType, ChatSessionType } from '~/lib/chat';

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
  PRESENCE_EVENT = 'event-presence',
  CHAT_EVENT = 'event-chat',
  DOCUMENT_EVENT = 'event-document',
  DOCUMENT_COMMENT_EVENT = 'event-document-comment',
}

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
  action: 'add' | 'update' | 'delete' | 'reorder';
  payload: Record<string, any>;
  before?: string;
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
    | 'permission_update'
    | 'filter_create'
    | 'filter_update'
    | 'filter_delete'
    | 'sort_create'
    | 'sort_update'
    | 'sort_delete'
    | 'view_column_update'
    | 'view_column_refresh' // hide/show all
    | 'row_color_update'
    | 'extension_update'
    | 'extension_create'
    | 'extension_delete'
    | 'rls_policy_update'
    | 'document_permission_update'
    | 'date_dependency_update'
    | 'date_dependency_delete';
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
}

export interface PresenceAnnouncePayload extends BaseSocketPayload {
  action: 'announce';
  user: {
    id: string;
    email: string;
    displayName: string;
    meta?: Record<string, any> | null;
  };
  resource: {
    id: string;
    type: PresencePageType;
    viewId?: string;
  };
}

export interface PresenceHeartbeatPayload extends BaseSocketPayload {
  action: 'heartbeat';
  user: {
    id: string;
  };
  resource: {
    id: string;
    type: PresencePageType;
    viewId?: string;
  };
}

export interface PresenceLocationChangePayload extends BaseSocketPayload {
  action: 'location-change';
  user: {
    id: string;
  };
  resource: {
    id: string;
    type: PresencePageType;
    viewId?: string;
  };
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
    user: {
      id: string;
      email: string;
      displayName: string;
      meta?: Record<string, any> | null;
    };
    resource: {
      id: string;
      type: PresencePageType;
      viewId?: string;
    };
    lastSeen: number;
  }>;
}

export type PresencePayload =
  | PresenceAnnouncePayload
  | PresenceHeartbeatPayload
  | PresenceLocationChangePayload
  | PresenceLeavePayload
  | PresenceBatchPayload;

export interface ChatEventPayload extends BaseSocketPayload {
  action: ChatEventAction;
  sessionId: string;
  // action: 'token'
  content?: string;
  // action: 'tool-start' | 'tool-call'
  toolCallId?: string;
  name?: string;
  args?: any;
  // action: 'tool-result'
  output?: any;
  isError?: boolean;
  // action: 'message-done'
  workspaceId?: string;
  messageId?: string;
  /** Final ordered content blocks — single source of truth for the persisted message. */
  parts?: ChatContentBlock[];
  /** Braintrust span ID — used for thumbs up/down feedback submission. */
  btSpanId?: string | null;
  /** Follow-up suggestions generated after the assistant response */
  followUps?: string[];
  // action: 'error'
  error?: string;
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

export type SocketEventPayload =
  | ConnectionWelcomePayload
  | ConnectionErrorPayload
  | DataPayload
  | MetaPayload
  | CommentPayload
  | DocumentCommentPayload
  | NotificationPayload
  | PresencePayload
  | ChatEventPayload;

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
  [EventType.CHAT_EVENT]: ChatEventPayload;
  [key: string]: BaseSocketPayload;
};

// Helper type to get payload type for a specific event
export type PayloadForEvent<T extends EventType> = SocketEventPayloadMap[T];
