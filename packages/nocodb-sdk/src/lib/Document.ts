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
  /**
   * True when the document has an explicit `document_visibility` permission
   * row. Public sharing is blocked when this is true: anonymous access
   * would bypass the owner's per-role/user restriction, contradicting the
   * intent of setting custom visibility. Surfaced separately from
   * `has_permissions` because edit-only permissions don't affect read-only
   * public share.
   */
  has_visibility_permission?: boolean;
  /** Public share UUID — when set, the doc is publicly accessible at /doc/<uuid>. */
  uuid?: string | null;
  /**
   * Stored share password. Reserved on the schema (shared column with view
   * share) — not exposed via any docs API in Phase 1. Kept on the type so
   * a future re-enable doesn't need a migration or type changes.
   */
  password?: string | null;
}

/** Shape of `doc.meta.share` — settings that govern public share behaviour. */
export interface DocumentShareMeta {
  /** When true, the share URL also exposes descendants of this doc. */
  include_subtree?: boolean;
}

/**
 * Typed accessor for `doc.meta.share`. Returns an empty share-meta object
 * when the doc is unshared or the field is missing, so callers can read
 * fields like `getDocShareMeta(doc.meta).include_subtree` without
 * repeating optional-chain + `as any` casts at each site.
 */
export function getDocShareMeta(
  meta?: Record<string, any> | null,
): DocumentShareMeta {
  const share = (meta as { share?: DocumentShareMeta } | null | undefined)
    ?.share;
  return share ?? {};
}

/**
 * Lightweight node in the initial public-share tree. Same shape as a child
 * node except `parent_id` can be null — the share root is re-anchored to
 * null so the frontend tree walker (starts at parent_id=null) treats it as
 * the visible root regardless of its DB position.
 */
export interface PublicDocTreeNode {
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

/**
 * Direct-child node returned by the lazy children endpoint. parent_id is
 * always a real doc id — never null — since children are only fetched for
 * a specific parent under the share.
 */
export interface PublicDocChildNode extends PublicDocTreeNode {
  parent_id: string;
}

/** @deprecated Use {@link PublicDocTreeNode} or {@link PublicDocChildNode}. */
export type PublicDocNode = PublicDocTreeNode;

/** Response shape for GET /api/v2/public/shared-doc/:uuid/meta */
export interface PublicDocMetaResponse {
  /** Root doc (the one whose UUID was used to access the share). */
  root: PublicDocTreeNode;
  /**
   * Initial visible tree — share root + its direct children. Deeper levels
   * are fetched lazily via `/children/:parentDocId` on expand. Empty array
   * (just the root) when descendants are not part of the share.
   */
  tree: PublicDocTreeNode[];
  /** Whether descendants are part of the share. */
  include_subtree: boolean;
  base: { id: string; title: string };
  workspace?: { id: string; title: string };
}

/** Response shape for GET /api/v2/public/shared-doc/:uuid/children/:parentDocId */
export type PublicDocChildrenResponse = PublicDocChildNode[];

/** Response shape for GET /api/v2/public/shared-doc/:uuid/doc/:docId/content */
export interface PublicDocContentResponse {
  id: string;
  title: string;
  /** Emoji or icon-name string from `doc.meta.icon`. Null when unset. */
  icon: string | null;
  /**
   * Tree-shape fields, mirroring what `documentGet` exposes in-app — the
   * public reader walks the parent chain via this endpoint (same flow as
   * `useDocumentsStore.expandToDocument`), so each `/content` response also
   * carries enough metadata to place the doc into the sidebar tree.
   *
   * The share root is re-anchored to `parent_id=null` (matches the initial
   * manifest), so a deep-linked walk that hits the root finds the tree root
   * without leaking the doc's position under any non-shared ancestor.
   */
  parent_id: string | null;
  order: number;
  has_children: boolean;
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
