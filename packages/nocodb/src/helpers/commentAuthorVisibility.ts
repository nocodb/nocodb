import { NcAccessSource } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';

// Mentions are stored as `@(userId|email|display_name)`.
const MENTION_REGEXP = /@\(([^)]+)\)/g;

/** Strips author, resolver and mentioned users' emails for anonymous shared-base sessions. */
export function hideCommentEmailsForSharedBase<
  T extends {
    created_by_email?: string;
    resolved_by_email?: string;
    comment?: string;
  },
>(context: Pick<NcContext, 'access_source'>, comments: T[]): T[] {
  if (context?.access_source !== NcAccessSource.SHARED_BASE) return comments;
  for (const comment of comments ?? []) {
    delete comment.created_by_email;
    delete comment.resolved_by_email;
    if (typeof comment.comment === 'string') {
      comment.comment = comment.comment.replace(MENTION_REGEXP, (_, inner) => {
        const parts = inner.split('|');
        if (parts.length > 1) parts[1] = '';
        return `@(${parts.join('|')})`;
      });
    }
  }
  return comments;
}
