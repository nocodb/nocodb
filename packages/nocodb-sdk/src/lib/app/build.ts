import type { AppStatus } from './index';

export enum AppBuildAction {
  TOKEN = 'token',
  TOOL_START = 'tool-start',
  TOOL_CALL = 'tool-call',
  TOOL_RESULT = 'tool-result',
  STATUS = 'status',
  MESSAGE_DONE = 'message-done',
  ERROR = 'error',
  PREVIEW_READY = 'preview-ready',
}

export type AppChatPart =
  | { type: 'text'; text: string }
  | {
      type: 'tool_use';
      toolCallId: string;
      toolName: string;
      input?: unknown;
      result?: unknown;
      status?: 'running' | 'success' | 'error';
    };

export interface AppChatMessageType {
  id?: string;
  fk_app_id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  role: 'user' | 'assistant';
  parts: AppChatPart[];
  git_sha?: string;
  created_by?: string;
  created_at?: string;
}

export interface AppBuildEventPayload {
  // BaseSocketPayload fields (structural compat — avoids circular dep with realtime)
  timestamp: number;
  socketId?: string;
  // payload fields
  action: AppBuildAction;
  appId: string;
  messageId?: string;
  // action: 'token'
  content?: string;
  // action: 'tool-start' | 'tool-call' | 'tool-result'
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  result?: unknown;
  // action: 'status'
  status?: AppStatus;
  // action: 'message-done'
  parts?: AppChatPart[];
  // action: 'error'
  error?: string;
  // action: 'preview-ready' — backend-relative path; resolve against the
  // backend origin (ncSiteUrl) to form the iframe src.
  previewUrl?: string;
}
