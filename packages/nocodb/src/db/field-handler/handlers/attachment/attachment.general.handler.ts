import { NcError } from 'src/helpers/catchError';
import { ComputedFieldHandler } from '../computed';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';

export class AttachmentGeneralHandler extends ComputedFieldHandler {
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

    // Confirm that all urls are valid urls
    for (const attachment of value ?? []) {
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
