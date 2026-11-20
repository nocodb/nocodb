import {
  isSystemColumn,
  isVirtualCol,
  parseSearchDate,
  parseSearchNumber,
  searchDayTimezone,
  searchFieldType,
  searchMatchKind,
  UITypes,
} from 'nocodb-sdk';
import type { SearchFieldInfo } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, FormulaColumn, RollupColumn } from '~/models';
import type {
  SearchMatch,
  SearchProvider,
  SearchRequest,
} from '~/db/search/types';
import { Filter, View } from '~/models';
import { isSharedViewAccess } from '~/helpers/accessSource';

type LeafRule = Pick<
  Filter,
  'comparison_op' | 'comparison_sub_op' | 'value' | 'meta'
>;

// Largest value each integer column type holds; a search number outside it can't match.
const INTEGER_DT_MAX: Array<[RegExp, number]> = [
  [/^(smallint|int2|smallserial)$/i, 32767],
  [/^(int|int4|integer|serial|mediumint)$/i, 2147483647],
  [/^(bigint|int8|bigserial)$/i, Number.MAX_SAFE_INTEGER],
];

/** Whether `value` can be compared with `column` without a cast error. */
function fitsNumericColumn(
  column: Column,
  uidt: string | undefined,
  value: number,
) {
  // Computed fields compare as numeric expressions.
  if (isVirtualCol(column) || column.uidt === UITypes.Formula) return true;
  const integerMax = INTEGER_DT_MAX.find(([re]) =>
    re.test(column.dt ?? ''),
  )?.[1];
  if (integerMax !== undefined) {
    return Number.isInteger(value) && Math.abs(value) <= integerMax;
  }
  return (
    (uidt !== UITypes.Rating && uidt !== UITypes.Year) ||
    Number.isInteger(value)
  );
}

/**
 * Tier 0: OR of one condition per visible field, compiled by conditionV2 like
 * any filter, so links, lookups, users and formulas match their displayed
 * value through the same handlers the filter toolbar uses.
 */
export class ScanSearchProvider implements SearchProvider {
  readonly tier = 0;

  async match(
    baseModel: IBaseModelSqlV2,
    { term, timezone }: SearchRequest,
  ): Promise<SearchMatch> {
    const columns = await this.searchableColumns(baseModel);
    const children = await this.filtersFor(columns, term, timezone);
    return { kind: 'condition', filters: [this.anyOf(baseModel, children)] };
  }

  /** One OR'ed live condition per field that can match `term`. */
  async filtersFor(
    columns: Column[],
    term: string,
    timezone?: string,
  ): Promise<Filter[]> {
    const children: Filter[] = [];
    for (const column of columns) {
      const rule = await this.ruleFor(column, term, timezone);
      if (rule) {
        children.push(
          new Filter({ ...rule, fk_column_id: column.id, logical_op: 'or' }),
        );
      }
    }
    return children;
  }

  /** The view's visible fields (all fields without a view). */
  async searchableColumns(baseModel: IBaseModelSqlV2) {
    const columns = await baseModel.model.getColumns();
    // A shared view never publishes a hidden field, display value included.
    const alwaysPv = !isSharedViewAccess(baseModel.context);

    let visible: Set<string> | undefined;
    if (baseModel.viewId) {
      const viewColumns = await View.getColumns(
        baseModel.context,
        baseModel.viewId,
      );
      if (viewColumns?.length) {
        visible = new Set(
          viewColumns.filter((vc) => vc.show).map((vc) => vc.fk_column_id),
        );
      }
    }

    return columns.filter(
      (c) =>
        ((c.pv && alwaysPv) || !visible || visible.has(c.id)) &&
        (c.pv || !isSystemColumn(c)),
    );
  }

  private async ruleFor(
    column: Column,
    term: string,
    timezone?: string,
  ): Promise<LeafRule | undefined> {
    const field = await this.searchField(column);

    switch (searchMatchKind(field)) {
      case 'text':
        // The like handler escapes % _ \ in the term itself.
        return { comparison_op: 'like', value: `%${term}%` };
      case 'number': {
        const value = parseSearchNumber(term);
        return value === undefined ||
          !fitsNumericColumn(column, searchFieldType(field), value)
          ? undefined
          : { comparison_op: 'eq', value: String(value) };
      }
      case 'date': {
        const value = parseSearchDate(term);
        if (value === undefined) return undefined;
        const dayTimezone = searchDayTimezone(field, timezone);
        return {
          comparison_op: 'eq',
          comparison_sub_op: 'exactDate',
          value,
          ...(dayTimezone ? { meta: { timezone: dayTimezone } } : {}),
        };
      }
      default:
        return undefined;
    }
  }

  /** Formulas, rollups and links need their options to resolve a type. */
  private async searchField(column: Column): Promise<SearchFieldInfo> {
    const colOptions =
      column.uidt === UITypes.Formula ||
      column.uidt === UITypes.Rollup ||
      column.uidt === UITypes.Links
        ? await column.getColOptions<FormulaColumn | RollupColumn>()
        : undefined;
    return { uidt: column.uidt, dt: column.dt, meta: column.meta, colOptions };
  }

  /** OR group over `children`; with no searchable field nothing matches. */
  anyOf(baseModel: IBaseModelSqlV2, children: Filter[]) {
    if (children.length) {
      return new Filter({ is_group: true, logical_op: 'and', children });
    }
    const pk = baseModel.model.primaryKey;
    return new Filter({
      is_group: true,
      logical_op: 'and',
      children: pk
        ? [new Filter({ fk_column_id: pk.id, comparison_op: 'null' })]
        : [],
    });
  }
}
