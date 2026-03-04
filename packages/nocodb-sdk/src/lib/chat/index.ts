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
  fk_workspace_id: string;
  fk_user_id?: string;
  summary?: string;
  total_input_tokens?: number;
  total_output_tokens?: number;
  message_count?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Self-contained content block — single source of truth for assistant messages.
 * Mirrors Anthropic's content block format.
 */
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
    };

export interface ChatMessageType {
  id?: string;
  fk_session_id: string;
  role: ChatMessageRole;
  /** Text content — used for user messages. Assistant messages use `parts`. */
  content?: string | null;
  /** Ordered content blocks — single source of truth for assistant messages. */
  parts?: ChatContentBlock[];
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at?: string;
}

export interface ChatSendMessageType {
  content: string;
  approvals?: Record<string, 'approved' | 'denied'>;
  base_id?: string;
}

export interface ChatToolDefinitionType {
  name: string;
  description: string;
  parameters: Record<string, any>;
  is_dangerous: boolean;
}
