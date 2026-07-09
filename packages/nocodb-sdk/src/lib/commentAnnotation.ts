/**
 * Image-annotation types for attachment-carousel comments.
 *
 * An "anchored" comment stores a {@link CommentImageAnnotation} under
 * `CommentType.meta.annotation`, linking the comment to a point or rectangular
 * region on a specific image attachment within the cell.
 *
 * Region coordinates are normalized (0..1) against the image's NATURAL
 * dimensions so they stay correct across zoom/pan and any display size.
 */

export enum CommentAnnotationRegionType {
  POINT = 'point',
  RECT = 'rect',
}

export interface CommentAnnotationRegion {
  /** `point` = a single pin; `rect` = a rectangular region. */
  type: CommentAnnotationRegionType;
  /** Normalized 0..1. For `point`: the pin location. For `rect`: top-left corner. */
  x: number;
  y: number;
  /** Normalized 0..1 width/height — present only for `rect`. */
  w?: number;
  h?: number;
}

/** Identifies which attachment in a cell an annotation belongs to. */
export interface CommentAnnotationAttachmentRef {
  /** Local storage path (set for internally-stored files). */
  path?: string;
  /** External URL (set for externally-hosted files). */
  url?: string;
  /** Display title — fallback / UI label only, not used for matching. */
  title?: string;
}

export interface CommentImageAnnotation {
  attachment: CommentAnnotationAttachmentRef;
  region: CommentAnnotationRegion;
}

/** Shape stored under `CommentType.meta` for attachment-carousel comments. */
export interface CommentMeta {
  annotation?: CommentImageAnnotation;
}

/**
 * Stable key used to match an annotation to an attachment object.
 * Attachments carry `path` (internal) or `url` (external) — prefer `path`.
 */
export function getAttachmentAnnotationKey(
  attachment: { path?: string; url?: string } | null | undefined
): string | undefined {
  return attachment?.path ?? attachment?.url ?? undefined;
}
