import { ScriptType } from '~/lib/Api';
import { DashboardType, WidgetType } from '~/lib';
import {
  EventType,
  BaseSocketPayload,
  ConnectionWelcomePayload,
  ConnectionErrorPayload,
  DataPayload,
  CommentPayload,
  MetaPayload,
  UserEventPayload,
  SocketEventPayload as SocketEventPayloadOSS,
  SocketEventPayloadMap as SocketEventPayloadMapOSS,
} from 'src/lib/realtime';

// export common types
export {
  EventType,
  BaseSocketPayload,
  ConnectionWelcomePayload,
  ConnectionErrorPayload,
  DataPayload,
  CommentPayload,
  MetaPayload,
  UserEventPayload,
};

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
  | SocketEventPayloadOSS
  | DashboardPayload
  | WidgetPayload;

// Type mapping for event types to their corresponding payloads
export type SocketEventPayloadMap = SocketEventPayloadMapOSS & {
  [EventType.DASHBOARD_EVENT]: DashboardPayload;
  [EventType.WIDGET_EVENT]: WidgetPayload;
  [EventType.SCRIPT_EVENT]: ScriptPayload;
};

// Helper type to get payload type for a specific event
export type PayloadForEvent<T extends EventType> = SocketEventPayloadMap[T];
