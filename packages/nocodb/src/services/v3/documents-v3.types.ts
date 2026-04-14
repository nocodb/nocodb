import type { DocumentType } from 'nocodb-sdk';

// --- Request types ---

export interface DocumentCreateV3Type {
  title?: string;
  content?: Record<string, any>;
  meta?: Record<string, any>;
  parent_id?: string | null;
}

export interface DocumentUpdateV3Type {
  title?: string;
  content?: Record<string, any>;
  meta?: Record<string, any>;
  version: number;
}

/** At least one of `order` or `parent_id` must be provided. */
export interface DocumentReorderV3Type {
  order?: number;
  parent_id?: string | null;
}

// --- Response types ---

/** Lightweight doc (list response — no content). */
export interface DocumentV3ListItemType {
  id: string;
  base_id: string;
  title: string;
  meta?: Record<string, any>;
  order: number;
  parent_id: string | null;
  has_children: boolean;
  version: number;
  comment_count?: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

/** Full doc (get response — includes content). */
export interface DocumentV3Type extends DocumentV3ListItemType {
  content: Record<string, any>;
}

export interface DocumentV3ListResponseType {
  list: DocumentV3ListItemType[];
}

/** Build a V3 list item from a DocumentType (strips content). */
export function toDocumentV3ListItem(
  doc: DocumentType,
): DocumentV3ListItemType {
  return {
    id: doc.id!,
    base_id: doc.base_id!,
    title: doc.title || 'Untitled',
    meta: doc.meta,
    order: doc.order ?? 0,
    parent_id: doc.parent_id ?? null,
    has_children: doc.has_children ?? false,
    version: doc.version ?? 1,
    comment_count: doc.comment_count,
    created_by: doc.created_by,
    updated_by: doc.updated_by,
    created_at: doc.created_at!,
    updated_at: doc.updated_at!,
  };
}

/** Build a full V3 doc from a DocumentType. */
export function toDocumentV3(doc: DocumentType): DocumentV3Type {
  return {
    ...toDocumentV3ListItem(doc),
    content: doc.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  };
}
