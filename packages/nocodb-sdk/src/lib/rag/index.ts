export enum RagResponseFormat {
  TEXT = 'text',
  SQL = 'sql',
  CSV = 'csv',
  JSON = 'json',
  MARKDOWN = 'markdown',
}

export interface RagSessionType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  title?: string;
  messages?: RagMessageType[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RagMessageType {
  id?: string;
  fk_session_id?: string;
  fk_workspace_id?: string;
  role: 'user' | 'assistant';
  content: string;
  format?: RagResponseFormat | null;
  data?: string | null;
  sql?: string | null;
  result?: Record<string, unknown>[] | null;
  error?: string | null;
  created_at?: string;
}

export interface RagChatReqType {
  session_id?: string;
  message: string;
}

export interface RagChatResponseType {
  session_id: string;
  message: RagMessageType;
}
