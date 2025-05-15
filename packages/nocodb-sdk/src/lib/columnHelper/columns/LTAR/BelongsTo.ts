import { ncHasProperties, ncIsObject } from '~/lib/is';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../../column.interface';
import { LinkToAnotherRecordType } from '~/lib/Api';
import { SilentTypeConversionError } from '~/lib/error';

export class BelongsToHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): Record<string, any> | null {
    let parsedVal = value;

    try {
      parsedVal = typeof value === 'string' ? JSON.parse(value) : value;
    } catch {}

    if (
      !ncHasProperties(parsedVal, ['fk_related_model_id', 'value']) ||
      !ncIsObject(parsedVal?.value) ||
      (parsedVal as Record<string, any>)?.fk_related_model_id !==
        (params.col.colOptions as LinkToAnotherRecordType)?.fk_related_model_id
    ) {
      throw new SilentTypeConversionError();
    }

    return parsedVal;
  }

  parseValue(value: any, params: SerializerOrParserFnProps['params']) {
    return JSON.stringify({
      fk_related_model_id: (params.col.colOptions as LinkToAnotherRecordType)
        .fk_related_model_id,
      value: value || null,
    });
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return this.parseValue(value, params) ?? '';
  }
}
