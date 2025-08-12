import { ScriptType, TableType, UserType, ViewType } from '~/lib/Api';
import { DashboardType, WidgetType } from '~/lib';

export enum EventType {
  HANDSHAKE = 'handshake',
  CONNECTION_WELCOME = 'connection-welcome',
  CONNECTION_ERROR = 'connection-error',
  NOTIFICATION = 'notification',
  DATA_EVENT = 'event-data',
  META_EVENT = 'event-meta',
  DASHBOARD_EVENT = 'event-dashboard',
  WIDGET_EVENT = 'event-widget',
  SCRIPT_EVENT = 'event-script',
}

// Base payload interface for all socket events
export interface BaseSocketPayload {
  timestamp: number;
  socketId?: string;
  eventType?: EventType;
}

// Connection event payloads
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

export interface MetaPayload extends BaseSocketPayload {
  action: 'table_create' | 'table_update' | 'table_delete' | 'column_add' | 'column_update' | 'column_delete' | 'view_create' | 'view_update' | 'view_delete';
  payload: Partial<TableType | ViewType>;
}

export interface DashboardPayload extends BaseSocketPayload {
  id: string;
  action: 'create' | 'update' | 'delete';
  payload: DashboardType;
}

export interface WidgetPayload extends BaseSocketPayload {
  id: string;
  dashboardId: string;
  action: 'create' | 'update' | 'delete';
  payload: WidgetType;
}

export interface ScriptPayload extends BaseSocketPayload {
  id: string;
  action: 'create' | 'update' | 'delete';
  payload: ScriptType;
}

// Union type for all socket event payloads
export type SocketEventPayload =
  | ConnectionWelcomePayload
  | ConnectionErrorPayload
  | DataPayload
  | MetaPayload
  | DashboardPayload
  | WidgetPayload;

// Type mapping for event types to their corresponding payloads
export type SocketEventPayloadMap = {
  [EventType.CONNECTION_WELCOME]: ConnectionWelcomePayload;
  [EventType.CONNECTION_ERROR]: ConnectionErrorPayload;
  [EventType.DATA_EVENT]: DataPayload;
  [EventType.META_EVENT]: MetaPayload;
  [EventType.DASHBOARD_EVENT]: DashboardPayload;
  [EventType.WIDGET_EVENT]: WidgetPayload;
  [EventType.SCRIPT_EVENT]: ScriptPayload;
  [key: string]: BaseSocketPayload;
};

// Helper type to get payload type for a specific event
export type PayloadForEvent<T extends EventType> = SocketEventPayloadMap[T];
