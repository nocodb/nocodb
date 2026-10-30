import { SortOrderBy, UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { NcContext } from '~/interface/config';
import type { Column, SelectOption } from '~/models';
import { FieldHandler } from '~/db/field-handler';
import { Sort } from '~/models';
import { SORT_STORED } from '~/models/Sort';
import { NcError } from '~/helpers/catchError';
import { getModelContext, setModelContext } from '~/helpers/modelContext';
import { escapeBindingPlaceholders, sanitize } from '~/helpers/sqlSanitize';
import { getRefColumnIfAlias } from '~/helpers';
import { compilesStoredConditionWithEmails } from '~/helpers/accessSource';

function toSort(context: NcContext, _sort: Sort): Sort {
  const sort = _sort instanceof Sort ? _sort : new Sort(_sort);
  // Same guard as conditionV2 — a caller-constructed instance may be unstamped
  if (!getModelContext(sort)) setModelContext(sort, context);
  return sort;
}

// skip disabled sorts (enabled === false or enabled === 0)
function isSortDisabled(sort: Sort) {
  return sort.enabled === false || (sort.enabled as any) === 0;
}

// The column sortV2 orders by for a sort, or null when it skips the sort.
export async function getAppliedSortColumn(context: NcContext, _sort: Sort) {
  const sort = toSort(context, _sort);
  if (isSortDisabled(sort)) return null;
  return getRefColumnIfAlias(context, await sort.getColumn());
}

export default async function sortV2(
  baseModelSqlv2: IBaseModelSqlV2,
  sortList: Sort[],
  qb: Knex.QueryBuilder,
  alias?: string,
  throwErrorIfInvalid = false,
) {
  if (!sortList?.length) return;

  const knex = baseModelSqlv2.dbDriver;
  const context = baseModelSqlv2.context;
  const fieldHandler = FieldHandler.fromBaseModel(baseModelSqlv2);

  // T-SQL refuses to ORDER BY columns of `text`, `ntext`, `image`, or `xml`
  // (LOB / deprecated types). They only back leaf string columns where
  // `column_name` is always present, and a `CAST(... AS NVARCHAR(n))`
  // makes them sortable regardless of the column's uidt. Handle this at
  // the orchestrator level since it's keyed on `column.dt`, not
  // `column.uidt` — the per-type handlers can't see the underlying dt
  // without each repeating the same check.
  const mssqlUnsortableDt = new Set(['text', 'ntext', 'image', 'xml']);

  // Cast to a *bounded* NVARCHAR, not NVARCHAR(MAX). A MAX/LOB sort key is
  // still unsortable in-memory: SQL Server over-estimates its size, gets a
  // capped memory grant and spills the sort to tempdb (seconds, not ms).
  // 4000 NVARCHAR chars = 8000 bytes, the widest bound that fits a sort key.
  // Trade-off: rows sharing a 4000-char prefix sort in an undefined order
  // amongst themselves — acceptable for a sort key on these rare LOB types.
  const MSSQL_SORT_KEY_WIDTH = 4000;

  // Oracle refuses LOB columns as comparison keys (ORA-22848) — and
  // LongText / JSON / Attachment all store as CLOB there. Sort on the first
  // 2000 chars via DBMS_LOB.SUBSTR, which returns VARCHAR2 for CLOB and
  // NVARCHAR2 for NCLOB (both sortable, and well under the 4000-byte
  // VARCHAR2 cap for multi-byte content).
  const oracleUnsortableDt = new Set(['clob', 'nclob']);

  // A repeated sort key can't reorder anything, and MSSQL rejects a column
  // listed twice in ORDER BY (error 169), so only its first occurrence applies.
  const appliedSortKeys = new Set<string>();

  for (const _sort of sortList) {
    const sort = toSort(context, _sort);
    if (isSortDisabled(sort)) continue;

    const column = await getRefColumnIfAlias(context, await sort.getColumn());

    if (!column) {
      if (throwErrorIfInvalid) {
        NcError.get(context).fieldNotFound(sort.fk_column_id);
      }
      continue;
    }

    const byOptionOrder =
      sort.order_by === SortOrderBy.OPTION_ORDER &&
      column.uidt === UITypes.SingleSelect;
    const sortKey = `${column.id}:${byOptionOrder ? 'option' : 'value'}`;
    if (appliedSortKeys.has(sortKey)) continue;
    appliedSortKeys.add(sortKey);

    const direction: 'asc' | 'desc' =
      sort.direction === 'desc' ? 'desc' : 'asc';
    // Only the PK surely holds no NULLs; NULLS on it defeats pg's btree order.
    const nulls = column.pk
      ? undefined
      : sort.direction === 'desc'
      ? 'LAST'
      : 'FIRST';

    if (byOptionOrder) {
      const field = alias
        ? `${alias}.${column.column_name}`
        : column.column_name;
      const dt = (column.dt ?? '').toLowerCase();
      let valueSql = '??';
      if (baseModelSqlv2.isMssql && mssqlUnsortableDt.has(dt)) {
        valueSql = `CAST(?? AS NVARCHAR(${MSSQL_SORT_KEY_WIDTH}))`;
      } else if (baseModelSqlv2.isOracle && oracleUnsortableDt.has(dt)) {
        valueSql = 'DBMS_LOB.SUBSTR(??, 2000, 1)';
      } else if (baseModelSqlv2.isPg) {
        // Native enums would reject a literal that isn't one of their labels.
        valueSql = 'CAST(?? AS TEXT)';
      }
      const rank = optionOrderSortKey({
        titles: await getOptionTitles(column),
        valueSql,
        valueBindings: [field],
        direction,
        nulls,
        // SQL Server caps a statement at 2100 parameters.
        inlineTitles: baseModelSqlv2.isMssql,
      });
      qb.orderBy(sanitize(knex.raw(rank.sql, rank.bindings)), direction);
      continue;
    }

    if (
      baseModelSqlv2.isMssql &&
      mssqlUnsortableDt.has((column.dt ?? '').toLowerCase())
    ) {
      qb.orderBy(
        sanitize(
          knex.raw(`CAST(?? AS NVARCHAR(${MSSQL_SORT_KEY_WIDTH}))`, [
            column.column_name,
          ]),
        ),
        direction,
        nulls,
      );
      continue;
    }

    if (
      baseModelSqlv2.isOracle &&
      oracleUnsortableDt.has((column.dt ?? '').toLowerCase())
    ) {
      qb.orderByRaw(
        sanitize(
          knex.raw(
            `DBMS_LOB.SUBSTR(??, 2000, 1) ${direction}${
              nulls ? ` NULLS ${nulls}` : ''
            }`,
            [column.column_name],
          ),
        ),
      );
      continue;
    }

    // A stored (view) sort orders as for a signed-in user, user formulas by email
    // (except in shared-base sessions that can edit; see compilesStoredConditionWithEmails).
    const sortBaseModel =
      sort[SORT_STORED] && compilesStoredConditionWithEmails(context)
        ? baseModelSqlv2.getNonPublicClone()
        : baseModelSqlv2;
    await (sortBaseModel === baseModelSqlv2
      ? fieldHandler
      : FieldHandler.fromBaseModel(sortBaseModel)
    ).applySort(qb, column, direction, {
      alias,
      nulls,
      context: sortBaseModel.context,
      knex,
      baseModel: sortBaseModel,
    });
  }
}

export async function getOptionTitles(column: Column) {
  const colOptions = await column.getColOptions<{
    options?: SelectOption[];
  }>();
  return [...new Set((colOptions?.options ?? []).map((o) => o.title))].filter(
    (t) => t != null,
  );
}

// Rank of a SingleSelect value in its option list. A value that isn't an
// option sorts after every option in either direction. NULL is ranked too —
// knex drops NULLS FIRST/LAST on raw expressions. `valueBindings` binds one
// occurrence of `valueSql`, which appears twice.
export function optionOrderSortKey({
  titles,
  valueSql,
  valueBindings,
  direction,
  nulls,
  inlineTitles = false,
}: {
  titles: string[];
  valueSql: string;
  valueBindings: unknown[];
  direction: 'asc' | 'desc';
  nulls?: 'FIRST' | 'LAST';
  // Embed titles as N'…' literals instead of one binding each (MSSQL only).
  inlineTitles?: boolean;
}): { sql: string; bindings: unknown[] } {
  const unknownRank = direction === 'desc' ? -1 : titles.length;
  const nullRank =
    direction === 'desc'
      ? nulls === 'FIRST'
        ? titles.length
        : -2
      : nulls === 'LAST'
      ? titles.length + 1
      : -1;

  const titleSql = (t: string) =>
    inlineTitles
      ? escapeBindingPlaceholders(`N'${t.replace(/'/g, "''")}'`)
      : '?';

  const rank = titles.length
    ? `CASE ${valueSql} ${titles
        .map((t, i) => `WHEN ${titleSql(t)} THEN ${i}`)
        .join(' ')} ELSE ${unknownRank} END`
    : `${unknownRank}`;

  return {
    sql: `CASE WHEN ${valueSql} IS NULL THEN ${nullRank} ELSE ${rank} END`,
    bindings: [
      ...valueBindings,
      ...(titles.length ? valueBindings : []),
      ...(titles.length && !inlineTitles ? titles : []),
    ],
  };
}
