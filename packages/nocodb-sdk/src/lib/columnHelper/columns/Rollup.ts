import { ColumnType, LinkToAnotherRecordType, RollupType } from '~/lib/Api';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { ColumnHelper } from '../column-helper';
import { getRenderAsTextFunForUiType, parseProp } from '~/lib/helperFunctions';
import UITypes from '~/lib/UITypes';
import { ComputedTypePasteError } from '~/lib/error';
import { precisionFormats } from '../utils';

export class RollupHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    precision: precisionFormats[0],
    isLocaleString: false,
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
    if (!value) return null;

    const { col, meta, metas } = params;

    const colOptions = col.colOptions as RollupType;
    const relationColumnOptions = colOptions.fk_relation_column_id
      ? (meta?.columns?.find((c) => c.id === colOptions.fk_relation_column_id)
          ?.colOptions as LinkToAnotherRecordType)
      : null;
    const relatedTableMeta =
      relationColumnOptions?.fk_related_model_id &&
      metas?.[relationColumnOptions.fk_related_model_id as string];

    const childColumn = relatedTableMeta?.columns.find(
      (c: ColumnType) => c.id === colOptions.fk_rollup_column_id
    ) as ColumnType | undefined;

    if (!childColumn) return value;

    const renderAsTextFun = getRenderAsTextFunForUiType(
      (childColumn.uidt ?? UITypes.SingleLineText) as UITypes
    );

    childColumn.meta = {
      ...parseProp(childColumn?.meta),
      ...parseProp(col?.meta),
    };

    if (renderAsTextFun.includes(colOptions.rollup_function)) {
      childColumn.uidt = UITypes.Decimal;
    }

    return ColumnHelper.parseValue(value, { ...params, col: childColumn! });
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return this.parseValue(value, params) ?? '';
  }
}
