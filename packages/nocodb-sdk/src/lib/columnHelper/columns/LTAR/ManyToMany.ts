import { SilentTypeConversionError } from '~/lib/error';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../../column.interface';
import { ColumnType, LinkToAnotherRecordType } from '~/lib/Api';
import { ncHasProperties } from '~/lib/is';
import { isMMOrMMLike } from '~/lib/UITypes';
import { LookupHelper } from '../Lookup';

export class ManyToManyHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any, params: SerializerOrParserFnProps['params']) {
    if (!isMMOrMMLike(params.col)) throw new SilentTypeConversionError();

    // In-app copies carry the source row/column identity on the clipboard
    // item — the text is the human-readable value. The legacy JSON-envelope
    // text (older copies) is still accepted below.
    const item = params.clipboardItem;
    if (
      item?.rowId != null &&
      item.column?.id &&
      isMMOrMMLike(item.column as ColumnType) &&
      (item.column.colOptions as LinkToAnotherRecordType)
        ?.fk_related_model_id ===
        (params.col.colOptions as LinkToAnotherRecordType)?.fk_related_model_id
    ) {
      return {
        rowId: item.rowId,
        columnId: item.column.id,
        fk_related_model_id: (item.column.colOptions as LinkToAnotherRecordType)
          .fk_related_model_id,
        value: item.dbCellValue,
      };
    }

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
    // Clipboard text is the display value the cell renders — the lossless
    // envelope rides the clipboard item instead (see serializeValue).
    return this.parsePlainCellValue(value, params);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return new LookupHelper().parsePlainCellValue(value, params) ?? '';
  }
}
