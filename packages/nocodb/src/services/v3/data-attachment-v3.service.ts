import path from 'path';
import { PassThrough } from 'stream';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { nanoid } from 'nanoid';
import { AuditV1OperationTypes, ncIsNull } from 'nocodb-sdk';
import slash from 'slash';
import type { DataUpdatePayload, NcContext } from 'nocodb-sdk';
import type { AttachmentFilePathConstructed } from '~/helpers/attachmentHelpers';
import type {
  AttachmentBase64UploadParam,
  AttachmentUrlUploadParam,
} from '~/types/data-columns/attachment';
import {
  NC_ATTACHMENT_FIELD_SIZE,
  NC_ATTACHMENT_URL_MAX_REDIRECT,
} from '~/constants';
import {
  constructFilePath,
  validateNumberOfFilesInCell,
} from '~/helpers/attachmentHelpers';
import { _wherePk, getBaseModelSqlFromModelId } from '~/helpers/dbHelpers';
import { NcError } from '~/helpers/ncError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { JobTypes } from '~/interface/Jobs';
import { Audit, FileReference, PresignedUrl } from '~/models';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { extractColsMetaForAudit, generateAuditV1Payload } from '~/utils';
import { supportsThumbnails } from '~/utils/attachmentUtils';
import { RootScopes } from '~/utils/globals';

