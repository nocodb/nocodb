import { SilentTypeConversionError } from '~/lib/error';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../../column.interface';
import { LinkToAnotherRecordType } from '~/lib/Api';
import { ncIsNaN } from '~/lib/is';

export class ManyToManyHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(_value: any, _params: SerializerOrParserFnProps['params']) {
    throw new SilentTypeConversionError();
  }

  parseValue(value: any, params: SerializerOrParserFnProps['params']) {
    return JSON.stringify({
      rowId: params.rowId,
      columnId: params.col.id,
      fk_related_model_id: (params.col.colOptions as LinkToAnotherRecordType)
        .fk_related_model_id,
      value: !ncIsNaN(value) ? +value : 0,
    });
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return this.parseValue(value, params) ?? '';
  }
}
