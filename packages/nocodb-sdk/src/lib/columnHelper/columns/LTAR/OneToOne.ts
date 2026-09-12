import { ncHasProperties, ncIsObject } from '~/lib/is';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../../column.interface';
import { ColumnType, LinkToAnotherRecordType } from '~/lib/Api';
import { isLinksOrLTAR } from '~/lib/UITypes';
import { SilentTypeConversionError } from '~/lib/error';
import { LookupHelper } from '../Lookup';

export class OneToOneHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): Record<string, any> | null {
    // In-app copies carry the raw related record on the clipboard item — the
    // text is the human-readable display value. The legacy JSON-envelope text
    // (older copies) is still accepted below.
    const item = params.clipboardItem;
    if (
      item &&
      isLinksOrLTAR(item.column as ColumnType) &&
      (item.column?.colOptions as LinkToAnotherRecordType)
        ?.fk_related_model_id ===
        (params.col.colOptions as LinkToAnotherRecordType)
          ?.fk_related_model_id &&
      ncIsObject(item.dbCellValue)
    ) {
      return {
        fk_related_model_id: (params.col.colOptions as LinkToAnotherRecordType)
          .fk_related_model_id,
        value: item.dbCellValue,
      };
    }

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
