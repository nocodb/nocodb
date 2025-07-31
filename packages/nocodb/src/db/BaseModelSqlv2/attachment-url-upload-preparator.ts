import { NcApiVersion, type NcRequest } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { type AttachmentUrlUploadJobData, JobTypes } from '~/interface/Jobs';
import { EMIT_EVENT } from '~/constants';
import Noco from '~/Noco';
import { dataWrapper } from '~/helpers/dbHelpers';
import { type Column } from '~/models';

export class AttachmentUrlUploadPreparator {
  async prepareAttachmentUrlUpload(
    baseModel: IBaseModelSqlV2,
    {
      attachmentCols,
      data,
      req,
    }: {
      attachmentCols: Column[];
      data: Record<string, any>;
      req?: NcRequest;
    },
  ) {
    const postInsertOps: ((rowId: any) => Promise<string>)[] = [];
    const preInsertOps: (() => Promise<string>)[] = [];
    const postInsertAuditOps: ((rowId: any) => Promise<void>)[] = [];
    // return early if not v3
    if (baseModel.context.api_version !== NcApiVersion.V3) {
      return { postInsertOps, preInsertOps, postInsertAuditOps };
    }
    for (const col of attachmentCols) {
      let attachmentData: { id?: string; url: string }[];
      try {
        const attachmentDataRaw =
          dataWrapper(data).getByColumnNameTitleOrId(col);
        if (!attachmentDataRaw) {
          continue;
        }
        attachmentData =
          (typeof attachmentDataRaw === 'string'
            ? JSON.parse(attachmentDataRaw)
            : attachmentDataRaw) ?? [];
        if (attachmentData.length === 0) {
          continue;
        }
      } catch {
        continue;
      }
      // only process when temp id exists
      if (attachmentData.some((attr) => attr.id?.startsWith('temp_'))) {
        postInsertOps.push(async (recordId) => {
          Noco.eventEmitter.emit(EMIT_EVENT.HANDLE_ATTACHMENT_URL_UPLOAD, {
            jobName: JobTypes.AttachmentUrlUpload,
            context: baseModel.context,
            modelId: baseModel.model.id,
            column: col,
            recordId,
            user: baseModel.context.user,
            attachments: attachmentData,
            req,
          } as AttachmentUrlUploadJobData);
          return '';
        });
        const columnKeyName = dataWrapper(data).getColumnKeyName(col);
        // remove temp_ ids so it doesn't get recorded in audit
        data[columnKeyName] = JSON.stringify(
          attachmentData.filter((dt) => !dt.id?.startsWith('temp_')),
        );
      }
    }
    return { postInsertOps, preInsertOps, postInsertAuditOps };
  }
}
