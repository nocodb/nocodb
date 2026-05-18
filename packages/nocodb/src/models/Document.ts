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
  /** Public-share UUID — when set, the doc is publicly accessible via /doc/<uuid>. */
  uuid?: string | null;
  /** Stored share password (bcrypt hash). Masked with sentinel when returned to clients. */
  password?: string | null;

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

  // --- Public share (EE-only at runtime) ---
  // CE has no docs feature, so these stubs are never executed; they exist so
  // shared service code (documents-v3.service.ts) typechecks against the
  // resolved `~/models` Document on the CE build.

  public static async getByUUID(..._args): Promise<Document | null> {
    return null;
  }

  public static async share(..._args): Promise<any> {
    return null;
  }

  public static async unshare(..._args): Promise<void> {
    return;
  }

  public static async updateShareSettings(..._args): Promise<any> {
    return null;
  }

  public static async verifyPassword(..._args): Promise<boolean> {
    return false;
  }

  public static maskPasswordForResponse<T>(doc: T): T {
    return doc;
  }

  public static async getPublicSubtree(..._args): Promise<any[]> {
    return [];
  }

  public static async getContentOnly(..._args): Promise<Record<string, any> | null> {
    return null;
  }
}
