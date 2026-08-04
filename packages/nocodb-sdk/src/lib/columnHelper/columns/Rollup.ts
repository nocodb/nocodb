import { ColumnType, LinkToAnotherRecordType, RollupType } from '~/lib/Api';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { ColumnHelper } from '../column-helper';
import { getMetaWithCompositeKey } from '~/lib/helpers/metaHelpers';
import {
  getRenderAsTextFunForUiType,
  getRollupColumnMeta,
  integerPreservingRollupFunctions,
  integerRollupFunctions,
  parseProp,
} from '~/lib/helperFunctions';
import UITypes from '~/lib/UITypes';
import { isIntegerUiType } from '../utils/cell';
import { getEffectiveDisplayColumn } from '../utils/get-effective-display-column';
import { ComputedTypePasteError } from '~/lib/error';
import { precisionFormats, SeparatorType } from '../utils';
import { isValidValue } from '~/lib/is';
import rfdc from 'rfdc';

const clone = rfdc();

export class RollupHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    precision: precisionFormats[0],
    separator: SeparatorType.NonePeriod,
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

    const colOptions = col.colOptions as RollupType;
    const relationColumnOptions = colOptions.fk_relation_column_id
      ? (meta?.columns?.find((c) => c.id === colOptions.fk_relation_column_id)
          ?.colOptions as LinkToAnotherRecordType)
      : null;
    // For cross-base links the related table is keyed by its own base, so use
    // fk_related_base_id when present; fall back to the rollup table's base_id
    // for same-base links. Mirrors the Rollup cell renderer (Rollup.vue).
    const baseId = relationColumnOptions?.fk_related_base_id || meta?.base_id;
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

        // Resolve the formula's display_type into the effective child column, then
        // layer the rollup-specific meta on top of the display format meta. Base the
        // meta on display_column_meta.meta explicitly (not the effective column's
        // meta) so it stays {} when display_column_meta has no `meta` key — otherwise
        // the formula's own meta would leak in.
        const displayColumnMeta = parseProp(colMeta.display_column_meta);
        childColumn = getEffectiveDisplayColumn(colMeta, childColumn);
        childColumn = {
          ...childColumn,
          meta: {
            ...parseProp(displayColumnMeta?.meta),
            ...getRollupColumnMeta(
              col?.meta,
              colMeta.display_type,
              colOptions.rollup_function
            ),
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
        ...getRollupColumnMeta(
          col?.meta,
          childColumn.uidt as UITypes,
          colOptions.rollup_function
        ),
      };
    }

    if (renderAsTextFun.includes(colOptions.rollup_function)) {
      const isInteger =
        integerRollupFunctions.includes(colOptions.rollup_function) ||
        (isIntegerUiType(childColumn) &&
          integerPreservingRollupFunctions.includes(
            colOptions.rollup_function
          ));

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
