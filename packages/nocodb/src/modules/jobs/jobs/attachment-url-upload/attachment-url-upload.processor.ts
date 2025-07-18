import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { _wherePk, getBaseModelSqlFromModelId } from 'src/helpers/dbHelpers';
import type { AttachmentUrlUploadJobData } from '~/interface/Jobs';
import {
  NC_ATTACHMENT_FIELD_SIZE,
  NC_ATTACHMENT_URL_MAX_REDIRECT,
} from '~/constants';
import { AttachmentsService } from '~/services/attachments.service';
import { JOBS_QUEUE } from '~/interface/Jobs';

@Injectable()
@Processor(JOBS_QUEUE)
export class AttachmentUrlUploadProcessor {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Process('attachment-url-upload')
  async attachmentUrlUpload(job: Job<AttachmentUrlUploadJobData>) {
    const { context, modelId, column, recordId, attachments } = job.data;

    const baseModel = await getBaseModelSqlFromModelId({
      context: context,
      modelId: modelId,
    });
    const processedAttachments = [];

    for (const attachment of attachments) {
      try {
        if (attachment.id) {
          processedAttachments.push(attachment);
        }
        // If attachment has URL, download and process it
        if (attachment.url) {
          const downloadedAttachment = await this.downloadAndStoreAttachment(
            context,
            attachment.url,
          );
          processedAttachments.push(downloadedAttachment);
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
  }

  private async downloadAndStoreAttachment(
    context: any,
    url: string,
    attachmentId: string,
  ) {
    // Configure axios for download
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      maxRedirects: NC_ATTACHMENT_URL_MAX_REDIRECT,
      maxContentLength: NC_ATTACHMENT_FIELD_SIZE,
      timeout: 30000, // 30 seconds timeout
    });

    // Extract file information from response headers
    const contentType =
      response.headers['content-type'] || 'application/octet-stream';
    const contentLength = response.headers['content-length'];
    const contentDisposition = response.headers['content-disposition'];

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

    // Generate unique filename to avoid conflicts
    const fileExtension = filename.split('.').pop() || '';
    const uniqueFilename = `${uuidv4()}_${filename}`;

    // Use attachments service to store the file
    const storedAttachment = await this.attachmentsService.uploadViaURL({
      urls: [
        {
          url: url,
          fileName: uniqueFilename,
        },
      ],
      path: `nc/uploads/${attachmentId}`,
    });

    return {
      id: attachmentId,
      url: storedAttachment[0].url,
      title: filename,
      mimetype: contentType,
      size: contentLength ? parseInt(contentLength) : undefined,
      path: storedAttachment[0].path,
    };
  }
}
