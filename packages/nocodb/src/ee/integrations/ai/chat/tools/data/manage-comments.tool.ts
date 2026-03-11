import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import Comment from '~/models/Comment';
import User from '~/models/User';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { CommentsService } from '~/services/comments.service';

/**
 * Convert @email patterns in plain text to the NocoDB mention format:
 *   @(userId|email|displayName)
 *
 * Looks up each email via User.getByEmail. Unresolved emails are left as-is.
 *
 * #3 — Uses negative lookbehind to skip @email that appears inside
 * an existing @(...) mention (i.e. preceded by `|`).
 */
async function resolveMentions(text: string): Promise<string> {
  // Match @email patterns, but NOT if preceded by | (inside a mention group)
  const emailRegex =
    /(?<!\|)@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const matches = [...text.matchAll(emailRegex)];
  if (matches.length === 0) return text;

  // Deduplicate emails and resolve users
  const uniqueEmails = [
    ...new Set(matches.map((m) => m[1].toLowerCase())),
  ];
  const userMap = new Map<
    string,
    { id: string; email: string; display_name?: string }
  >();

  for (const email of uniqueEmails) {
    const user = await User.getByEmail(email);
    if (user) {
      userMap.set(email, {
        id: user.id,
        email: user.email,
        display_name: user.display_name || user.email,
      });
    }
  }

  // Replace @email with @(id|email|name) for resolved users
  return text.replace(emailRegex, (_match, email: string) => {
    const user = userMap.get(email.toLowerCase());
    if (!user) return `@${email}`; // leave unresolved
    return `@(${user.id}|${user.email}|${user.display_name ?? user.email})`;
  });
}

