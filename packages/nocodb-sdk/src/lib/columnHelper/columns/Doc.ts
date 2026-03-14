import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class DocHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    _value: any,
    params: SerializerOrParserFnProps['params']
  ): any {
    if (params.serializeSearchQuery) return null;

    // For paste operations, pass through the structured clipboard data
    // so the frontend can use it to call the duplication API.
    const item = params.clipboardItem;
    if (item?.dbCellValue !== undefined) {
      return {
        value: item.dbCellValue,
        rowId: item.rowId,
        columnId: item.column?.id,
      };
    }

    return undefined;
  }

  parseValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    // Return the doc_id as-is for clipboard storage
    return value || null;
  }

  parsePlainCellValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    // Show "Document" as plain text representation
    return value ? 'Document' : '';
  }
}
