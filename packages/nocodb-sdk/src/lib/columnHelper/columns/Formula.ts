import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { parseProp } from '~/lib/helperFunctions';
import { ColumnHelper } from '../column-helper';

export class FormulaHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(_value?: any): null {
    return null;
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
