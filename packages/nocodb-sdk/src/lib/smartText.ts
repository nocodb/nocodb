/**
 * SmartText cell types — ProseMirror JSON shape and API I/O union.
 */

export interface ProseMirrorMark {
  type: string;
  attrs?: Record<string, any>;
}

export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, any>;
  content?: ProseMirrorNode[];
  marks?: ProseMirrorMark[];
  text?: string;
}

export interface ProseMirrorDoc extends ProseMirrorNode {
  type: 'doc';
  content?: ProseMirrorNode[];
}

/**
 * Accepted shapes when writing a SmartText cell via the record CRUD API.
 * Backend shape-detects: object with `type === 'doc'` is treated as PM JSON;
 * a plain string is stored as markdown.
 */
export type SmartTextCellInput = string | ProseMirrorDoc;

/**
 * Returns true if the value looks like a ProseMirror document at the API boundary.
 * Used in record create/update to branch between markdown vs PM JSON handling.
 */
export const isProseMirrorDoc = (value: unknown): value is ProseMirrorDoc => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.type === 'doc' && Array.isArray(v.content);
};

/**
 * Maximum PM JSON byte-size per cell in v1. Uniform across plan tiers.
 * Plan-tier differentiation is deferred to v2.
 */
export const SMART_TEXT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
