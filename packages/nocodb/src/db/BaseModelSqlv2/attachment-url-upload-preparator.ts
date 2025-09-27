import { NcApiVersion, type NcRequest } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { type AttachmentUrlUploadJobData, JobTypes } from '~/interface/Jobs';
import { EMIT_EVENT } from '~/constants';
import Noco from '~/Noco';
import { dataWrapper } from '~/helpers/dbHelpers';
import { type Column, FileReference } from '~/models';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import {
  constructFilePath,
  getFileNameFromUrl,
} from '~/helpers/attachmentHelpers';
import { extractProps } from '~/helpers/extractProps';

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
        const storageAdapter = await NcPluginMgrv2.storageAdapter();
        attachmentData = await Promise.all(
          attachmentData.map(async (attr) => {
            if (attr.id?.startsWith('temp_')) {
              const filePaths = constructFilePath(baseModel.context, {
                columnId: col.id,
                modelId: baseModel.model.id,
                scope: undefined,
                ...getFileNameFromUrl({
                  url: attr.url,
                  scope: undefined,
                }),
              });
              const uploadedPath = storageAdapter.getUploadedPath(
                filePaths.storageDest,
              );
              const id = await FileReference.insert(baseModel.context, {
                storage: storageAdapter.name,
                // currently a placeholder
                // it will be replaced after upload success
                file_url: uploadedPath.url ?? uploadedPath.path,
                file_size: null,
                fk_user_id: req?.user?.id ?? 'anonymous',
                source_id: baseModel.model.source_id,
                fk_model_id: baseModel.model.id,
                fk_column_id: col.id,
                is_external: !(await baseModel.getSource()).isMeta(),
                deleted: true,
              });
              return {
                id,
                url: attr.url,
                status: 'uploading',
                ...filePaths,
              };
            } else {
              return attr;
            }
          }),
        );
        postInsertOps.push(async (recordId) => {
          Noco.eventEmitter.emit(EMIT_EVENT.HANDLE_ATTACHMENT_URL_UPLOAD, {
            jobName: JobTypes.AttachmentUrlUpload,
            context: baseModel.context,
            modelId: baseModel.model.id,
            column: col,
            recordId,
            user: baseModel.context.user,
            attachments: attachmentData,
            req: {
              context: baseModel.context,
              user: req.user,
            },
          } as AttachmentUrlUploadJobData);
          return '';
        });
        const columnKeyName = dataWrapper(data).getColumnKeyName(col);
        // remove temp_ ids so it doesn't get recorded in audit
        data[columnKeyName] = JSON.stringify(
          attachmentData.map((attr) => {
            if (!('status' in attr)) {
              return attr;
            }
            return extractProps(attr, ['id', 'url', 'status', 'type']);
          }),
        );
      }
    }
    return { postInsertOps, preInsertOps, postInsertAuditOps };
  }
}
