export interface DocumentType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  title?: string;
  content?: Record<string, any>; // ProseMirror JSON document
  meta?: Record<string, any>; // icon, cover, lock, settings, share.include_subtree
  order?: number;
  parent_id?: string | null;
  deleted?: boolean;
  has_children?: boolean;
  version?: number;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
  comment_count?: number;
  /** True when the document has explicit (non-default) permissions set */
  has_permissions?: boolean;
  /** Public share UUID — when set, the doc is publicly accessible at /doc/<uuid>. */
  uuid?: string | null;
  /** Stored password hash (bcrypt) — masked with sentinel when returned to clients. */
  password?: string | null;
}

/** Shape of `doc.meta.share` — settings that govern public share behaviour. */
export interface DocumentShareMeta {
  /** When true, the share URL also exposes descendants of this doc. */
  include_subtree?: boolean;
}

/** Lightweight node in the subtree manifest returned by the public share API. */
export interface PublicDocNode {
  id: string;
  title: string;
  parent_id: string | null;
  order: number;
  has_children: boolean;
  /**
   * Emoji or icon-name string from `doc.meta.icon`. Null when unset.
   * Surfaced on every node so the sidebar tree and topbar can render the
   * same icon the in-app editor shows.
   */
  icon: string | null;
}

/** Response shape for GET /api/v2/public/shared-doc/:uuid/meta */
export interface PublicDocMetaResponse {
  /** Root doc (the one whose UUID was used to access the share). */
  root: PublicDocNode;
  /** Subtree manifest — empty array when share is not scoped to descendants. */
  tree: PublicDocNode[];
  /** Whether descendants are part of the share. */
  include_subtree: boolean;
  base: { id: string; title: string };
  workspace?: { id: string; title: string };
}

/** Response shape for GET /api/v2/public/shared-doc/:uuid/doc/:docId/content */
export interface PublicDocContentResponse {
  id: string;
  title: string;
  /** Emoji or icon-name string from `doc.meta.icon`. Null when unset. */
  icon: string | null;
  /**
   * FileReference id of the cover image. Null when the doc has no cover.
   * The reader builds the absolute URL by appending it to the public
   * attachment proxy path (same flow as inline images).
   */
  cover_image_file_ref_id: string | null;
  content: Record<string, any>;
  updated_at: string;
}

/** @deprecated Use DocumentType instead */
export type DocType = DocumentType;
