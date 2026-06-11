import { extractFilterFromXwhere, FormulaDataTypes, UITypes } from 'nocodb-sdk';
import type { ClientType } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type {
  BarcodeColumn,
  FormulaColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import { DBQueryClient } from '~/dbQueryClient';
import { sanitize } from '~/helpers/sqlSanitize';
import conditionV2 from '~/db/conditionV2';
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { NcError } from '~/helpers/catchError';
import {
  applyPaginate,
  extractSortsObject,
  getAs,
  getColumnName,
} from '~/helpers/dbHelpers';
import { BaseUser, Column, Filter, Sort } from '~/models';
import { getAliasGenerator } from '~/utils';
import { NC_DISABLE_GROUP_BY_LIMIT } from '~/utils/nc-config';

// PR review fix #2: Shared helper for UUID group-by to avoid 4x code duplication.
// Casts UUID to text on PostgreSQL (avoids type mismatch), passes through on other DBs.
const buildUuidGroupBySelector = ({
  baseModel,
  columnName,
  alias,
}: {
  baseModel: IBaseModelSqlV2;
  columnName: string;
  alias: string;
}) => {
  if (baseModel.isPg) {
    return baseModel.dbDriver.raw('(??)::text as ??', [columnName, alias]);
  }
  return baseModel.dbDriver.raw('?? as ??', [columnName, alias]);
};

// Returns a SQL expression that converts blank (null or '') values to NULL
const sqlNullIfBlank = ({
  baseModel,
  columnName,
  isStringType = false,
}: {
  baseModel: IBaseModelSqlV2;
  columnName: string | Knex.QueryBuilder | Knex.Raw;
  isStringType?: boolean;
}) => {
  if (baseModel.isPg && !isStringType) {
    return baseModel.dbDriver.raw(
      `CASE
        WHEN (pg_typeof(:column:) = 'text'::regtype
          OR pg_typeof(:column:) = 'varchar'::regtype
          OR pg_typeof(:column:) = 'char'::regtype)
          AND (:column:)::text = ''
        THEN NULL
        ELSE :column:
      END`,
      { column: columnName },
    );
  }

  if (baseModel.isMssql && !isStringType) {
    return baseModel.dbDriver.raw(
      `CASE WHEN CAST(:column: AS NVARCHAR(MAX)) = '' THEN NULL ELSE :column: END`,
      { column: columnName },
    );
  }

  return baseModel.dbDriver.raw(`NULLIF(??, '')`, [columnName]);
};

export const groupBy = (baseModel: IBaseModelSqlV2, logger: Logger) => {
  const list = async (args: {
    where?: string;
    column_name: string;
    subGroupColumnName?: string;
    limit?;
    offset?;
    sort?: string | string[];
    filterArr?: Filter[];
    sortArr?: Sort[];
    minCount?: number; // Minimum count for groups (e.g., 2 to get only duplicates)
  }) => {
    const { where, ...rest } = baseModel._getListArgs(args as any);

    args.column_name = args.column_name || '';
    const subGroupColumnName = args.subGroupColumnName;

    const columns = await baseModel.model.getColumns(baseModel.context);
    const groupByColumns: Record<string, Column> = {};

    const selectors = [];
    const groupBySelectors = [];
    const getAlias = getAliasGenerator('__nc_gb');
    const _subGroupColumn = columns.find(
      (c) =>
        c.title === subGroupColumnName || c.column_name === subGroupColumnName,
    );

    const processColumn = async (col: string, isSubGroup: boolean = false) => {
      let column = columns.find(
        (c) => c.column_name === col || c.title === col,
      );
      if (!column) {
        NcError.get(baseModel.context).fieldNotFound(col);
      }

      if (column.colOptions?.error) {
        NcError.get(baseModel.context).badRequest(
          `Cannot group by column '${column.title}': ${column.colOptions.error}`,
        );
      }

      // if qrCode or Barcode replace it with value column nd keep the alias
      if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt)) {
        column = new Column({
          ...(await column
            .getColOptions<BarcodeColumn | QrCodeColumn>(baseModel.context)
            .then((col) => col.getValueColumn(baseModel.context))),
          asId: column.id,
        });
      }

      const alias = getAs(column);
      if (!isSubGroup) {
        groupByColumns[alias] = column;
        groupBySelectors.push(alias);
      }

      let columnQuery;
      switch (column.uidt) {
        case UITypes.Attachment:
          NcError.get(baseModel.context).badRequest(
            'Group by using attachment column is not supported',
          );
          break;
        case UITypes.Button:
          NcError.get(baseModel.context).badRequest(
            'Group by using Button column is not supported',
          );
          break;
        case UITypes.Links:
        case UITypes.Rollup:
          columnQuery = (
            await genRollupSelectv2({
              baseModelSqlv2: baseModel,
              knex: baseModel.dbDriver,
              columnOptions: (await column.getColOptions(
                baseModel.context,
              )) as RollupColumn,
            })
          ).builder;
          if (!isSubGroup) {
            selectors.push(columnQuery.as(alias));
          }
          break;
        case UITypes.Formula:
          try {
            const _selectQb = await baseModel.getSelectQueryBuilderForFormula(
              column,
            );
            columnQuery = _selectQb.builder;

            // if postgres and formula output defined as string then cast to text for consistent output
            if (
              baseModel.isPg &&
              (column.colOptions as FormulaColumn).getParsedTree().dataType ===
                FormulaDataTypes.STRING
            ) {
              columnQuery = sqlNullIfBlank({
                columnName: baseModel.dbDriver.raw(`??::text`, [columnQuery]),
                baseModel,
                isStringType: true,
              });
            }
          } catch (e) {
            logger.log(e);
            columnQuery = baseModel.dbDriver.raw(`'ERR'`);
          }
          if (!isSubGroup) {
            selectors.push(
              baseModel.dbDriver.raw(`?? as ??`, [columnQuery, alias]),
            );
          }
          break;
        case UITypes.Lookup:
        case UITypes.LinkToAnotherRecord: {
          const lookupQb = await generateLookupSelectQuery({
            baseModelSqlv2: baseModel,
            column,
            alias: null,
            model: baseModel.model,
            getAlias,
          });
          columnQuery = baseModel.dbDriver.raw(lookupQb.builder).wrap('(', ')');
          if (!isSubGroup) {
            selectors.push(
              baseModel.dbDriver.raw(`?? as ??`, [columnQuery, alias]),
            );
          }
          break;
        }
        case UITypes.CreatedTime:
        case UITypes.LastModifiedTime:
        case UITypes.DateTime: {
          const columnName = await getColumnName(
            baseModel.context,
            column,
            columns,
          );
          if (baseModel.dbDriver.clientType() === 'pg') {
            columnQuery = baseModel.dbDriver.raw(
              "date_trunc('minute', ??) + interval '0 seconds'",
              [columnName],
            );
          } else if (
            baseModel.dbDriver.clientType() === 'mysql' ||
            baseModel.dbDriver.clientType() === 'mysql2'
          ) {
            columnQuery = baseModel.dbDriver.raw(
              "DATE_SUB(CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00'), INTERVAL SECOND(??) SECOND)",
              [columnName, columnName],
            );
          } else if (baseModel.dbDriver.clientType() === 'sqlite3') {
            columnQuery = baseModel.dbDriver.raw(
              `strftime('%Y-%m-%d %H:%M:00', ??)`,
              [columnName],
            );
          } else if (baseModel.isMssql) {
            // SQL Server 2022 (major version 16) introduced native DATETRUNC;
            // older versions need a CONVERT round-trip (style 120
            // -> 'yyyy-mm-dd hh:mi:ss'; VARCHAR(16) keeps 'yyyy-mm-dd hh:mi').
            const dbVersion = (await baseModel.getSource())?.meta?.dbVersion;
            const major = parseInt(`${dbVersion ?? ''}`.split('.')[0], 10) || 0;
            const truncSql =
              major >= 16
                ? `DATETRUNC(MINUTE, ??)`
                : `CONVERT(DATETIME, CONVERT(VARCHAR(16), ??, 120))`;
            columnQuery = baseModel.dbDriver.raw(truncSql, [columnName]);
          } else {
            columnQuery = baseModel.dbDriver.raw('DATE(??)', [columnName]);
          }
          if (!isSubGroup) {
            selectors.push(
              baseModel.dbDriver.raw(`?? as ??`, [columnQuery, alias]),
            );
          }
          break;
        }
        case UITypes.JSON: {
          if (baseModel.dbDriver.clientType() === 'pg') {
            const defaultColumnName = await getColumnName(
              baseModel.context,
              column,
              columns,
            );
            columnQuery = baseModel.dbDriver.raw('(??)::jsonb', [
              defaultColumnName,
            ]);
            if (!isSubGroup) {
              selectors.push(
                baseModel.dbDriver.raw(`?? as ??`, [columnQuery, alias]),
              );
            }
          }
          break;
        }
        case UITypes.UUID: {
          // PR review fix #2: Cast UUID to text on PG to avoid type mismatch
          const uuidColumnName = await getColumnName(
            baseModel.context,
            column,
            columns,
          );
          if (baseModel.isPg) {
            columnQuery = baseModel.dbDriver.raw('(??)::text', [
              uuidColumnName,
            ]);
          } else {
            columnQuery = baseModel.dbDriver.raw('??', [uuidColumnName]);
          }
          if (!isSubGroup) {
            selectors.push(
              baseModel.dbDriver.raw(`?? as ??`, [columnQuery, alias]),
            );
          }
          break;
        }
        default: {
          const defaultColumnName = await getColumnName(
            baseModel.context,
            column,
            columns,
          );
          const defaultColumnNameQb = sqlNullIfBlank({
            columnName: defaultColumnName,
            baseModel,
          });
          columnQuery = baseModel.dbDriver.raw('??', [defaultColumnNameQb]);
          if (!isSubGroup) {
            selectors.push(
              baseModel.dbDriver.raw(`?? as ??`, [defaultColumnNameQb, alias]),
            );
          }
          break;
        }
      }
      return columnQuery.toQuery(); // Always return the raw query for subgroup
    };

    await Promise.all(
      args.column_name.split(',').map((col) => processColumn(col)),
    );

    const qb = baseModel.dbDriver(baseModel.tnPath);

    // get aggregated count of each group
    // mssql skips the inner COUNT — it can't push COUNT(*) into a projection
    // that the outer derived table then groups against. Counting is done on
    // the outer derived table for mssql.
    if (!baseModel.isMssql) {
      qb.count(`${baseModel.model.primaryKey?.column_name || '*'} as count`);
    }

    if (subGroupColumnName) {
      // Sanitize at the leaf so the inner `.toSQL()` chain doesn't trip
      // on literal `?` characters from formula string literals.
      const subGroupQuery = baseModel.sanitizeQuery(
        await processColumn(subGroupColumnName, true),
      );
      if (baseModel.isMssql) {
        // mssql projects the sub-group expression as a real NVARCHAR column
        // (__nc_sub_group_col__) on the inner derived table; the outer
        // aggregation then computes COUNT(DISTINCT COALESCE(...)).
        qb.select(
          baseModel.dbDriver.raw(`CAST(?? AS NVARCHAR(MAX)) as ??`, [
            baseModel.dbDriver.raw(subGroupQuery),
            '__nc_sub_group_col__',
          ]),
        );
      } else {
        // The template literal below coerces the wrapped Raw via `.toString()`
        // → `.toQuery()`, whose `formatQuery` step unescapes `\?` back to `?`.
        // We must re-sanitize the composed string before feeding it to the
        // outer `raw(...)` — otherwise those bare `?` chars get counted as
        // placeholders and Knex throws "Expected 1 bindings, saw N".
        const innerExpr = baseModel.sanitizeQuery(
          `COUNT(DISTINCT COALESCE(${sqlNullIfBlank({
            columnName: baseModel.dbDriver.raw(
              baseModel.isPg ? '(??)::text' : '??',
              [baseModel.dbDriver.raw(subGroupQuery)],
            ),
            baseModel,
            isStringType: true,
          })}, '__null__'))`,
        );
        qb.select(
          baseModel.dbDriver.raw(`${innerExpr} as ??`, ['__sub_group_count__']),
        );
      }
    }

    qb.select(...selectors);

    if (+rest?.shuffle) {
      await baseModel.shuffle({ qb });
    }

    const aliasColObjMap = await baseModel.model.getAliasColObjMap(
      baseModel.context,
      columns,
    );

    let sorts = extractSortsObject(
      baseModel.context,
      rest?.sort,
      aliasColObjMap,
    );

    const { filters: filterObj } = extractFilterFromXwhere(
      baseModel.context,
      where,
      aliasColObjMap,
    );
    await conditionV2(
      baseModel,
      [
        ...(baseModel.viewId
          ? [
              new Filter({
                children:
                  (await Filter.rootFilterList(baseModel.context, {
                    viewId: baseModel.viewId,
                  })) || [],
                is_group: true,
              }),
            ]
          : []),
        new Filter({
          children: args.filterArr || [],
          is_group: true,
          logical_op: 'and',
        }),
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
    );

    // Exclude soft-deleted records
    const softDeleteFilterList = await baseModel.getSoftDeleteFilter();
    if (softDeleteFilterList) {
      qb.where(softDeleteFilterList);
    }

    if (!sorts) {
      if (args.sortArr?.length) {
        sorts = args.sortArr;
      } else if (baseModel.viewId) {
        sorts = await Sort.list(baseModel.context, {
          viewId: baseModel.viewId,
        });
      }
    }

    // group by using the column aliases. mssql cannot GROUP BY a select
    // alias or a correlated subquery (rollup / lookup keys), so the group
    // keys are projected into a derived table and aggregated / grouped by
    // those real columns below.
    if (!baseModel.isMssql) {
      qb.groupBy(...groupBySelectors);

      // Add HAVING clause to filter groups by minimum count (e.g., count > 1 for duplicates only)
      if (args.minCount !== undefined && args.minCount > 0) {
        qb.havingRaw('COUNT(??) >= ?', [
          baseModel.model.primaryKey?.column_name || '*',
          args.minCount,
        ]);
      }
    }

    let outerQb: Knex.QueryBuilder;
    if (baseModel.isMssql) {
      // mssql aggregation: SELECT count(*) [, sub-group COUNT(DISTINCT...)],
      // <aliases> FROM (<qb>) __nc_grp_src__ GROUP BY <aliases>
      // [HAVING COUNT(*) >= minCount]
      const aliasRefs = groupBySelectors.map(() => '??');
      const aliasBindings = groupBySelectors;

      const subGroupCountSelect = subGroupColumnName
        ? `, COUNT(DISTINCT COALESCE(??, '__null__')) as ??`
        : '';
      const subGroupCountBindings = subGroupColumnName
        ? ['__nc_sub_group_col__', '__sub_group_count__']
        : [];

      const grouped = baseModel.dbDriver
        .select(
          baseModel.dbDriver.raw(
            `count(*) as ??${subGroupCountSelect}${
              groupBySelectors.length ? `, ${aliasRefs.join(', ')}` : ''
            }`,
            ['count', ...subGroupCountBindings, ...aliasBindings],
          ),
        )
        .from(baseModel.dbDriver.raw('(??) as ??', [qb, '__nc_grp_src__']));

      if (groupBySelectors.length) {
        grouped.groupByRaw(aliasRefs.join(', '), aliasBindings);
      }

      if (args.minCount !== undefined && args.minCount > 0) {
        grouped.havingRaw('COUNT(*) >= ?', [args.minCount]);
      }

      // Same `WITH grouped AS (...) SELECT *` shape as the default path so
      // the orchestration's order-by block can reference `g.<alias>`.
      // T-SQL forbids wrapping a CTE in a derived table, so the final
      // `__nc_group_alias` wrap is skipped below.
      outerQb = baseModel.dbDriver
        .with('grouped', grouped.clone())
        .select('*')
        .from({ g: 'grouped' });
    } else {
      // Wrap in a CTE to allow referencing grouped/aliased columns in subqueries (esp. for Postgres)
      // We'll use: WITH grouped AS (<qb>) SELECT ... FROM grouped g
      outerQb = baseModel.dbDriver
        .with('grouped', qb.clone())
        .select('*')
        .from({ g: 'grouped' });
    }

    if (!NC_DISABLE_GROUP_BY_LIMIT) {
      applyPaginate(outerQb, rest);
    }

    // Apply order by on the outer query, referencing g.<alias>
    for (const sort of sorts || []) {
      if (!groupByColumns[sort.fk_column_id]) {
        continue;
      }
      const column = groupByColumns[sort.fk_column_id];
      if (
        [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
          column.uidt as UITypes,
        )
      ) {
        const baseUsers = await BaseUser.getUsersList(baseModel.context, {
          base_id: column.base_id,
          include_internal_user: true,
        });
        const groupedCol = getAs(column);
        const groupedColQb = sqlNullIfBlank({
          columnName: baseModel.dbDriver.raw('??.??', ['g', groupedCol]),
          baseModel,
          isStringType: true,
        });
        let finalStatement = '';
        if (
          baseModel.dbDriver.clientType() === 'pg' ||
          baseModel.dbDriver.clientType() === 'sqlite3'
        ) {
          finalStatement = `(${DBQueryClient.get(
            baseModel.dbDriver.clientType() as ClientType,
          ).replaceDelimitedWithKeyValue({
            knex: baseModel.dbDriver,
            needleColumn: groupedColQb as any,
            stack: baseUsers.map((user) => ({
              key: user.id,
              value: user.display_name || user.email,
            })),
          })})`;
        } else {
          finalStatement = baseUsers.reduce((acc, user) => {
            const qbReplace = baseModel.dbDriver.raw(`REPLACE(${acc}, ?, ?)`, [
              user.id,
              user.display_name || user.email,
            ]);
            return qbReplace.toQuery();
          }, groupedColQb.toQuery());
        }
        if (!['asc', 'desc'].includes(sort.direction)) {
          outerQb.orderBy(
            'g.count',
            sort.direction === 'count-desc' ? 'desc' : 'asc',
            sort.direction === 'count-desc' ? 'LAST' : 'FIRST',
          );
          outerQb.orderBy(
            sanitize(baseModel.dbDriver.raw(finalStatement)),
            sort.direction,
            'FIRST',
          );
        } else if (baseModel.isMssql) {
          // MSSQL's default NULL ordering is the inverse of PG's (the
          // reference dialect): PG treats NULLs as the largest value
          // (ASC → NULLs last, DESC → NULLs first). knex drops the explicit
          // NULLS clause for raw-column orderBy, so MSSQL falls back to its
          // own default (NULLs smallest) and the group order diverges.
          // Re-create PG semantics with an explicit NULL bucket.
          outerQb.orderByRaw(
            `CASE WHEN (${finalStatement}) IS NULL THEN 1 ELSE 0 END ${sort.direction}, (${finalStatement}) ${sort.direction}`,
          );
        } else {
          outerQb.orderBy(
            sanitize(baseModel.dbDriver.raw(finalStatement)),
            sort.direction,
            sort.direction === 'desc' ? 'LAST' : 'FIRST',
          );
        }
      } else {
        if (!['asc', 'desc'].includes(sort.direction)) {
          outerQb.orderBy(
            'g.count',
            sort.direction === 'count-desc' ? 'desc' : 'asc',
            sort.direction === 'count-desc' ? 'LAST' : 'FIRST',
          );
          outerQb.orderBy(
            baseModel.dbDriver.raw('??.??', ['g', getAs(column)]) as any,
            sort.direction,
            'FIRST',
          );
        } else if (baseModel.isMssql) {
          // See note above — replicate PG's NULL ordering on MSSQL so the
          // group list order matches the other dialects.
          outerQb.orderByRaw(
            `CASE WHEN ??.?? IS NULL THEN 1 ELSE 0 END ${sort.direction}, ??.?? ${sort.direction}`,
            ['g', getAs(column), 'g', getAs(column)],
          );
        } else {
          outerQb.orderBy(
            baseModel.dbDriver.raw('??.??', ['g', getAs(column)]) as any,
            sort.direction,
            sort.direction === 'desc' ? 'LAST' : 'FIRST',
          );
        }
      }
    }

    if (baseModel.isMssql) {
      // T-SQL requires an ORDER BY whenever OFFSET/FETCH pagination is present
      // (applyPaginate always sets .offset()). The sort loop above only emits
      // an ORDER BY when a sort targets a grouped column, so a sortless
      // group-by — or one whose sorts don't match a group key — would reach
      // page 2+ with OFFSET/FETCH and no ORDER BY → "Invalid usage of NEXT in
      // FETCH". pg/mysql/sqlite tolerate OFFSET without ORDER BY. Append a
      // trailing `(SELECT NULL)` no-op key: it's constant for every row so it
      // never reorders results, it just satisfies the syntax rule. Mirrors
      // ensurePaginationOrderBy in the EE single-query client.
      if (!NC_DISABLE_GROUP_BY_LIMIT) {
        outerQb.orderByRaw('(SELECT NULL)');
      }
      // T-SQL forbids wrapping a CTE in a derived table — skip the outer
      // `__nc_group_alias` wrap.
      return await baseModel.execAndParse(outerQb);
    }

    return await baseModel.execAndParse(
      baseModel.dbDriver.from(
        baseModel.dbDriver.raw(outerQb).wrap('(', ') __nc_group_alias'),
      ),
    );
  };

  const count = async (args: {
    where?: string;
    column_name: string;
    limit?;
    offset?;
    filterArr?: Filter[];
    minCount?: number; // Minimum count for groups (e.g., 2 to get only duplicates)
  }) => {
    const { where } = baseModel._getListArgs(args as any);

    args.column_name = args.column_name || '';

    const selectors = [];
    const groupBySelectors = [];
    const getAlias = getAliasGenerator('__nc_gb');

    const columns = await baseModel.model.getColumns(baseModel.context);

    // todo: refactor and avoid duplicate code
    await Promise.all(
      args.column_name.split(',').map(async (col) => {
        let column = columns.find(
          (c) => c.column_name === col || c.title === col,
        );
        if (!column) {
          NcError.get(baseModel.context).fieldNotFound(col);
        }

        // if qrCode or Barcode replace it with value column nd keep the alias
        if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt))
          column = new Column({
            ...(await column
              .getColOptions<BarcodeColumn | QrCodeColumn>(baseModel.context)
              .then((col) => col.getValueColumn(baseModel.context))),
            asId: column.id,
          });

        switch (column.uidt) {
          case UITypes.Attachment:
            NcError.get(baseModel.context).badRequest(
              'Group by using attachment column is not supported',
            );
            break;
          case UITypes.Button: {
            NcError.get(baseModel.context).badRequest(
              'Group by using Button column is not supported',
            );
            break;
          }
          case UITypes.Rollup:
          case UITypes.Links: {
            const rollupColOptions = (await column.getColOptions(
              baseModel.context,
            )) as RollupColumn;
            if (rollupColOptions?.error) {
              selectors.push(
                baseModel.dbDriver.raw(`? as ??`, [null, getAs(column)]),
              );
            } else {
              selectors.push(
                (
                  await genRollupSelectv2({
                    baseModelSqlv2: baseModel,
                    knex: baseModel.dbDriver,
                    columnOptions: rollupColOptions,
                  })
                ).builder.as(getAs(column)),
              );
            }
            groupBySelectors.push(getAs(column));
            break;
          }
          case UITypes.Formula: {
            let selectQb;
            try {
              const _selectQb = await baseModel.getSelectQueryBuilderForFormula(
                column,
              );

              selectQb = baseModel.dbDriver.raw(`?? as ??`, [
                sqlNullIfBlank({
                  columnName: _selectQb.builder,
                  baseModel,
                }),
                getAs(column),
              ]);
            } catch (e) {
              logger.log(e);
              // return dummy select
              selectQb = baseModel.dbDriver.raw(`'ERR' as ??`, [getAs(column)]);
            }

            selectors.push(selectQb);
            groupBySelectors.push(getAs(column));
            break;
          }
          case UITypes.Lookup:
          case UITypes.LinkToAnotherRecord:
            {
              const _selectQb = await generateLookupSelectQuery({
                baseModelSqlv2: baseModel,
                column,
                alias: null,
                model: baseModel.model,
                getAlias,
              });

              const selectQb = baseModel.dbDriver.raw(`?? as ??`, [
                baseModel.dbDriver.raw(_selectQb.builder).wrap('(', ')'),
                getAs(column),
              ]);

              selectors.push(selectQb);
              groupBySelectors.push(getAs(column));
            }
            break;
          case UITypes.CreatedTime:
          case UITypes.LastModifiedTime:
          case UITypes.DateTime:
            {
              const columnName = await getColumnName(
                baseModel.context,
                column,
                columns,
              );
              // ignore seconds part in datetime and group
              if (baseModel.dbDriver.clientType() === 'pg') {
                selectors.push(
                  baseModel.dbDriver.raw(
                    "date_trunc('minute', ??) + interval '0 seconds' as ??",
                    [columnName, getAs(column)],
                  ),
                );
              } else if (
                baseModel.dbDriver.clientType() === 'mysql' ||
                baseModel.dbDriver.clientType() === 'mysql2'
              ) {
                selectors.push(
                  baseModel.dbDriver.raw(
                    "CONVERT_TZ(DATE_SUB(??, INTERVAL SECOND(??) SECOND), @@GLOBAL.time_zone, '+00:00') as ??",
                    [columnName, columnName, getAs(column)],
                  ),
                );
              } else if (baseModel.dbDriver.clientType() === 'sqlite3') {
                selectors.push(
                  baseModel.dbDriver.raw(
                    `strftime ('%Y-%m-%d %H:%M:00',:column:) ||
  (
  CASE WHEN substr(:column:, 20, 1) = '+' THEN
    printf ('+%s:',
    substr(:column:, 21, 2)) || printf ('%s',
    substr(:column:, 24, 2))
  WHEN substr(:column:, 20, 1) = '-' THEN
    printf ('-%s:',
    substr(:column:, 21, 2)) || printf ('%s',
    substr(:column:, 24, 2))
  ELSE
    '+00:00'
  END) as :id:`,
                    {
                      column: columnName,
                      id: getAs(column),
                    },
                  ),
                );
              } else if (baseModel.isMssql) {
                // SQL Server 2022+ has native DATETRUNC; older versions
                // round-trip through CONVERT to truncate to the minute.
                const dbVersion = (await baseModel.getSource())?.meta
                  ?.dbVersion;
                const major =
                  parseInt(`${dbVersion ?? ''}`.split('.')[0], 10) || 0;
                const truncSql =
                  major >= 16
                    ? `DATETRUNC(MINUTE, ??) as ??`
                    : `CONVERT(DATETIME, CONVERT(VARCHAR(16), ??, 120)) as ??`;
                selectors.push(
                  baseModel.dbDriver.raw(truncSql, [columnName, getAs(column)]),
                );
              } else {
                selectors.push(
                  baseModel.dbDriver.raw('DATE(??) as ??', [
                    columnName,
                    getAs(column),
                  ]),
                );
              }
              groupBySelectors.push(getAs(column));
            }
            break;
          case UITypes.JSON: {
            if (baseModel.dbDriver.clientType() === 'pg') {
              const columnName = await getColumnName(
                baseModel.context,
                column,
                columns,
              );
              selectors.push(
                baseModel.dbDriver.raw('(??)::jsonb as ??', [
                  columnName,
                  getAs(column),
                ]),
              );
              groupBySelectors.push(getAs(column));
            }
            break;
          }
          case UITypes.UUID: {
            // PR review fix #2: use shared helper to cast UUID to text on PG
            const columnName = await getColumnName(
              baseModel.context,
              column,
              columns,
            );
            selectors.push(
              buildUuidGroupBySelector({
                baseModel,
                columnName,
                alias: getAs(column),
              }),
            );
            groupBySelectors.push(getAs(column));
            break;
          }
          default:
            {
              const columnName = await getColumnName(
                baseModel.context,
                column,
                columns,
              );
              selectors.push(
                baseModel.dbDriver.raw('?? as ??', [
                  sqlNullIfBlank({ columnName, baseModel }),
                  getAs(column),
                ]),
              );
              groupBySelectors.push(getAs(column));
            }
            break;
        }
      }),
    );

    // Build the group-by query
    const qb = baseModel.dbDriver(baseModel.tnPath);
    // mssql counts via nested derived tables — the inner projection here
    // does NOT add a COUNT aggregate (would conflict with the outer grouping).
    if (!baseModel.isMssql) {
      qb.count(`${baseModel.model.primaryKey?.column_name || '*'} as count`);
    }
    qb.select(...selectors);

    const aliasColObjMap = await baseModel.model.getAliasColObjMap(
      baseModel.context,
      columns,
    );

    const { filters: filterObj } = extractFilterFromXwhere(
      baseModel.context,
      where,
      aliasColObjMap,
    );
    await conditionV2(
      baseModel,
      [
        ...(baseModel.viewId
          ? [
              new Filter({
                children:
                  (await Filter.rootFilterList(baseModel.context, {
                    viewId: baseModel.viewId,
                  })) || [],
                is_group: true,
              }),
            ]
          : []),
        new Filter({
          children: args.filterArr || [],
          is_group: true,
          logical_op: 'and',
        }),
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
    );

    // Exclude soft-deleted records
    const softDeleteFilterCount = await baseModel.getSoftDeleteFilter();
    if (softDeleteFilterCount) {
      qb.where(softDeleteFilterCount);
    }

    // mssql can't GROUP BY select aliases — push grouping to the outer
    // derived table below. For other engines, GROUP BY + HAVING on `qb`.
    if (!baseModel.isMssql) {
      qb.groupBy(...groupBySelectors);

      // Add HAVING clause to filter groups by minimum count (e.g., count > 1 for duplicates only)
      if (args.minCount !== undefined && args.minCount > 0) {
        qb.havingRaw('COUNT(??) >= ?', [
          baseModel.model.primaryKey?.column_name || '*',
          args.minCount,
        ]);
      }
    }

    let qbP: Knex.QueryBuilder;
    if (baseModel.isMssql) {
      // mssql: nested derived tables —
      //   SELECT count(*) FROM (
      //     SELECT <aliases> FROM (qb) sub GROUP BY <aliases>
      //   ) grouped
      const aliasRefs = groupBySelectors.map(() => '??');
      const aliasBindings = groupBySelectors;

      const inner = baseModel.dbDriver
        .select(
          groupBySelectors.length
            ? baseModel.dbDriver.raw(aliasRefs.join(', '), aliasBindings)
            : baseModel.dbDriver.raw('1'),
        )
        .from(baseModel.dbDriver.raw('(??) as ??', [qb, 'sub']));

      if (groupBySelectors.length) {
        inner.groupByRaw(aliasRefs.join(', '), aliasBindings);
      }

      qbP = baseModel.dbDriver
        .count('*', { as: 'count' })
        .from(baseModel.dbDriver.raw('(??) as ??', [inner, 'grouped']));
    } else {
      // Wrap in a CTE so that we can reference grouped columns safely in all engines
      // SELECT COUNT(*) FROM (WITH grouped AS (<qb>) SELECT * FROM grouped g) sub
      const groupedCte = baseModel.dbDriver
        .with('grouped', qb.clone())
        .select('*')
        .from({ g: 'grouped' });
      qbP = baseModel.dbDriver
        .count('*', { as: 'count' })
        .from(groupedCte.as('sub'));
    }

    return (await baseModel.execAndParse(qbP, null, { raw: true, first: true }))
      ?.count;
  };

  return {
    count,
    list,
  };
};
