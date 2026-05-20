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
  has_permissions?: boolean;
  // Blocks public sharing — anonymous access would bypass the owner's
  // explicit DOCUMENT_VISIBILITY restriction. Surfaced separately from
  // has_permissions because edit-only permissions don't affect public share.
  has_visibility_permission?: boolean;
  // Public share UUID — when set, the doc is publicly accessible at /doc/<uuid>.
  uuid?: string | null;
  // Reserved on the schema (shared column with view share); not exposed
  // by any docs API today.
  password?: string | null;
}

export interface DocumentShareMeta {
  include_subtree?: boolean;
}

export function getDocShareMeta(
  meta?: Record<string, any> | null
): DocumentShareMeta {
  const share = (meta as { share?: DocumentShareMeta } | null | undefined)
    ?.share;
  return share ?? {};
}

// Share root is re-anchored to parent_id=null so the frontend tree walker
// treats it as the visible root regardless of its DB position.
export interface PublicDocTreeNode {
  id: string;
  title: string;
  parent_id: string | null;
  order: number;
  has_children: boolean;
  icon: string | null;
}

// Lazy children endpoint never returns the root, so parent_id is non-null.
export interface PublicDocChildNode extends PublicDocTreeNode {
  parent_id: string;
}

/** @deprecated Use {@link PublicDocTreeNode} or {@link PublicDocChildNode}. */
export type PublicDocNode = PublicDocTreeNode;

export type PublicDocLiteNode = PublicDocTreeNode;

// Defensive cap to guarantee termination on a malformed cycle.
export const MAX_PUBLIC_SCOPE_WALK_DEPTH = 64;

// Backstop TTL — explicit invalidation handles the normal case.
export const PUBLIC_SHARE_SCOPE_TTL_SECONDS = 300;

export interface PublicDocMetaResponse {
  root: PublicDocTreeNode;
  // Initial visible tree (root + direct children); deeper levels fetched
  // lazily via /children/:parentDocId.
  tree: PublicDocTreeNode[];
  include_subtree: boolean;
  base: { id: string; title: string };
  workspace?: { id: string; title: string };
}

export type PublicDocChildrenResponse = PublicDocChildNode[];

export interface PublicDocContentResponse {
  id: string;
  title: string;
  icon: string | null;
  // Tree-shape fields so the reader can place the doc in the sidebar on
  // deep-link without firing /meta again. Share root is re-anchored to null.
  parent_id: string | null;
  order: number;
  has_children: boolean;
  cover_image_file_ref_id: string | null;
  content: Record<string, any>;
  updated_at: string;
}

/** @deprecated Use DocumentType instead */
export type DocType = DocumentType;