export const manageCommentsTool: ChatToolDefinition = {
  name: 'manage_comments',
  description:
    'Manage comments on table records. Supports adding comments, resolving comments, ' +
    'replying to comments, and bulk-resolving all comments on a record.\n\n' +
    'Actions:\n' +
    '• "add_comment" — add a new comment to a record (requires row_id, comment_text)\n' +
    '• "resolve_comment" — resolve a specific comment (requires comment_id)\n' +
    '• "reply" — reply to an existing comment (requires comment_id, comment_text)\n' +
    '• "bulk_resolve" — resolve all unresolved comments on a record (requires row_id)\n' +
    '• "list_comments" — list comments on a specific record (requires row_id)\n\n' +
    'Use query_records_by_comments to find records first, then use the row_id from those results here.',
  parameters: {
    table_name: z
      .string()
      .describe('The title of the table (case-insensitive).'),
    action: z
      .enum([
        'add_comment',
        'resolve_comment',
        'reply',
        'bulk_resolve',
        'list_comments',
      ])
      .describe('The comment action to perform.'),
    row_id: z
      .string()
      .optional()
      .describe(
        'The record ID (primary key value). Required for add_comment, bulk_resolve, and list_comments.',
      ),
    comment_id: z
      .string()
      .optional()
      .describe(
        'The comment ID to act on. Required for resolve_comment and reply.',
      ),
    comment_text: z
      .string()
      .optional()
      .describe(
        'The comment text to add. Required for add_comment and reply. ' +
          'To @mention a user, include their email as @user@example.com — ' +
          'it will be automatically resolved to a proper mention.',
      ),
  },
  // #5 — Use commentList (viewer-level) as base permission;
  // write actions check commentRow permission internally.
  permission: 'commentList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: false,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      action: string;
      row_id?: string;
      comment_id?: string;
      comment_text?: string;
    },
    req: NcRequest,
  ) {
    const model = await resolveTableByName(context, args.table_name);
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    // #4 — Delegate mutations to CommentsService for proper
    // AppEvents, mail notifications, and socket broadcasts.
    const commentsService: CommentsService =
      Noco.nestApp.get(CommentsService);

    switch (args.action) {
      case 'add_comment': {
        if (!args.row_id) {
          return {
            error:
              'row_id is required for add_comment. Use query_records or query_records_by_comments to find the record ID first.',
          };
        }
        if (!args.comment_text) {
          return { error: 'comment_text is required for add_comment.' };
        }

        // Resolve @email → @(id|email|name) mention format
        const commentBody = await resolveMentions(args.comment_text);

        const inserted = await commentsService.commentRow(context, {
          body: {
            fk_model_id: model.id,
            row_id: args.row_id,
            comment: commentBody,
          },
          user: req.user,
          req,
        });

        return {
          message: `Comment added to record ${args.row_id} in "${model.title}".`,
          comment_id: inserted.id,
        };
      }

      case 'resolve_comment': {
        if (!args.comment_id) {
          return {
            error:
              'comment_id is required for resolve_comment. Use list_comments to find the comment ID.',
          };
        }

        const comment = await Comment.get(context, args.comment_id);
        if (!comment) {
          return { error: `Comment "${args.comment_id}" not found.` };
        }
        if (comment.fk_model_id !== model.id) {
          return {
            error: 'Comment does not belong to the specified table.',
          };
        }
        if (comment.resolved_by) {
          return { message: 'Comment is already resolved.' };
        }

        // Delegate to CommentsService for socket broadcast
        await commentsService.commentResolve(context, {
          commentId: args.comment_id,
          user: req.user,
          req,
        });

        return {
          message: `Comment ${args.comment_id} resolved.`,
        };
      }

      case 'reply': {
        if (!args.comment_id) {
          return {
            error:
              'comment_id is required for reply. Use list_comments to find the comment ID.',
          };
        }
        if (!args.comment_text) {
          return { error: 'comment_text is required for reply.' };
        }

        // Find the parent comment to get its row_id
        const parentComment = await Comment.get(context, args.comment_id);
        if (!parentComment) {
          return { error: `Comment "${args.comment_id}" not found.` };
        }
        if (parentComment.fk_model_id !== model.id) {
          return {
            error: 'Comment does not belong to the specified table.',
          };
        }

        const replyBody = await resolveMentions(args.comment_text);

        const inserted = await commentsService.commentRow(context, {
          body: {
            fk_model_id: model.id,
            row_id: parentComment.row_id,
            comment: replyBody,
            // parent_comment_id is accepted by Comment.insert() but not in
            // the swagger-generated CommentReqType — cast to pass it through.
            parent_comment_id: args.comment_id,
          } as any,
          user: req.user,
          req,
        });

        return {
          message: `Reply added to comment ${args.comment_id}.`,
          comment_id: inserted.id,
        };
      }

      case 'bulk_resolve': {
        if (!args.row_id) {
          return { error: 'row_id is required for bulk_resolve.' };
        }

        // Find all unresolved comments for this record
        const knex = Noco.ncMeta.knex;
        const unresolvedComments = await knex(MetaTable.COMMENTS)
          .select('id')
          .where('fk_model_id', model.id)
          .where('row_id', args.row_id)
          .where('base_id', context.base_id)
          .whereNull('resolved_by')
          .where(function () {
            this.whereNull('is_deleted').orWhere('is_deleted', '!=', true);
          });

        if (unresolvedComments.length === 0) {
          return {
            message: `No unresolved comments found on record ${args.row_id} in "${model.title}".`,
          };
        }

        // #9 — Resolve comments concurrently via CommentsService
        await Promise.all(
          unresolvedComments.map((c: any) =>
            commentsService.commentResolve(context, {
              commentId: c.id,
              user: req.user,
              req,
            }),
          ),
        );

        return {
          message: `Resolved ${unresolvedComments.length} comment(s) on record ${args.row_id} in "${model.title}".`,
        };
      }

      case 'list_comments': {
        if (!args.row_id) {
          return { error: 'row_id is required for list_comments.' };
        }

        const comments = await commentsService.commentList(context, {
          query: {
            row_id: args.row_id,
            fk_model_id: model.id,
          },
        });

        if (comments.length === 0) {
          return {
            message: `No comments found on record ${args.row_id} in "${model.title}".`,
            comments: [],
          };
        }

        // #7 — Comments are stored as plain markdown with @(id|email|name) mentions.
        // Extract readable text; fall back to raw string if parsing fails.
        const formatted = comments.map((c: any) => ({
          id: c.id,
          created_by: c.created_by_email || c.created_by,
          created_at: c.created_at,
          resolved: !!c.resolved_by,
          resolved_by: c.resolved_by_email || c.resolved_by || null,
          parent_comment_id: c.parent_comment_id || null,
          text: extractCommentText(c.comment),
        }));

        return {
          message: `Found ${formatted.length} comment(s) on record ${args.row_id} in "${model.title}".`,
          comments: formatted,
        };
      }

      default:
        return { error: `Unknown action: ${args.action}` };
    }
  },
};

/**
 * Extract plain text from a comment body.
 * Comments are stored as plain markdown strings with mentions as @(id|email|name).
 * Convert mentions to @name for readability.
 */
function extractCommentText(comment: string | undefined | null): string {
  if (!comment) return '';
  // Replace @(id|email|name) mention syntax with @name
  return comment.replace(/@\(([^)]+)\)/g, (_match, inner: string) => {
    const parts = inner.split('|');
    const name = parts[2] || parts[1] || 'user';
    return `@${name}`;
  });
}
