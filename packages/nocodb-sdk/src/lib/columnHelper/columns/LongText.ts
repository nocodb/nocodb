import { AIRecordType } from '~/lib/Api';
import { parseProp } from '~/lib/helperFunctions';
import { LongTextAiMetaProp } from '~/lib/globals';
import { ncIsObject } from '~/lib/is';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class LongTextHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  public serializeValue(value: any) {
    // This is to remove the quotes added from LongText
    // TODO (refactor): remove this when we have a better way to handle this
    value = value?.toString() ?? null;
    if (value && value.match(/^".*"$/)) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }

    return value ?? null;
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    const columnMeta = parseProp(params.col.meta);

    if (columnMeta[LongTextAiMetaProp]) {
      if (ncIsObject(value)) {
        return (value as AIRecordType)?.value ?? null;
      }
    }

    if (!value) return null;

    return `"${value.replace(/"/g, '\\"')}"`;
  }

  parsePlainCellValue(value: any): string {
    return value?.toString()?.trim() ?? '';
  }
}
