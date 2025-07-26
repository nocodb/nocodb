import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { NC_ATTACHMENT_FIELD_SIZE, NC_ATTACHMENT_URL_MAX_REDIRECT } from '~/constants';
import type { AttachmentUrlUploadJobData } from '~/interface/Jobs';
import { AttachmentsService } from '~/services/attachments.service';
import { JOBS_QUEUE } from '~/interface/Jobs';

@Injectable()
@Processor(JOBS_QUEUE)
export class AttachmentUrlUploadProcessor {
  constructor(
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Process('attachment-url-upload')
  async attachmentUrlUpload(job: Job<AttachmentUrlUploadJobData>) {
    const { context, recordId, attachments } = job.data;
    
    const processedAttachments = [];
    const failedAttachmentIds = [];

    for (const attachment of attachments) {
      try {
        // If attachment has path and size, it's an existing attachment
        if (attachment.path && attachment.size) {
          processedAttachments.push(attachment);
          continue;
        }

        // If attachment has URL, download and process it
        if (attachment.url) {
          const downloadedAttachment = await this.downloadAndStoreAttachment(
            context,
            attachment.url,
            attachment.id
          );
          processedAttachments.push(downloadedAttachment);
        }
      } catch (error) {
        console.error(`Failed to process attachment ${attachment.id}:`, error);
        failedAttachmentIds.push(attachment.id);
      }
    }

    // Remove failed attachments from the record
    const validAttachments = processedAttachments.filter(
      (att) => !failedAttachmentIds.includes(att.id)
    );

    // Update the record with processed attachments
    // This should integrate with your data service to update the record
    // For now, we'll just return the processed attachments
    
    return {
      recordId,
      processedAttachments: validAttachments,
      failedAttachmentIds,
    };
  }

  private async downloadAndStoreAttachment(
    context: any,
    url: string,
    attachmentId: string
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
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const contentLength = response.headers['content-length'];
    const contentDisposition = response.headers['content-disposition'];
    
    // Extract filename from URL or content-disposition header
    let filename = url.split('/').pop()?.split('?')[0] || 'attachment';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
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