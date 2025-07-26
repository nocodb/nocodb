import path from 'path';
import { PassThrough } from 'stream';
import axios from 'axios';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import slash from 'slash';
import { nanoid } from 'nanoid';
import { IJobsService } from '../../jobs-service.interface';
import type { Job } from 'bull';
import type { AttachmentUrlUploadJobData } from '~/interface/Jobs';
import { _wherePk, getBaseModelSqlFromModelId } from '~/helpers/dbHelpers';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { FileReference } from '~/models';
import { RootScopes } from '~/utils/globals';
import {
  NC_ATTACHMENT_FIELD_SIZE,
  NC_ATTACHMENT_URL_MAX_REDIRECT,
} from '~/constants';
import { JobTypes } from '~/interface/Jobs';

const thumbnailMimes = ['image/'];

// ref: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html - extended with some more characters
const normalizeFilename = (filename: string) => {
  return filename.replace(/[\\/:*?"<>'`#|%~{}[\]^]/g, '_');
};

@Injectable()
export class AttachmentUrlUploadProcessor {
  constructor(
    @Inject(forwardRef(() => 'JobsService'))
    private readonly jobsService: IJobsService,
  ) {}

  async job(job: Job<AttachmentUrlUploadJobData>) {
    const { context, modelId, column, recordId, scope, attachments } = job.data;

    const baseModel = await getBaseModelSqlFromModelId({
      context: context,
      modelId: modelId,
    });
    await baseModel.model.getColumns(context);
    const processedAttachments = [];
    const generateThumbnailAttachments = [];

    for (const attachment of attachments) {
      try {
        if (attachment.id && !attachment.id.startsWith('temp_')) {
          processedAttachments.push(attachment);
        } else if (attachment.url) {
          // If attachment has URL, download and process it
          const downloadedAttachment = await this.downloadAndStoreAttachment({
            filePath: path.join(
              ...[
                context.workspace_id,
                context.base_id,
                modelId,
                column.id,
                scope ? nanoid(5) : undefined,
              ].filter((k) => k),
            ),
            url: attachment.url,
            scope,
          });
          const attachmentId = await FileReference.insert(context, {
            storage: downloadedAttachment.storageName,
            file_url: downloadedAttachment.url ?? downloadedAttachment.path,
            file_size: downloadedAttachment.fileSize,
            fk_user_id: context?.user?.id ?? 'anonymous',
            source_id: baseModel.model.source_id,
            fk_model_id: modelId,
            fk_column_id: column.id,
            is_external: !(await baseModel.getSource()).isMeta(),
          });
          const processedAttachment = {
            id: attachmentId,
            url: downloadedAttachment.url,
            path: downloadedAttachment.path,
            title: downloadedAttachment.filename,
            mimetype: downloadedAttachment.mimeType,
            size: downloadedAttachment.fileSize,
          };
          processedAttachments.push(processedAttachment);
          if (
            thumbnailMimes.some((type) =>
              downloadedAttachment.mimeType.startsWith(type),
            )
          ) {
            generateThumbnailAttachments.push(processedAttachment);
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
  }

  private async downloadAndStoreAttachment({
    url,
    filePath,
    scope,
  }: {
    url: string;
    filePath: string;
    scope: string;
  }) {
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
    let filename = url.split('/').pop()?.split('?')[0] || 'attachment';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
      );
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    filename = scope
      ? `${normalizeFilename(path.parse(filename).name)}${path.extname(
          filename,
        )}`
      : `${normalizeFilename(path.parse(filename).name)}_${nanoid(
          5,
        )}${path.extname(filename)}`;

    const destPath = path.join(...['nc', scope ?? 'uploads', filePath]);
    const resultAttachmentUrl = await storageAdapter.fileCreateByStream(
      slash(path.join(destPath, filename)),
      response.data.pipe(passthrough),
    );
    const fileSize = contentLength ? Number(contentLength) : totalBytes;

    return {
      storageName: storageAdapter.name,
      url: resultAttachmentUrl,
      path: path.join('download', filePath, filename),
      filename,
      mimeType,
      fileSize,
    };
  }
}
