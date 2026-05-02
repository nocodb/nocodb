/**
 * SmartText cell types — ProseMirror JSON shape used by the dedicated
 * smartTextGetContent / smartTextUpdateContent endpoints.
 *
 * The records CRUD path (`/api/v2/data/...`) accepts only the derived
 * markdown string for SmartText cells; PM JSON I/O is exclusively via
 * the SmartText panel endpoints.
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
 * Maximum PM JSON byte-size per cell in v1. Uniform across plan tiers.
 * Plan-tier differentiation is deferred to v2.
 */
export const SMART_TEXT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
