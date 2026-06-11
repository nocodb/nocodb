import { Injectable } from '@nestjs/common';
import { UITypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { Audit, PresignedUrl } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { processConcurrently } from '~/utils/dataUtils';

@Injectable()
export class AuditsService {
  constructor(
    protected readonly appHooksListenerService: AppHooksListenerService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  async recordAuditList(
    context: NcContext,
    param: {
      row_id: string;
      fk_model_id: string;
      cursor?: string;
      retentionLimit?: number;
    },
  ) {
    const audits = await Audit.recordAuditList(context, param);

    for (const audit of audits.list) {
      try {
        const details = JSON.parse(audit.details || '{}');
        const { column_meta, data, old_data } = details as {
          column_meta: Record<
            string,
            { id: string; title: string; type: string }
          >;
          data: Record<string, any>;
          old_data: Record<string, any>;
        };

        for (const col of Object.values(column_meta || {})) {
          // re-generate new signedUrl for attachment files
          // to prevent it from expiring when displayed
          if (col.type === UITypes.Attachment) {
            if (data && data[col.title]) {
              await processConcurrently(
                data[col.title],
                async (item: any) => {
                  try {
                    await PresignedUrl.signAttachment({
                      attachment: item,
                      filename: item.title,
                    });
                  } catch (e) {}
                },
                15,
              );
            }

            if (old_data && old_data[col.title]) {
              await processConcurrently(
                old_data[col.title],
                async (item: any) => {
                  try {
                    await PresignedUrl.signAttachment({
                      attachment: item,
                      filename: item.title,
                    });
                  } catch (e) {}
                },
                15,
              );
            }
          }
        }

        audit.details = JSON.stringify(details);
      } catch (e) {}
    }

    return audits;
  }
}
