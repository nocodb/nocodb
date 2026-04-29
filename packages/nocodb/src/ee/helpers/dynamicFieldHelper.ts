import type { Column, Filter } from '~/models';

/**
 * Replace dynamic field references in filter conditions with actual row values.
 *
 * For same-table columns (no fk_link_col_id): replaces filter.value with the
 * actual row data from the referenced column.
 *
 * For cross-table columns (or when valueCol is not in tableColumns): annotates
 * the filter with _crossTableRowId so conditionV2 can build an EXISTS subquery.
 */
export function replaceDynamicFieldWithValue(
  row: any,
  rowId: any,
  tableColumns: Column[],
  readByPk: (
    id: any,
    validateFormula?: boolean,
    query?: any,
    options?: Record<string, any>,
  ) => Promise<any>,
  queryParams?: Record<string, string>,
) {
  const replaceWithValue = async (conditions: Filter[]) => {
    const filters: Filter[] = [];

    for (let i = 0; i < conditions.length; i++) {
      if (conditions[i].is_group) {
        const children = await replaceWithValue(conditions[i].children);
        filters.push({
          ...conditions[i],
          children,
        } as Filter);
        continue;
      } else if (!conditions[i].fk_value_col_id) {
        filters.push(conditions[i]);
        continue;
      }

      const condition = { ...conditions[i] } as Filter;

      const valueCol = tableColumns.find(
        (c) => c.id === condition.fk_value_col_id,
      );

      if (valueCol && !condition.fk_link_col_id) {
        // Same-table column (no link involved) — replace with the actual row value
        if (!row) {
          row = await readByPk(
            rowId,
            false,
            {},
            { ignoreView: true, getHiddenColumn: true },
          );

          // if linkRowData is passed over queryParams, then override props from the row
          if (queryParams?.linkRowData) {
            try {
              const rowDataFromReq = JSON.parse(queryParams.linkRowData);
              if (rowDataFromReq && typeof rowDataFromReq === 'object')
                Object.assign(row, rowDataFromReq);
            } catch {
              // do nothing
            }
          }
        }
        condition.value = row[valueCol.title] ?? null;
      } else {
        // Cross-table column (or self-referencing via link) — annotate with
        // rowId so conditionV2 can build an EXISTS subquery filtered to this
        // source row
        condition._crossTableRowId = rowId;
      }
      filters.push(condition);
    }

    return filters;
  };
  return replaceWithValue;
}
