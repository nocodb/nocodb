interface ChatwootSyncPayload {
  includeResolved: boolean;
  inboxId?: string;
}

interface ChatwootConversation {
  id: number;
  uuid: string;
  account_id: number;
  inbox_id: number;
  status: string;
  priority?: string;
  labels: string[];
  created_at: number;
  updated_at: number;
  last_activity_at: number;
  messages: ChatwootMessage[];
  meta: {
    sender: ChatwootContact;
    assignee?: ChatwootAgent;
  };
  additional_attributes?: any;
  custom_attributes?: any;
}

interface ChatwootMessage {
  id: number;
  content: string;
  message_type: number;
  created_at: number;
  updated_at: number;
  conversation_id: number;
  sender?: ChatwootAgent | ChatwootContact;
  sender_type: string;
  sender_id: number;
  private: boolean;
  content_attributes?: any;
}

interface ChatwootAgent {
  id: number;
  name: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  role?: string;
}

interface ChatwootContact {
  id: number;
  name: string;
  email?: string;
  phone_number?: string;
  thumbnail?: string;
  identifier?: string;
  created_at?: number;
  last_activity_at?: number;
}

interface ChatwootTeam {
  id: number;
  name: string;
  description?: string;
  allow_auto_assign: boolean;
  account_id: number;
  is_member: boolean;
}

export {
  ChatwootAgent,
  ChatwootContact,
  ChatwootConversation,
  ChatwootMessage,
  ChatwootSyncPayload,
  ChatwootTeam,
};
