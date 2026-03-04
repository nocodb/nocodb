export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool',
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

export enum ChatStreamEventType {
  TEXT_DELTA = 'text-delta',
  TOOL_CALL_START = 'tool-call-start',
  TOOL_CALL_DONE = 'tool-call-done',
  TOOL_RESULT = 'tool-result',
  MESSAGE_DONE = 'message-done',
  ERROR = 'error',
}

export interface ChatSessionType {
  id?: string;
  title?: string;
  fk_base_id: string;
  fk_workspace_id?: string;
  fk_user_id?: string;
  summary?: string;
  total_input_tokens?: number;
  total_output_tokens?: number;
  message_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessageType {
  id?: string;
  fk_session_id: string;
  role: ChatMessageRole;
  content?: string | null;
  tool_calls?: ChatToolCallType[];
  tool_results?: ChatToolResultType[];
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at?: string;
}

export interface ChatToolCallType {
  id: string;
  name: string;
  arguments: Record<string, any>;
  status: ChatToolCallStatus;
}

export interface ChatToolResultType {
  tool_call_id: string;
  output: any;
  is_error: boolean;
}

export interface ChatContextType {
  base_id: string;
  workspace_id: string;
  table_id?: string;
  view_id?: string;
  user_role: string;
}

export interface ChatSendMessageType {
  content: string;
  context?: ChatContextType;
  approvals?: Record<string, 'approved' | 'denied'>;
}

export interface ChatToolDefinitionType {
  name: string;
  description: string;
  parameters: Record<string, any>;
  is_dangerous: boolean;
}
