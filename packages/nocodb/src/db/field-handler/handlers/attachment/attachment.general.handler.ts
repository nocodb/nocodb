import { v4 as uuidv4 } from 'uuid';
import { NcError } from 'src/helpers/catchError';
import { ComputedFieldHandler } from '../computed';
import { JobsService } from '~/modules/jobs/jobs.service';
import { JobTypes } from '~/interface/Jobs';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';
import type { AttachmentUrlUploadJobData } from '~/interface/Jobs';

export class AttachmentGeneralHandler extends ComputedFieldHandler {
  constructor(private readonly jobsService?: JobsService) {
    super();
  }

  override async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      context?: NcContext;
      metaService?: MetaService;
      baseModel?: IBaseModelSqlV2;
    };
  }): Promise<{ value: any }> {
    let value = params.value;
    const throwError = (reason?: string) => {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
        reason,
      });
    };
    try {
      if (typeof value === 'string') {
        value = JSON.parse(value);
      } else if (!Array.isArray(value)) {
        throwError();
      }
    } catch (e) {
      throwError();
    }

    // Validate attachment objects according to v3 API spec
    const hasUrlAttachments = [];
    const attachmentsForJob = [];

    for (const attachment of value ?? []) {
      // Validate that attachment has either id (without url) or url (without id)
      if ('id' in attachment && 'url' in attachment) {
        throwError('Attachment object cannot contain both id and url');
      }

      if (!('id' in attachment) && !('url' in attachment) && !('path' in attachment)) {
        throwError('Attachment object must contain either id, url, or path');
      }

      // Handle existing attachment (by id)
      if ('id' in attachment && !('url' in attachment)) {
        // This is an existing attachment to retain
        attachmentsForJob.push({
          id: attachment.id,
          path: attachment.path || '',
          size: attachment.size || 0,
        });
      }

      // Handle new URL-based attachment
      if ('url' in attachment && !('id' in attachment)) {
        if (attachment.url.startsWith('data:')) {
          throwError(`Attachment urls do not support data urls`);
        }

        if (attachment.url.length > 8 * 1024) {
          throwError(`Attachment url '${attachment.url}' is too long`);
        }

        // Generate an ID for the new attachment
        const attachmentId = uuidv4();
        hasUrlAttachments.push(attachmentId);
        attachmentsForJob.push({
          id: attachmentId,
          url: attachment.url,
        });
      }

      // Handle legacy path-based attachment
      if ('path' in attachment) {
        if (attachment.url) {
          if (attachment.url.startsWith('data:')) {
            throwError(`Attachment urls do not support data urls`);
          }

          if (attachment.url.length > 8 * 1024) {
            throwError(`Attachment url '${attachment.url}' is too long`);
          }
        }
        
        attachmentsForJob.push({
          id: attachment.id || uuidv4(),
          path: attachment.path,
          size: attachment.size || 0,
        });
      }
    }

    // If there are URL attachments to process, dispatch the job
    if (hasUrlAttachments.length > 0 && this.jobsService && params.options?.context) {
      const recordId = params.row?.id || uuidv4(); // Use row ID if available
      
      const jobData: AttachmentUrlUploadJobData = {
        jobName: JobTypes.AttachmentUrlUpload,
        context: params.options.context,
        user: params.options.context.user || {},
        recordId,
        attachments: attachmentsForJob,
      };

      await this.jobsService.add(JobTypes.AttachmentUrlUpload, jobData);
    }

    return { value };
  }
}
