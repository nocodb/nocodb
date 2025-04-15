import { SilentTypeConversionError } from '~/lib/error';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../../column.interface';
import { LinkToAnotherRecordType } from '~/lib/Api';
import { ncHasProperties } from '~/lib/is';
import { isMm } from '../../utils';

export class ManyToManyHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any, params: SerializerOrParserFnProps['params']) {
    if (!isMm(params.col)) throw new SilentTypeConversionError();

    let parsedVal = value;

    try {
      parsedVal = typeof value === 'string' ? JSON.parse(value) : value;
    } catch {}

    if (
      !ncHasProperties(parsedVal, [
        'rowId',
        'columnId',
        'fk_related_model_id',
        'value',
      ]) ||
      (parsedVal as Record<string, any>)?.fk_related_model_id !==
        (params.col.colOptions as LinkToAnotherRecordType)?.fk_related_model_id
    ) {
      throw new SilentTypeConversionError();
    }

    return parsedVal;
  }

  parseValue(value: any, params: SerializerOrParserFnProps['params']) {
    return JSON.stringify({
      rowId: params.rowId,
      columnId: params.col.id,
      fk_related_model_id: (params.col.colOptions as LinkToAnotherRecordType)
        .fk_related_model_id,
      value,
    });
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return this.parseValue(value, params) ?? '';
  }
}
