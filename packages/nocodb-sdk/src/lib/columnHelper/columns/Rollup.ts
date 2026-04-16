import { ColumnType, LinkToAnotherRecordType, RollupType } from '~/lib/Api';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { ColumnHelper } from '../column-helper';
import { getMetaWithCompositeKey } from '~/lib/helpers/metaHelpers';
import { getRenderAsTextFunForUiType, getRollupColumnMeta, integerRollupFunctions, integerPreservingRollupFunctions, parseProp } from '~/lib/helperFunctions';
import UITypes from '~/lib/UITypes';
import { isIntegerUiType } from '../utils/cell';
import { ComputedTypePasteError } from '~/lib/error';
import { precisionFormats } from '../utils';
import { isValidValue } from '~/lib/is';
import rfdc from 'rfdc';

const clone = rfdc();

export class RollupHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    precision: precisionFormats[0],
    isLocaleString: false,
  };

  serializeValue(
    _value: any,
    params: SerializerOrParserFnProps['params']
  ): null {
    if (params.isMultipleCellPaste || params.serializeSearchQuery) {
      return undefined;
    } else {
      throw new ComputedTypePasteError();
    }
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (!isValidValue(value)) return null;

    const { col, meta, metas } = params;

    const baseId = meta?.base_id;
    const colOptions = col.colOptions as RollupType;
    const relationColumnOptions = colOptions.fk_relation_column_id
      ? (meta?.columns?.find((c) => c.id === colOptions.fk_relation_column_id)
          ?.colOptions as LinkToAnotherRecordType)
      : null;
    const relatedTableMeta =
      relationColumnOptions?.fk_related_model_id &&
      getMetaWithCompositeKey(
        metas,
        baseId,
        relationColumnOptions.fk_related_model_id as string
      );

    let childColumn = relatedTableMeta?.columns.find(
      (c: ColumnType) => c.id === colOptions.fk_rollup_column_id
    ) as ColumnType | undefined;

    if (!childColumn) return value;

    childColumn = clone(childColumn);

    // Resolve Formula fields with display_type (e.g., Currency, Decimal, Percent)
    let isFormulaWithDisplayType = false;

    if (childColumn.uidt === UITypes.Formula) {
      const colMeta = parseProp(childColumn.meta);
      if (colMeta?.display_type) {
        isFormulaWithDisplayType = true;
        const displayColumnMeta = parseProp(colMeta.display_column_meta);

        childColumn = {
          ...childColumn,
          uidt: colMeta.display_type,
          ...displayColumnMeta,
          meta: {
            ...parseProp(displayColumnMeta?.meta),
            ...getRollupColumnMeta(col?.meta, colMeta.display_type, colOptions.rollup_function),
          },
        } as ColumnType;
      }
    }

    const renderAsTextFun = getRenderAsTextFunForUiType(
      (childColumn.uidt ?? UITypes.SingleLineText) as UITypes
    );

    // Only overwrite meta for non-formula display types — formula display types
    // already have the correct meta (e.g., currency_code) set above
    if (!isFormulaWithDisplayType) {
      childColumn.meta = {
        ...parseProp(childColumn?.meta),
        ...getRollupColumnMeta(col?.meta, childColumn.uidt as UITypes, colOptions.rollup_function),
      };
    }

    if (renderAsTextFun.includes(colOptions.rollup_function)) {
      const isInteger =
        integerRollupFunctions.includes(colOptions.rollup_function) ||
        (isIntegerUiType(childColumn) && integerPreservingRollupFunctions.includes(colOptions.rollup_function));

      childColumn.uidt = isInteger ? UITypes.Number : UITypes.Decimal;
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

export const rollupAllFunctions = [
  { text: 'datatype.Count', value: 'count' },
  { text: 'general.min', value: 'min' },
  { text: 'general.max', value: 'max' },
  { text: 'general.avg', value: 'avg' },
  { text: 'general.sum', value: 'sum' },
  { text: 'general.countDistinct', value: 'countDistinct' },
  { text: 'general.sumDistinct', value: 'sumDistinct' },
  { text: 'general.avgDistinct', value: 'avgDistinct' },
];
