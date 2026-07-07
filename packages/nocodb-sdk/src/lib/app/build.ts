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
    }
  // A turn that ran but did not produce a working result (the agent failed, or
  // its change did not compile). Persisted as part of the assistant message so
  // the failure stays visible in the thread on reload — distinct from the
  // transient infra/in-progress errors that go through the ERROR action.
  | { type: 'error'; text: string };

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
