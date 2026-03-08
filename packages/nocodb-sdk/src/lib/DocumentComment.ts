export const REACTION_EMOJIS = ['👍', '👎', '😄', '😢', '🎉', '🚀'] as const;

export interface DocumentCommentReqType {
  fk_doc_id: string;
  comment: string;
  anchor_id?: string | null; // null = general comment
  parent_comment_id?: string;
}

export interface DocumentCommentUpdateReqType {
  comment: string;
}