// ref: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html - extended with some more characters
const normalizeFilename = (filename: string) => {
  return filename.replace(/[\\/:*?"<>'`#|%~{}[\]^]/g, '_');
};

const mb = 1024 * 1024;

@Injectable()
export class DataAttachmentV3Service {
  constructor(
    @Inject(forwardRef(() => 'JobsService'))
    private readonly jobsService: IJobsService,
    private readonly dataV3Service: DataV3Service,
  ) {}
  async handleUrlUploadCellUpdate(param: AttachmentUrlUploadParam) {
    const { context, modelId, column, recordId, scope, req, attachments } =
      param;

    const baseModel = await getBaseModelSqlFromModelId({
      context: context,
      modelId: modelId,
    });
    await baseModel.model.getColumns(context);
    const processedAttachments = [];
    const generateThumbnailAttachments = [];

    for (const attachment of attachments) {
      try {
        if (
          attachment.id &&
          'status' in attachment &&
          attachment.status !== 'uploading'
        ) {
          processedAttachments.push(attachment);
        } else if (
          attachment.url &&
          'status' in attachment &&
          attachment.status === 'uploading' &&
          attachment.type === 'url_request'
        ) {
          // If attachment has URL, download and process it

          const downloadedAttachment = await this.downloadAndStoreAttachment(
            context,
            {
              filePath: attachment,
              url: attachment.url,
              scope,
            },
          );

          // update fileSize, url due to fileName, etc
          await FileReference.updateById(context, attachment.id, {
            file_url: downloadedAttachment.url ?? downloadedAttachment.path,
            file_size: downloadedAttachment.fileSize,
          });
          const processedAttachment = {
            id: attachment.id,
            url: ncIsNull(downloadedAttachment.url)
              ? undefined
              : downloadedAttachment.url,
            path: ncIsNull(downloadedAttachment.url)
              ? downloadedAttachment.path
              : undefined,
            title: downloadedAttachment.filename,
            mimetype: downloadedAttachment.mimeType,
            size: downloadedAttachment.fileSize,
          };
          processedAttachments.push(processedAttachment);
          if (supportsThumbnails({ mimetype: downloadedAttachment.mimeType })) {
            generateThumbnailAttachments.push(processedAttachment);
            // TODO: generate signed url
            // if (processedAttachment.url) {
            //   processedAttachment.signedUrl = await PresignedUrl.getSignedUrl(
            //     {
            //       pathOrUrl: attachment.url,
            //       preview,
            //       mimetype: mimetype || attachment.mimetype,
            //       ...(extra ? { ...extra } : {}),
            //     },
            //     ncMeta,
            //   );
            // }
          }
        }
      } catch (error) {
        console.error(`Failed to process attachment:`, error);
      }
    }
    // direct update to prevent prepare noco data again
    await baseModel
      .dbDriver(baseModel.getTnPath(baseModel.model))
      .update({
        [column.column_name]: JSON.stringify(processedAttachments),
      })
      .where(await _wherePk(baseModel.model.primaryKeys, recordId, true));

    if (generateThumbnailAttachments.length > 0) {
      await this.jobsService.add(JobTypes.ThumbnailGenerator, {
        context: {
          base_id: RootScopes.ROOT,
          workspace_id: RootScopes.ROOT,
        },
        attachments: generateThumbnailAttachments,
        scope,
      });
    }

    await Audit.insert(
      await generateAuditV1Payload<DataUpdatePayload>(
        AuditV1OperationTypes.DATA_UPDATE,
        {
          context: context,
          row_id: recordId,
          fk_model_id: baseModel.model.id,
          fk_workspace_id: context.workspace_id,
          base_id: context.base_id,
          source_id: baseModel.model.source_id,
          details: {
            table_title: baseModel.model.title,
            column_meta: extractColsMetaForAudit([column], {
              [column.title]: processedAttachments,
            }),
            data: { [column.title]: processedAttachments },
            old_data: {
              [column.title]: attachments.filter(
                (attr) => !('status' in attr) || attr.status !== 'uploading',
              ),
            },
          },
          req: req ?? ({ user: context.user } as any),
        },
      ),
    );

    /* TODO: broadcast to socket
    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DATA_EVENT,
        payload: {
          id,
          action: 'update',
          payload: processedAttachments,
        },
        scopes: [modelId],
      },
      context.socket_id,
    );
    */
  }

  async appendBase64AttachmentToCellData(param: AttachmentBase64UploadParam) {
    const { context, modelId, columnId, recordId, scope, attachment, req } =
      param;

    const buffer = Buffer.from(attachment.file, 'base64');

    // Calculate file size from base64 value
    const fileSize = buffer.length;

    if (fileSize > NC_ATTACHMENT_FIELD_SIZE) {
      NcError.get(context).invalidRequestBody(
        `Attachment is larger than maximum allowed size at ${Math.floor(
          NC_ATTACHMENT_FIELD_SIZE / mb,
        )} mb`,
      );
    }

    const baseModel = await getBaseModelSqlFromModelId({
      context: context,
      modelId: modelId,
    });
    await baseModel.model.getColumns(context);
    const column = baseModel.model.columns.find((col) => col.id === columnId);

    // Check if column exists in model
    if (!column) {
      NcError.get(context).fieldNotFound(columnId);
    }

    // Get the row data
    const rowData = await baseModel
      .dbDriver(baseModel.getTnPath(baseModel.model))
      .where(await _wherePk(baseModel.model.primaryKeys, recordId, true))
      .first();

    if (!rowData) {
      NcError.get(context).recordNotFound(recordId);
    }

    if (!attachment.contentType || !attachment.file || !attachment.filename) {
      NcError.get(context).invalidRequestBody(
        `Field contentType, file and filename is required`,
      );
    }

    // Update the cell field using baseModel.dbDriver directly
    const currentAttachments = rowData[column.column_name]
      ? JSON.parse(rowData[column.column_name])
      : [];
    await validateNumberOfFilesInCell(
      context,
      currentAttachments.length + 1,
      column,
    );

    const processedAttachments = [];
    const generateThumbnailAttachments = [];

    try {
      const storageAdapter = await NcPluginMgrv2.storageAdapter();
      const mimeType = attachment.contentType.split(';')[0].trim();

      let filename = attachment.filename;
      filename = scope
        ? `${normalizeFilename(path.parse(filename).name)}${path.extname(
            filename,
          )}`
        : `${normalizeFilename(path.parse(filename).name)}_${nanoid(
            5,
          )}${path.extname(filename)}`;

      const filePath = path.join(
        ...[context.workspace_id, context.base_id, modelId, column.id].filter(
          (k) => k,
        ),
      );
      const destPath = path.join('nc', scope ?? 'uploads', filePath);

      const resultAttachmentUrl = await storageAdapter.fileCreateByStream(
        slash(path.join(destPath, filename)),
        new PassThrough().end(buffer),
      );

      const attachmentId = await FileReference.insert(context, {
        storage: storageAdapter.name,
        file_url:
          resultAttachmentUrl ?? path.join('download', filePath, filename),
        file_size: fileSize,
        fk_user_id: context?.user?.id ?? 'anonymous',
        source_id: baseModel.model.source_id,
        fk_model_id: modelId,
        fk_column_id: column.id,
        is_external: !(await baseModel.getSource()).isMeta(),
      });

      const processedAttachment = {
        id: attachmentId, // Generate a new ID for the attachment
        url: ncIsNull(resultAttachmentUrl) ? undefined : resultAttachmentUrl,
        path: ncIsNull(resultAttachmentUrl)
          ? path.join('download', filePath, filename)
          : undefined,
        title: filename,
        mimetype: mimeType,
        size: fileSize,
      };
      processedAttachments.push(processedAttachment);
      if (supportsThumbnails({ mimetype: mimeType })) {
        generateThumbnailAttachments.push(processedAttachment);
      }
    } catch (error) {
      NcError.unprocessableEntity(
        `Failed to process base64 attachment: ${error}`,
      );
    }

    const updatedAttachments = [...currentAttachments, ...processedAttachments];

    await baseModel
      .dbDriver(baseModel.getTnPath(baseModel.model))
      .update({
        [column.column_name]: JSON.stringify(updatedAttachments),
      })
      .where(await _wherePk(baseModel.model.primaryKeys, recordId, true));

    if (generateThumbnailAttachments.length > 0) {
      await this.jobsService.add(JobTypes.ThumbnailGenerator, {
        context: {
          base_id: RootScopes.ROOT,
          workspace_id: RootScopes.ROOT,
        },
        attachments: generateThumbnailAttachments,
        scope,
      });
    }

    await baseModel.updateLastModified({
      rowIds: [recordId],
      cookie: { user: context.user },
      baseModel,
      knex: baseModel.dbDriver,
      model: baseModel.model,
    });

    await Audit.insert(
      await generateAuditV1Payload<DataUpdatePayload>(
        AuditV1OperationTypes.DATA_UPDATE,
        {
          context: context,
          row_id: recordId,
          fk_model_id: baseModel.model.id,
          fk_workspace_id: context.workspace_id,
          base_id: context.base_id,
          source_id: baseModel.model.source_id,
          details: {
            table_title: baseModel.model.title,
            column_meta: extractColsMetaForAudit([column], {
              [column.title]: updatedAttachments,
            }),
            data: { [column.title]: updatedAttachments },
            old_data: {
              [column.title]: currentAttachments,
            },
          },
          req: req ?? ({ user: context.user } as any),
        },
      ),
    );

    return await this.dataV3Service.dataRead(context, {
      modelId,
      query: '',
      req: { context, user: context.user } as any,
      rowId: recordId,
    });
  }

  protected async downloadAndStoreAttachment(
    context: NcContext,
    {
      url,
      filePath,
      scope,
    }: {
      url: string;
      filePath: AttachmentFilePathConstructed;
      scope: string;
    },
  ) {
    // Configure axios for download
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      maxRedirects: NC_ATTACHMENT_URL_MAX_REDIRECT,
      maxContentLength: NC_ATTACHMENT_FIELD_SIZE,
    });

    // Extract file information from response headers
    const contentType =
      response.headers['content-type'] || 'application/octet-stream';
    const contentLength = response.headers['content-length'];
    const contentDisposition = response.headers['content-disposition'];

    const passthrough = new PassThrough(); // Track size via the PassThrough stream
    let totalBytes = 0;
    if (!contentLength) {
      passthrough.on('data', (chunk) => {
        totalBytes += chunk.length;
      });
    }

    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    const mimeType = contentType.split(';')[0].trim();

    // Extract filename from URL or content-disposition header
    let filename;
    let originalFileName;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
      );
      if (filenameMatch && filenameMatch[1]) {
        originalFileName = filenameMatch[1].replace(/['"]/g, '');
        filename = scope
          ? `${normalizeFilename(
              path.parse(originalFileName).name,
            )}${path.extname(originalFileName)}`
          : `${normalizeFilename(path.parse(originalFileName).name)}_${nanoid(
              5,
            )}${path.extname(originalFileName)}`;
      }
    }
    const filePathConstructed = filename
      ? constructFilePath(context, {
          ...filePath,
          fileName: filename,
          originalFileName,
        })
      : filePath;
    const resultAttachmentUrl = await storageAdapter.fileCreateByStream(
      filePathConstructed.storageDest,
      response.data.pipe(passthrough),
    );
    const fileSize = contentLength ? Number(contentLength) : totalBytes;

    return {
      storageName: storageAdapter.name,
      url: resultAttachmentUrl,
      path: path.join(
        'download',
        filePathConstructed.filePath,
        filePathConstructed.fileName,
      ),
      filename: filePathConstructed.originalFileName,
      mimeType,
      fileSize,
    };
  }
}
