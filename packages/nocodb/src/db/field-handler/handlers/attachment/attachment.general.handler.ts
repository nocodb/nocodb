import { detailedDiff, type NcContext } from 'nocodb-sdk';
import { ComputedFieldHandler } from '../computed';
import type { MetaService } from '~/meta/meta.service';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { NcError } from '~/helpers/catchError';
import { dataWrapper } from '~/helpers/dbHelpers';
import { extractProps } from '~/helpers/extractProps';
import { type Column, FileReference } from '~/models';

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
    let oldValue =
      params.oldData &&
      dataWrapper(params.oldData).getByColumnNameTitleOrId(params.column);
    oldValue = oldValue || '[]';
    let oldValueMap: Map<string, any>;
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
      oldValueMap = new Map(oldValue.map((val) => [val.id, val]));
    } catch (e) {
      throwError();
    }

    let tempIndex = 1;
    // Confirm that all urls are valid urls
    for (const attachment of value ?? []) {
      if (attachment.id) {
        const oldAttachmentRow = oldValueMap.get(attachment.id);
        if (!oldAttachmentRow) {
          throwError(`Attachment id ${attachment.id} not exists on old data`);
        }
        // if id exists, persist old value
        Object.assign(attachment, oldAttachmentRow);
      } else {
        attachment.id = 'temp_' + tempIndex++;
      }
    }
    const { removed } = detailedDiff(
      new Array(oldValueMap.keys()),
      value.map((k) => k.id),
    );
    await FileReference.delete(params.options.context, removed);
    return {
      value: value.map((attr) => {
        return attr.id.startsWith('temp_')
          ? {
              id: attr.id,
              url: attr.url,
              status: 'uploading',
            }
          : extractProps(attr, [
              'id',
              'url',
              'path',
              'title',
              'mimetype',
              'size',
              'icon',
              'width',
              'height',
            ]);
      }),
    };
  }
}
