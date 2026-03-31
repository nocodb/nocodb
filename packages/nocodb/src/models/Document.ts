import type { DocumentType } from 'nocodb-sdk';

export default class Document implements DocumentType {
  id: string;
  base_id: string;
  fk_workspace_id: string;
  title: string;
  content: Record<string, any>;
  meta: Record<string, any>;
  order: number;
  parent_id: string | null;
  has_children: boolean;
  deleted: boolean;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  comment_count?: number;

  constructor(doc: Document | DocumentType) {
    Object.assign(this, doc);
  }

  public static async get(..._args) {
    return null;
  }

  public static async list(..._args) {
    return [];
  }

  public static async listLite(..._args) {
    return [];
  }

  public static async insert(..._args) {
    return null;
  }

  public static async update(..._args) {
    return null;
  }

  public static async delete(..._args) {
    return null;
  }

  public static async softDelete(..._args) {
    return null;
  }

  public static async getDescendantIds(..._args): Promise<string[]> {
    return [];
  }

  public static async move(..._args) {
    return null;
  }

  public static async countForBase(..._args): Promise<number> {
    return 0;
  }
}
