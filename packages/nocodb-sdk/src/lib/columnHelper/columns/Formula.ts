import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { parseProp } from '~/lib/helperFunctions';
import { ColumnHelper } from '../column-helper';
import { ComputedTypePasteError } from '~/lib/error';

export class FormulaHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    display_column_meta: {
      meta: {},
      custom: {},
    },
    display_type: null,
  };

  serializeValue(
    _value: any,
    params: SerializerOrParserFnProps['params']
  ): null {
    if (params.isMultipleCellPaste) {
      return undefined;
    } else {
      throw new ComputedTypePasteError();
    }
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    const columnMeta = parseProp(params.col?.meta);
    const childColumn = {
      uidt: columnMeta.display_type,
      ...columnMeta.display_column_meta,
    };

    return ColumnHelper.parseValue(value, {
      ...params,
      col: childColumn,
    });
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return this.parseValue(value, params) ?? '';
  }
}
