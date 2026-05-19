import type { DocRevisionSource } from 'nocodb-sdk';
import type DocRevision from '~/models/DocRevision';

export interface DocumentRevisionV3ListItemType {
  id: string;
  fk_doc_id: string;
  version: number;
  title: string;
  created_by?: string;
  source: DocRevisionSource;
  created_at: string;
}

export interface DocumentRevisionV3Type extends DocumentRevisionV3ListItemType {
  content: Record<string, any>;
}

export interface DocumentRevisionV3ListResponseType {
  list: DocumentRevisionV3ListItemType[];
  /** Cursor for the next page — pass as `before` to fetch older revisions. */
  nextCursor: string;
}

export function toDocumentRevisionV3ListItem(
  rev: DocRevision,
): DocumentRevisionV3ListItemType {
  return {
    id: rev.id!,
    fk_doc_id: rev.fk_doc_id!,
    version: rev.version!,
    title: rev.title || 'Untitled',
    created_by: rev.created_by,
    source: rev.source!,
    created_at: rev.created_at!,
  };
}

export function toDocumentRevisionV3(
  rev: DocRevision,
): DocumentRevisionV3Type {
  return {
    ...toDocumentRevisionV3ListItem(rev),
    content: rev.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  };
}
