import type {
  ChatAttachmentType,
  ChatContentBlock,
  ChatMessageRole,
} from '~/lib/chat';

export interface AgentMessageType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  fk_session_id?: string;
  fk_agent_id?: string;
  role?: ChatMessageRole;
  content?: string | null;
  parts?: ChatContentBlock[];
  files?: ChatAttachmentType[];
  /** Files the agent produced in its sandbox this turn. */
  created_files?: ChatAttachmentType[];
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at?: string;
}

export interface AgentSendMessageReqType {
  content: string;
  files?: ChatAttachmentType[];
}
