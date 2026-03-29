export default class ChatMessage {
  id?: string;
  fk_session_id?: string;
  fk_workspace_id?: string;
  fk_base_id?: string;
  role?: string;
  content?: string | null;
  parts?: any[];
  files?: any[];
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at?: string;

  constructor(data: ChatMessage) {
    Object.assign(this, data);
  }

  public static async get(..._args) {
    return null;
  }

  public static async list(..._args) {
    return [];
  }

  static async insert(..._args) {
    return null;
  }

  static async update(..._args) {
    return null;
  }

  static async delete(..._args) {
    return null;
  }

  static async deleteBySessionId(..._args) {
    return;
  }

  static async countByWorkspaceAndMonth(..._args) {
    return 0;
  }
}
