import { NcError } from 'src/helpers/catchError';
import { dataWrapper } from 'src/helpers/dbHelpers';
import { ComputedFieldHandler } from '../computed';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';

export class AttachmentGeneralHandler extends ComputedFieldHandler {
  override async parseUserInput(params: {
    value: any;
    row: any;
    oldData?: any;
    column: Column;
    options?: {
      context?: NcContext;
      metaService?: MetaService;
      baseModel?: IBaseModelSqlV2;
    };
  }): Promise<{ value: any }> {
    let oldValue = params.oldData
      ? dataWrapper(params.oldData).getByColumnNameTitleOrId(params.column)
      : '[]';
    let value = params.value;
    if (!value) {
      return value;
    }
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
      if (typeof oldValue === 'string') {
        oldValue = JSON.parse(oldValue);
      }
    } catch (e) {
      throwError();
    }

    // remove all url-uploading attachments, it'll be handled later
    value = value.filter((k) => !k.url);

    // Confirm that all urls are valid urls
    for (const attachment of value ?? []) {
      if (attachment.id) {
        const oldAttachmentRow = oldValue.find(
          (attr) => attr.id === attachment.id,
        );
        if (!oldAttachmentRow) {
          throwError(`Attachment id ${attachment.id} not exists on old data`);
        }
        // if id exists, persist old value
        Object.assign(attachment, oldAttachmentRow);
      }
      if (!('url' in attachment) && !('path' in attachment)) {
        throwError('Attachment object must contain either url or path');
      }

      if (attachment.url) {
        if (attachment.url.startsWith('data:')) {
          throwError(`Attachment urls do not support data urls`);
        }

        if (attachment.url.length > 8 * 1024) {
          throwError(`Attachment url '${attachment.url}' is too long`);
        }
      }
    }

    return { value };
  }
}
