import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { parseProp } from '~/lib/helperFunctions';
import { ColumnHelper } from '../column-helper';
import { ComputedTypePasteError } from '~/lib/error';
import { FormulaDataTypes } from '~/lib/formulaHelpers';
import { ncIsNaN } from '~/lib/is';

export class FormulaHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    display_column_meta: {
      meta: {},
      custom: {},
    },
    display_type: null,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (params.serializeSearchQuery) {
      const dataType =
        (params.col?.colOptions as any)?.parsed_tree?.dataType ??
        FormulaDataTypes.STRING;

      if (dataType === FormulaDataTypes.NUMERIC) {
        return ncIsNaN(value) ? '' : value;
      }

      return value;
    }

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
