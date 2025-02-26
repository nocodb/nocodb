import { SilentTypeConversionError } from '~/lib/error';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { isBt, isMm, isOo } from '../utils';
import { ncIsNaN, ncIsObject } from '~/lib/is';
import { LinkToAnotherRecordType } from '~/lib/Api';

export class LinksHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): Record<string, any> | null {
    if (!isMm(params.col)) throw new SilentTypeConversionError();

    let parsedVal = value;

    try {
      parsedVal = typeof value === 'string' ? JSON.parse(value) : value;
    } catch {}

    if (
      !(
        parsedVal &&
        ncIsObject(parsedVal) &&
        ['rowId', 'columnId', 'fk_related_model_id', 'value'].every((key) =>
          (parsedVal as Object).hasOwnProperty(key)
        )
      ) ||
      (parsedVal as Record<string, any>)?.fk_related_model_id !==
        (params.col.colOptions as LinkToAnotherRecordType)?.fk_related_model_id
    ) {
      throw new SilentTypeConversionError();
    }

    return parsedVal;
  }

  parseValue(value: any, params: SerializerOrParserFnProps['params']) {
    if (isMm(params.col)) {
      return JSON.stringify({
        rowId: params.rowId,
        columnId: params.col.id,
        fk_related_model_id: (params.col.colOptions as LinkToAnotherRecordType)
          .fk_related_model_id,
        value: !ncIsNaN(value) ? +value : 0,
      });
    } else if (isBt(params.col) || isOo(params.col)) {
      // fk_related_model_id is used to prevent paste operation in different fk_related_model_id cell
      return JSON.stringify({
        fk_related_model_id: (params.col.colOptions as LinkToAnotherRecordType)
          .fk_related_model_id,
        value: value || null,
      });
    }

    return value ?? '';
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params'] & { rowId: string }
  ): string {
    return this.parseValue(value, params) ?? '';
  }
}
