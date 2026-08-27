import { SilentTypeConversionError } from '~/lib/error';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { isBt, isMm, isOo, parseLinksValue } from '../utils';
import { ncIsNaN, ncIsObject } from '~/lib/is';
import { ColumnType, LinkToAnotherRecordType } from '~/lib/Api';
import { isMMOrMMLike } from '~/lib/UITypes';
import { LookupHelper } from './Lookup';

export class LinksHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): Record<string, any> | null {
    if (params.serializeSearchQuery) return null;

    if (!isMm(params.col)) throw new SilentTypeConversionError();

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
    // Clipboard text is what the cell renders ("N Links" / the display
    // value) — the lossless envelope rides the clipboard item instead (see
    // serializeValue).
    if (isMm(params.col)) {
      return parseLinksValue(!ncIsNaN(value) ? +value : 0, params);
    } else if (isBt(params.col) || isOo(params.col)) {
      return new LookupHelper().parsePlainCellValue(value, params) ?? '';
    }

    return value ?? '';
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params'] & { rowId: string }
  ): string {
    return parseLinksValue(value, params) ?? '';
  }
}
