import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { extractMentions } from '~/utils/richTextHelper';

/**
 * Mentions in comments are stored as markdown: @(userId|email|displayName)
 * This regex captures each mention group.
 */
const MENTION_REGEX = /@\(([^)]+)\)/g;

/**
 * Extract user IDs from a comment's markdown mention syntax.
 */
function extractMentionUserIds(comment: string | undefined | null): string[] {
  if (!comment) return [];
  return extractMentions(comment);
}

/**
 * Extract mention emails from a comment's markdown mention syntax.
 * Format: @(userId|email|displayName)
 */
function extractMentionEmails(comment: string | undefined | null): string[] {
  if (!comment) return [];
  const emails: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, 'g');
  while ((match = regex.exec(comment)) !== null) {
    const parts = match[1]?.split('|');
    const email = parts?.[1];
    if (email) emails.push(email.toLowerCase());
  }
  return emails;
}

export const queryRecordsByCommentsTool: ChatToolDefinition = {
  name: 'query_records_by_comments',
  description:
    'Find records in a table based on their comment activity. ' +
    'Supports filtering by: records that have comments, unresolved comments, ' +
    'comments mentioning a specific user, comments by a specific user, ' +
    'records with no comments, and records with the most comments.\n\n' +
    'Filters:\n' +
    '• "has_comments" — records that have at least one comment\n' +
    '• "no_comments" — records with zero comments\n' +
    '• "unresolved_comments" — records with at least one unresolved comment\n' +
    '• "mentions_me" — records where the current user is @mentioned\n' +
    '• "mentions_user" — records where a specific user (by email) is @mentioned (requires user_email)\n' +
    '• "commented_by_me" — records where the current user has commented\n' +
    '• "commented_by_user" — records where a specific user (by email) has commented (requires user_email)\n' +
    '• "most_commented" — records sorted by comment count (descending)\n' +
    '• "recent_activity" — records with comments in the last N days (requires days, default 7)\n\n' +
    'Returns record IDs, display fields, and comment summaries.',
  parameters: {
    table_name: z
      .string()
      .describe('The title of the table to query (case-insensitive).'),
    filter: z
      .enum([
        'has_comments',
        'no_comments',
        'unresolved_comments',
        'mentions_me',
        'mentions_user',
        'commented_by_me',
        'commented_by_user',
        'most_commented',
        'recent_activity',
      ])
      .describe('The type of comment filter to apply.'),
    user_email: z
      .string()
      .optional()
      .describe(
        'Email of the user to filter by. Required for "mentions_user" and "commented_by_user" filters.',
      ),
    days: z
      .number()
      .optional()
      .describe(
        'Number of days to look back for "recent_activity" filter. Default: 7.',
      ),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of records to return. Default: 25, max: 100.'),
  },
  permission: 'dataList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      filter: string;
      user_email?: string;
      days?: number;
      limit?: number;
    },
    req: NcRequest,
  ) {
    const model = await resolveTableByName(context, args.table_name);
    const limit = Math.min(args.limit || 25, 100);
    const currentUserId = req.user?.id;
    const currentUserEmail = req.user?.email;

    // Validate required params for user-specific filters
    if (
      (args.filter === 'mentions_user' || args.filter === 'commented_by_user') &&
      !args.user_email
    ) {
      return {
        error: `The "${args.filter}" filter requires the user_email parameter. Ask the user which user they mean.`,
      };
    }

    // ── Fetch all non-deleted comments for this table ──
    // For "no_comments" we need to compare against all record IDs,
    // so we handle it differently.
    const knex = Noco.ncMeta.knex;

    if (args.filter === 'no_comments') {
      // Get all row IDs that DO have comments
      const commentedRows = await knex(MetaTable.COMMENTS)
        .distinct('row_id')
        .where('fk_model_id', model.id)
        .where(function () {
          this.whereNull('is_deleted').orWhere('is_deleted', '!=', true);
        });

      const commentedRowIds = commentedRows.map((r: any) => r.row_id);

      // Query records, excluding those with comments
      const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
      const result = await dataV3Service.dataList(context, {
        modelId: model.id,
        query: {
          limit: String(limit),
          offset: '0',
        },
        req,
      });

      // Filter out rows that have comments
      const commentedSet = new Set(commentedRowIds);
      const allRecords = (result as any).records || [];
      const filteredRecords = allRecords.filter(
        (r: any) => !commentedSet.has(String(r.id ?? r.Id)),
      );

      return {
        message: `Found ${filteredRecords.length} record(s) with no comments in "${model.title}".`,
        records: filteredRecords.slice(0, limit),
      };
    }

    // ── Fetch comments for all other filters ──
    let commentsQuery = knex(MetaTable.COMMENTS)
      .select('*')
      .where('fk_model_id', model.id)
      .where(function () {
        this.whereNull('is_deleted').orWhere('is_deleted', '!=', true);
      })
      .orderBy('created_at', 'desc');

    // For recent_activity, filter by date
    if (args.filter === 'recent_activity') {
      const days = args.days || 7;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      commentsQuery = commentsQuery.where(
        'created_at',
        '>=',
        cutoff.toISOString(),
      );
    }

    const allComments: any[] = await commentsQuery;

    if (allComments.length === 0 && args.filter !== 'no_comments') {
      return {
        message:
          args.filter === 'recent_activity'
            ? `No comments found in the last ${args.days || 7} day(s) in "${model.title}".`
            : `No comments found in "${model.title}".`,
        records: [],
      };
    }

    // ── Apply filter logic to find matching row_ids ──
    let matchingRowIds: string[] = [];
    let commentCountMap: Map<string, number> | undefined;

    switch (args.filter) {
      case 'has_comments':
      case 'recent_activity': {
        // All rows with at least one comment (already filtered by date for recent_activity)
        matchingRowIds = [
          ...new Set(allComments.map((c) => c.row_id).filter(Boolean)),
        ];
        break;
      }

      case 'unresolved_comments': {
        const unresolvedRows = allComments
          .filter((c) => !c.resolved_by && c.row_id)
          .map((c) => c.row_id);
        matchingRowIds = [...new Set(unresolvedRows)];
        break;
      }

      case 'mentions_me': {
        if (!currentUserId && !currentUserEmail) {
          return { error: 'Unable to determine current user.' };
        }
        const mentionedRows: string[] = [];
        for (const c of allComments) {
          if (!c.row_id) continue;
          // Comments store mentions as markdown: @(userId|email|displayName)
          const mentionedIds = extractMentionUserIds(c.comment);
          const mentionedEmails = extractMentionEmails(c.comment);
          if (
            (currentUserId && mentionedIds.includes(currentUserId)) ||
            (currentUserEmail &&
              mentionedEmails.includes(currentUserEmail.toLowerCase()))
          ) {
            mentionedRows.push(c.row_id);
          }
        }
        matchingRowIds = [...new Set(mentionedRows)];
        break;
      }

      case 'mentions_user': {
        const targetEmail = args.user_email!.toLowerCase();
        const mentionedRows: string[] = [];
        for (const c of allComments) {
          if (!c.row_id) continue;
          // Comments store mentions as markdown: @(userId|email|displayName)
          const emails = extractMentionEmails(c.comment);
          if (emails.includes(targetEmail)) {
            mentionedRows.push(c.row_id);
          }
        }
        matchingRowIds = [...new Set(mentionedRows)];
        break;
      }

      case 'commented_by_me': {
        if (!currentUserEmail) {
          return { error: 'Unable to determine current user.' };
        }
        const myRows = allComments
          .filter(
            (c) =>
              c.row_id &&
              (c.created_by === currentUserId ||
                c.created_by_email === currentUserEmail),
          )
          .map((c) => c.row_id);
        matchingRowIds = [...new Set(myRows)];
        break;
      }

      case 'commented_by_user': {
        const targetEmail = args.user_email!.toLowerCase();
        const userRows = allComments
          .filter(
            (c) =>
              c.row_id &&
              c.created_by_email?.toLowerCase() === targetEmail,
          )
          .map((c) => c.row_id);
        matchingRowIds = [...new Set(userRows)];
        break;
      }

      case 'most_commented': {
        commentCountMap = new Map<string, number>();
        for (const c of allComments) {
          if (!c.row_id) continue;
          commentCountMap.set(
            c.row_id,
            (commentCountMap.get(c.row_id) || 0) + 1,
          );
        }
        // Sort by count descending
        matchingRowIds = [...commentCountMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([rowId]) => rowId);
        break;
      }
    }

    if (matchingRowIds.length === 0) {
      return {
        message: `No records match the "${args.filter}" filter in "${model.title}".`,
        records: [],
      };
    }

    // ── Fetch matching records via DataV3Service ──
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);

    // Get primary key column name for the where clause
    const columns = await model.getColumns(context);
    const pkCol = columns.find((c) => c.pk);

    if (!pkCol) {
      return { error: 'Table has no primary key column.' };
    }

    // Build where clause: (PkField,in,id1,id2,id3)
    const idsToFetch = matchingRowIds.slice(0, limit);
    const whereClause = `(${pkCol.title},in,${idsToFetch.join(',')})`;

    const result = await dataV3Service.dataList(context, {
      modelId: model.id,
      query: {
        where: whereClause,
        limit: String(limit),
        offset: '0',
      },
      req,
    });

    // Enrich with comment count if available
    const records = (result as any).records || [];

    if (args.filter === 'most_commented' && commentCountMap) {
      for (const record of records) {
        const rowId = String(record.id ?? record.Id);
        record._comment_count = commentCountMap.get(rowId) || 0;
      }
      // Re-sort by comment count (dataList may not preserve our order)
      records.sort(
        (a: any, b: any) => (b._comment_count || 0) - (a._comment_count || 0),
      );
    }

    const filterLabel = args.filter.replace(/_/g, ' ');
    return {
      message: `Found ${records.length} record(s) matching "${filterLabel}" in "${model.title}".`,
      records,
    };
  },
};
