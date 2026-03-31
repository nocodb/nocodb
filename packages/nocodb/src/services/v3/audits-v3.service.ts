import { Injectable } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { AuditsService } from '~/services/audits.service';

@Injectable()
export class AuditsV3Service {
  constructor(protected readonly auditsService: AuditsService) {}

  async recordAuditList(
    context: NcContext,
    param: {
      tableId: string;
      recordId: string;
      limit?: number;
      cursor?: string;
      retentionLimit?: number;
    },
  ) {
    const limit = Math.min(Math.max(param.limit ?? 25, 1), 100);

    const result = await this.auditsService.recordAuditList(context, {
      fk_model_id: param.tableId,
      row_id: param.recordId,
      cursor: param.cursor,
      retentionLimit: param.retentionLimit,
    });

    const list = result.list.slice(0, limit).map((audit: Record<string, any>) => {
      let details: any;
      try {
        details =
          typeof audit.details === 'string'
            ? JSON.parse(audit.details || '{}')
            : audit.details || {};
      } catch {
        details = {};
      }

      const { column_meta, data, old_data, ...otherDetails } = details;

      return {
        id: audit.id,
        op_type: audit.op_type,
        description: audit.description,
        user: {
          id: audit.fk_user_id,
          email: audit.user,
        },
        ip: audit.ip,
        details:
          column_meta || data || old_data
            ? { ...otherDetails, column_meta, data, old_data }
            : Object.keys(otherDetails).length
              ? otherDetails
              : undefined,
        created_at: audit.created_at,
      };
    });

    const isLastPage = result.pageInfo?.isLastPage !== false;
    const lastRecord = list[list.length - 1];

    return {
      list,
      pageInfo: {
        isLastPage,
        ...(isLastPage || !lastRecord
          ? {}
          : { nextCursor: `${lastRecord.id}|${lastRecord.created_at}` }),
      },
    };
  }
}
