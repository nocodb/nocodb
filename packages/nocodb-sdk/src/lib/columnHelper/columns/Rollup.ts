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
import {
  isRollupFormula,
  rollupFormulaKeepsTargetFormat,
  rollupFormulaResultUidt,
} from '~/lib/formula/rollupFormula';
import { isIntegerUiType } from '../utils/cell';
import { getEffectiveDisplayColumn } from '../utils/get-effective-display-column';
import { ComputedTypePasteError } from '~/lib/error';
import { precisionFormats, SeparatorType } from '../utils';
import { isValidValue } from '~/lib/is';
import { NC_ERROR_SENTINEL } from '~/lib/globals';
import rfdc from 'rfdc';

const clone = rfdc();

// field types whose formatting a bare SUM/AVERAGE/MIN/MAX(values) keeps
const ROLLUP_FORMULA_FORMAT_KEEPING_TYPES = [
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Duration,
  UITypes.Date,
  UITypes.DateTime,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.Time,
];

/**
 * The column a rollup formula's value renders as: the rolled-up field for a
 * bare `SUM(values)` / `MIN(values)` … of a currency, date … field, otherwise
 * a column of the formula's result type carrying the rollup's own meta.
 */
export const getRollupFormulaDisplayColumn = (
  col: ColumnType,
  childColumn?: ColumnType
): ColumnType => {
  const parsedTree = (col.colOptions as RollupType)?.parsed_tree;
  const rollupMeta = parseProp(col.meta);

  // a format picked on the field (currency, percent, date …) wins, as for formulas
  if (rollupMeta.display_type) {
    return getEffectiveDisplayColumn(rollupMeta, col);
  }

  if (
    childColumn &&
    rollupFormulaKeepsTargetFormat(parsedTree) &&
    ROLLUP_FORMULA_FORMAT_KEEPING_TYPES.includes(childColumn.uidt as UITypes)
  ) {
    return {
      ...childColumn,
      uidt: [UITypes.CreatedTime, UITypes.LastModifiedTime].includes(
        childColumn.uidt as UITypes
      )
        ? UITypes.DateTime
        : childColumn.uidt,
      meta: { ...parseProp(childColumn.meta), ...rollupMeta },
    };
  }

  const uidt = rollupFormulaResultUidt(parsedTree);
  return {
    ...col,
    uidt,
    // a decimal result shows 2 places until the field says otherwise
    meta:
      uidt === UITypes.Decimal && rollupMeta.precision == null
        ? { ...rollupMeta, precision: 2 }
        : rollupMeta,
  };
};

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
    params: SerializerOrParserFnProps['params'],
    plain = false
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

    if (isRollupFormula(colOptions)) {
      const displayParams = {
        ...params,
        col: getRollupFormulaDisplayColumn(col, childColumn),
      };
      return plain
        ? ColumnHelper.parsePlainCellValue(value, displayParams)
        : ColumnHelper.parseValue(value, displayParams);
    }

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
    // the grid shows an errored cell as ERR!
    if (value === NC_ERROR_SENTINEL) return 'ERR!';
    return this.parseValue(value, params, true) ?? '';
  }
}

export const rollupAllFunctions = [
  { text: 'datatype.Count', value: 'count' },
  { text: 'general.countAll', value: 'countAll' },
  { text: 'general.min', value: 'min' },
  { text: 'general.max', value: 'max' },
  { text: 'general.avg', value: 'avg' },
  { text: 'general.sum', value: 'sum' },
  { text: 'general.countDistinct', value: 'countDistinct' },
  { text: 'general.sumDistinct', value: 'sumDistinct' },
  { text: 'general.avgDistinct', value: 'avgDistinct' },
];
