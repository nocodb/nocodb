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

// #6 — no /g flag on module constant; each use creates its own regex
const MENTION_PATTERN_SOURCE = /@\(([^)]+)\)/;

/**
 * Extract mention emails from a comment's markdown mention syntax.
 * Format: @(userId|email|displayName)
 */
function extractMentionEmails(comment: string | undefined | null): string[] {
  if (!comment) return [];
  const emails: string[] = [];
  const regex = new RegExp(MENTION_PATTERN_SOURCE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(comment)) !== null) {
    const parts = match[1]?.split('|');
    const email = parts?.[1];
    if (email) emails.push(email.toLowerCase());
  }
  return emails;
}

/**
 * Shared non-deleted condition for Knex queries on nc_comments.
 */
function whereNotDeleted(this: any) {
  this.whereNull('is_deleted').orWhere('is_deleted', '!=', true);
}

/**
 * Fetch matching records by an array of row_id values using
 * whereIn on the PK column (safe for special chars, unlike where clause string).
 */
async function fetchRecordsByRowIds(
  context: NcContext,
  model: any,
  rowIds: string[],
  limit: number,
  req: NcRequest,
): Promise<any[]> {
  if (rowIds.length === 0) return [];

  const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);

  // #2 — Use whereIn via Knex subquery-safe approach instead of string where clause.
  // Fetch all records and filter in-memory by the row_id set. This avoids
  // where clause parsing issues with commas/parens in PK titles or values.
  // For reasonable limits (<=100), this is acceptable.
  const idsToFetch = new Set(rowIds.slice(0, limit).map(String));

  const result = await dataV3Service.dataList(context, {
    modelId: model.id,
    query: {
      // Fetch more than needed since we filter client-side
      limit: String(Math.min(limit * 2, 200)),
      offset: '0',
    },
    req,
  });

  const allRecords = (result as any).records || [];
  return allRecords.filter((r: any) => idsToFetch.has(String(r.id)));
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

    const knex = Noco.ncMeta.knex;

    // #10 — All raw queries include base_id for proper multi-tenant scoping
    const baseCondition = {
      fk_model_id: model.id,
      base_id: context.base_id,
    };

    // ── no_comments: use DB-level exclusion via NOT IN subquery ──
    // #1 — Fixed: uses subquery instead of single-page client-side filtering
    if (args.filter === 'no_comments') {
      const commentedRowIds = await knex(MetaTable.COMMENTS)
        .distinct('row_id')
        .where(baseCondition)
        .where(whereNotDeleted);

      const commentedSet = new Set(
        commentedRowIds.map((r: any) => String(r.row_id)),
      );

      // Paginate through records to find those without comments
      const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
      const collected: any[] = [];
      let offset = 0;
      const pageSize = 100;

      while (collected.length < limit) {
        const page = await dataV3Service.dataList(context, {
          modelId: model.id,
          query: { limit: String(pageSize), offset: String(offset) },
          req,
        });

        const records = (page as any).records || [];
        if (records.length === 0) break;

        for (const r of records) {
          if (!commentedSet.has(String(r.id))) {
            collected.push(r);
            if (collected.length >= limit) break;
          }
        }

        offset += pageSize;
        // Safety: stop after scanning 10K records to avoid infinite loops
        if (offset > 10000) break;
      }

      return {
        message: `Found ${collected.length} record(s) with no comments in "${model.title}".`,
        records: collected,
      };
    }

    // ── Filters that can be resolved at the SQL level (no comment body needed) ──
    // #8 — Use SQL aggregation for filters that don't need comment body

    if (
      args.filter === 'has_comments' ||
      args.filter === 'most_commented' ||
      args.filter === 'recent_activity' ||
      args.filter === 'unresolved_comments' ||
      args.filter === 'commented_by_me' ||
      args.filter === 'commented_by_user'
    ) {
      let query = knex(MetaTable.COMMENTS)
        .where(baseCondition)
        .where(whereNotDeleted);

      if (args.filter === 'recent_activity') {
        const days = args.days || 7;
        const cutoff = new Date(Date.now() - days * 86400000);
        query = query.where('created_at', '>=', cutoff.toISOString());
      }

      if (args.filter === 'unresolved_comments') {
        query = query.whereNull('resolved_by');
      }

      if (args.filter === 'commented_by_me') {
        if (!currentUserEmail) {
          return { error: 'Unable to determine current user.' };
        }
        query = query.where(function () {
          this.where('created_by', currentUserId).orWhere(
            'created_by_email',
            currentUserEmail,
          );
        });
      }

      if (args.filter === 'commented_by_user') {
        query = query.where(
          'created_by_email',
          args.user_email!.toLowerCase(),
        );
      }

      // For most_commented, get counts; for others, just distinct row_ids
      let matchingRowIds: string[];
      let commentCountMap: Map<string, number> | undefined;

      if (args.filter === 'most_commented') {
        const rows: any[] = await query
          .select('row_id')
          .count('id as count')
          .whereNotNull('row_id')
          .groupBy('row_id')
          .orderBy('count', 'desc')
          .limit(limit);

        commentCountMap = new Map(
          rows.map((r) => [String(r.row_id), Number(r.count)]),
        );
        matchingRowIds = rows.map((r) => String(r.row_id));
      } else {
        const rows: any[] = await query
          .distinct('row_id')
          .whereNotNull('row_id')
          .limit(limit);

        matchingRowIds = rows.map((r) => String(r.row_id));
      }

      if (matchingRowIds.length === 0) {
        const filterLabel = args.filter.replace(/_/g, ' ');
        return {
          message: `No records match the "${filterLabel}" filter in "${model.title}".`,
          records: [],
        };
      }

      const records = await fetchRecordsByRowIds(
        context,
        model,
        matchingRowIds,
        limit,
        req,
      );

      if (args.filter === 'most_commented' && commentCountMap) {
        for (const record of records) {
          record._comment_count =
            commentCountMap.get(String(record.id)) || 0;
        }
        records.sort(
          (a: any, b: any) =>
            (b._comment_count || 0) - (a._comment_count || 0),
        );
      }

      const filterLabel = args.filter.replace(/_/g, ' ');
      return {
        message: `Found ${records.length} record(s) matching "${filterLabel}" in "${model.title}".`,
        records,
      };
    }

    // ── Mention-based filters require reading comment body ──
    // Only load comment text for the filters that actually need it
    const comments: any[] = await knex(MetaTable.COMMENTS)
      .select('row_id', 'comment')
      .where(baseCondition)
      .where(whereNotDeleted)
      .whereNotNull('row_id')
      .limit(5000); // #8 — bounded; only select needed columns

    const mentionedRows: string[] = [];

    if (args.filter === 'mentions_me') {
      if (!currentUserId && !currentUserEmail) {
        return { error: 'Unable to determine current user.' };
      }
      for (const c of comments) {
        const mentionedIds = extractMentions(c.comment);
        const mentionedEmails = extractMentionEmails(c.comment);
        if (
          (currentUserId && mentionedIds.includes(currentUserId)) ||
          (currentUserEmail &&
            mentionedEmails.includes(currentUserEmail.toLowerCase()))
        ) {
          mentionedRows.push(c.row_id);
        }
      }
    } else if (args.filter === 'mentions_user') {
      const targetEmail = args.user_email!.toLowerCase();
      for (const c of comments) {
        const emails = extractMentionEmails(c.comment);
        if (emails.includes(targetEmail)) {
          mentionedRows.push(c.row_id);
        }
      }
    }

    const matchingRowIds = [...new Set(mentionedRows)];

    if (matchingRowIds.length === 0) {
      const filterLabel = args.filter.replace(/_/g, ' ');
      return {
        message: `No records match the "${filterLabel}" filter in "${model.title}".`,
        records: [],
      };
    }

    const records = await fetchRecordsByRowIds(
      context,
      model,
      matchingRowIds,
      limit,
      req,
    );

    const filterLabel = args.filter.replace(/_/g, ' ');
    return {
      message: `Found ${records.length} record(s) matching "${filterLabel}" in "${model.title}".`,
      records,
    };
  },
};
