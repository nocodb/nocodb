import { extractFilterFromXwhere, UITypes } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { BarcodeColumn, QrCodeColumn, RollupColumn, View } from '~/models';
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
  }) => {
    const { where, ...rest } = baseModel._getListArgs(args as any);

    args.column_name = args.column_name || '';
    const subGroupColumnName = args.subGroupColumnName;

    const columns = await baseModel.model.getColumns(baseModel.context);
    const groupByColumns: Record<string, Column> = {};

    const selectors = [];
    const groupBySelectors = [];
    const getAlias = getAliasGenerator('__nc_gb');
    const subGroupColumn = columns.find(
      (c) =>
        c.title === subGroupColumnName || c.column_name === subGroupColumnName,
    );

    const processColumn = async (col: string, isSubGroup: boolean = false) => {
      let column = columns.find(
        (c) => c.column_name === col || c.title === col,
      );
      if (!column) {
        throw NcError.fieldNotFound(col);
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
          NcError.badRequest(
            'Group by using attachment column is not supported',
          );
          break;
        case UITypes.Button:
          NcError.badRequest('Group by using Button column is not supported');
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
        default: {
          const defaultColumnName = await getColumnName(
            baseModel.context,
            column,
            columns,
          );
          columnQuery = baseModel.dbDriver.raw('??', [defaultColumnName]);
          if (!isSubGroup) {
            selectors.push(
              baseModel.dbDriver.raw(`?? as ??`, [defaultColumnName, alias]),
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
    qb.count(`${baseModel.model.primaryKey?.column_name || '*'} as count`);

    if (subGroupColumnName) {
      const subGroupQuery = await processColumn(subGroupColumnName, true);
      qb.select(
        baseModel.dbDriver.raw(
          `COUNT(DISTINCT COALESCE(${
            baseModel.isPg ? '(??)::text' : '??'
          }, '__null__')) as ??`,
          [baseModel.dbDriver.raw(subGroupQuery), '__sub_group_count__'],
        ),
      );
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

    if (!sorts) {
      if (args.sortArr?.length) {
        sorts = args.sortArr;
      } else if (baseModel.viewId) {
        sorts = await Sort.list(baseModel.context, {
          viewId: baseModel.viewId,
        });
      }
    }

    // if sort is provided filter out the group by columns sort and apply
    // since we are grouping by the column and applying sort on any other column is not required
    for (const sort of sorts || []) {
      if (!groupByColumns[sort.fk_column_id]) {
        continue;
      }

      const column = groupByColumns[sort.fk_column_id];
      const columnName = await getColumnName(
        baseModel.context,
        column,
        columns,
      );

      if (
        [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
          column.uidt as UITypes,
        )
      ) {
        const baseUsers = await BaseUser.getUsersList(baseModel.context, {
          base_id: column.base_id,
        });

        // create union replace statement for each user
        const mapUnion = baseUsers
          .map((user) => {
            return baseModel.dbDriver
              .raw(`select ? as nc_u_id, ? as nc_u_name`, [
                user.id,
                user.display_name || user.email,
              ])
              .toQuery();
          })
          .join(' UNION ALL ');
        const finalStatement = `(select nc_u_name from (${mapUnion}) where nc_u_id = ${baseModel.dbDriver
          .raw('??', [columnName])
          .toQuery()})`;

        if (!['asc', 'desc'].includes(sort.direction)) {
          qb.orderBy(
            'count',
            sort.direction === 'count-desc' ? 'desc' : 'asc',
            sort.direction === 'count-desc' ? 'LAST' : 'FIRST',
          );
          qb.orderBy(
            sanitize(baseModel.dbDriver.raw(finalStatement)),
            sort.direction,
            sort.direction === 'desc' ? 'LAST' : 'FIRST',
          );
        } else {
          qb.orderBy(
            sanitize(baseModel.dbDriver.raw(finalStatement)),
            sort.direction,
            sort.direction === 'desc' ? 'LAST' : 'FIRST',
          );
        }
      } else {
        if (!['asc', 'desc'].includes(sort.direction)) {
          qb.orderBy(
            'count',
            sort.direction === 'count-desc' ? 'desc' : 'asc',
            sort.direction === 'count-desc' ? 'LAST' : 'FIRST',
          );
          qb.orderBy(
            getAs(column),
            sort.direction,
            sort.direction === 'desc' ? 'LAST' : 'FIRST',
          );
        } else {
          qb.orderBy(
            getAs(column),
            sort.direction,
            sort.direction === 'desc' ? 'LAST' : 'FIRST',
          );
        }
      }
    }

    // group by using the column aliases
    qb.groupBy(...groupBySelectors);
    applyPaginate(qb, rest);

    return await baseModel.execAndParse(qb);
  };

  const count = async (args: {
    where?: string;
    column_name: string;
    limit?;
    offset?;
    filterArr?: Filter[];
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
          throw NcError.fieldNotFound(col);
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
            NcError.badRequest(
              'Group by using attachment column is not supported',
            );
            break;
          case UITypes.Button: {
            NcError.badRequest('Group by using Button column is not supported');
            break;
          }
          case UITypes.Rollup:
          case UITypes.Links:
            selectors.push(
              (
                await genRollupSelectv2({
                  baseModelSqlv2: baseModel,
                  // tn: baseModel.title,
                  knex: baseModel.dbDriver,
                  // column,
                  // alias,
                  columnOptions: (await column.getColOptions(
                    baseModel.context,
                  )) as RollupColumn,
                })
              ).builder.as(getAs(column)),
            );
            groupBySelectors.push(getAs(column));
            break;
          case UITypes.Formula: {
            let selectQb;
            try {
              const _selectQb = await baseModel.getSelectQueryBuilderForFormula(
                column,
              );

              selectQb = baseModel.dbDriver.raw(`?? as ??`, [
                _selectQb.builder,
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
          default:
            {
              const columnName = await getColumnName(
                baseModel.context,
                column,
                columns,
              );
              selectors.push(
                baseModel.dbDriver.raw('?? as ??', [columnName, getAs(column)]),
              );
              groupBySelectors.push(getAs(column));
            }
            break;
        }
      }),
    );

    const qb = baseModel.dbDriver(baseModel.tnPath);
    qb.count(`${baseModel.model.primaryKey?.column_name || '*'} as count`);
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

    qb.groupBy(...groupBySelectors);

    const qbP = baseModel.dbDriver
      .count('*', { as: 'count' })
      .from(qb.as('groupby'));

    return (await baseModel.execAndParse(qbP, null, { raw: true, first: true }))
      ?.count;
  };

  const bulkCount = async (
    args: {
      filterArr?: Filter[];
    },
    bulkFilterList: {
      alias: string;
      where?: string;
      sort: string;
      column_name: string;
      filterArr?: Filter[];
    }[],
    _view: View,
  ) => {
    try {
      const columns = await baseModel.model.getColumns(baseModel.context);
      const aliasColObjMap = await baseModel.model.getAliasColObjMap(
        baseModel.context,
        columns,
      );
      const selectors = [] as Array<Knex.Raw>;

      const viewFilterList = await Filter.rootFilterList(baseModel.context, {
        viewId: baseModel.viewId,
      });

      if (!bulkFilterList?.length) {
        return NcError.badRequest('bulkFilterList is required');
      }

      for (const f of bulkFilterList) {
        const { where, ...rest } = baseModel._getListArgs(f);
        const groupBySelectors = [];
        const groupByColumns: Record<string, Column> = {};

        const getAlias = getAliasGenerator('__nc_gb');
        const { filters: groupFilter } = extractFilterFromXwhere(
          baseModel.context,
          f.where,
          aliasColObjMap,
        );

        const tQb = baseModel.dbDriver(baseModel.tnPath);
        const colSelectors = [];

        await Promise.all(
          rest.column_name.split(',').map(async (col) => {
            let column = columns.find(
              (c) => c.column_name === col || c.title === col,
            );

            // if qrCode or Barcode replace it with value column nd keep the alias
            if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt)) {
              column = new Column({
                ...(await column
                  .getColOptions<BarcodeColumn | QrCodeColumn>(
                    baseModel.context,
                  )
                  .then((col) => col.getValueColumn(baseModel.context))),
                asId: column.id,
              });
            }

            groupByColumns[getAs(column)] = column;

            switch (column.uidt) {
              case UITypes.Attachment:
                NcError.badRequest(
                  'Group by using attachment column is not supported',
                );
                break;
              case UITypes.Button: {
                NcError.badRequest(
                  'Group by using Button column is not supported',
                );
                break;
              }
              case UITypes.Links:
              case UITypes.Rollup:
                colSelectors.push(
                  (
                    await genRollupSelectv2({
                      baseModelSqlv2: baseModel,
                      knex: baseModel.dbDriver,
                      columnOptions: (await column.getColOptions(
                        baseModel.context,
                      )) as RollupColumn,
                    })
                  ).builder.as(getAs(column)),
                );
                groupBySelectors.push(getAs(column));
                break;
              case UITypes.Formula: {
                let selectQb;
                try {
                  const _selectQb =
                    await baseModel.getSelectQueryBuilderForFormula(column);
                  selectQb = baseModel.dbDriver.raw(`?? as ??`, [
                    _selectQb.builder,
                    getAs(column),
                  ]);
                } catch (e) {
                  console.log(e);
                  selectQb = baseModel.dbDriver.raw(`'ERR' as ??`, [
                    getAs(column),
                  ]);
                }
                colSelectors.push(selectQb);
                groupBySelectors.push(getAs(column));
                break;
              }

              case UITypes.Lookup:
              case UITypes.LinkToAnotherRecord: {
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
                colSelectors.push(selectQb);
                groupBySelectors.push(getAs(column));
                break;
              }
              case UITypes.DateTime:
              case UITypes.CreatedTime:
              case UITypes.LastModifiedTime:
                {
                  const columnName = await getColumnName(
                    baseModel.context,
                    column,
                    columns,
                  );
                  // ignore seconds part in datetime and group
                  if (baseModel.dbDriver.clientType() === 'pg') {
                    colSelectors.push(
                      baseModel.dbDriver.raw(
                        "date_trunc('minute', ??) + interval '0 seconds' as ??",
                        [columnName, getAs(column)],
                      ),
                    );
                  } else if (
                    baseModel.dbDriver.clientType() === 'mysql' ||
                    baseModel.dbDriver.clientType() === 'mysql2'
                  ) {
                    colSelectors.push(
                      // baseModel.dbDriver.raw('??::date as ??', [columnName, getAs(column)]),
                      baseModel.dbDriver.raw(
                        "DATE_SUB(CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00'), INTERVAL SECOND(??) SECOND) as ??",
                        [columnName, columnName, getAs(column)],
                      ),
                    );
                  } else if (baseModel.dbDriver.clientType() === 'sqlite3') {
                    colSelectors.push(
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
   END) AS :id:`,
                        {
                          column: columnName,
                          id: getAs(column),
                        },
                      ),
                    );
                  } else {
                    colSelectors.push(
                      baseModel.dbDriver.raw('DATE(??) as ??', [
                        columnName,
                        getAs(column),
                      ]),
                    );
                  }
                  groupBySelectors.push(getAs(column));
                }
                break;
              default: {
                const columnName = await getColumnName(
                  baseModel.context,
                  column,
                  columns,
                );
                colSelectors.push(
                  baseModel.dbDriver.raw('?? as ??', [
                    columnName,
                    getAs(column),
                  ]),
                );
                groupBySelectors.push(getAs(column));
                break;
              }
            }
          }),
        );

        // get aggregated count of each group
        tQb.count(`${baseModel.model.primaryKey?.column_name || '*'} as count`);
        tQb.select(...colSelectors);

        if (+rest?.shuffle) {
          await baseModel.shuffle({ qb: tQb });
        }

        await conditionV2(
          baseModel,
          [
            ...(baseModel.viewId
              ? [
                  new Filter({
                    children: viewFilterList || [],
                    is_group: true,
                  }),
                ]
              : []),
            new Filter({
              children: rest.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: extractFilterFromXwhere(
                baseModel.context,
                where,
                aliasColObjMap,
              ).filters,
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: groupFilter,
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
          ],
          tQb,
        );

        tQb.groupBy(...groupBySelectors);

        const count = baseModel.dbDriver
          .count('*', { as: 'count' })
          .from(tQb.as('groupby'));

        let subQuery;
        switch (baseModel.dbDriver.client.config.client) {
          case 'pg':
            subQuery = baseModel.dbDriver
              .select(
                baseModel.dbDriver.raw(
                  `json_build_object('count', "count") as ??`,
                  [getAlias()],
                ),
              )
              .from(count.as(getAlias()));
            selectors.push(
              baseModel.dbDriver.raw(`(??) as ??`, [subQuery, `${f.alias}`]),
            );
            break;
          case 'mysql2':
            subQuery = baseModel.dbDriver
              .select(baseModel.dbDriver.raw(`JSON_OBJECT('count', \`count\`)`))
              .from(count.as(getAlias()));
            selectors.push(
              baseModel.dbDriver.raw(`(??) as ??`, [subQuery, `${f.alias}`]),
            );
            break;
          case 'sqlite3':
            subQuery = baseModel.dbDriver
              .select(
                baseModel.dbDriver.raw(`json_object('count', "count") as ??`, [
                  f.alias,
                ]),
              )
              .from(count.as(getAlias()));
            selectors.push(
              baseModel.dbDriver.raw(`(??) as ??`, [subQuery, `${f.alias}`]),
            );
            break;
          default:
            NcError.notImplemented(
              'This database does not support bulk groupBy count',
            );
        }
      }

      const qb = baseModel.dbDriver(baseModel.tnPath);
      qb.select(...selectors).limit(1);

      return await baseModel.execAndParse(qb, null, {
        raw: true,
        first: true,
      });
    } catch (e) {
      console.log(e);
    }
  };

  const bulkList = async (
    args: {
      filterArr?: Filter[];
    },
    bulkFilterList: {
      alias: string;
      where?: string;
      column_name: string;
      limit?;
      offset?;
      sort?: string;
      filterArr?: Filter[];
      sortArr?: Sort[];
    }[],
    _view: View,
  ) => {
    const columns = await baseModel.model.getColumns(baseModel.context);
    const aliasColObjMap = await baseModel.model.getAliasColObjMap(
      baseModel.context,
      columns,
    );
    const selectors = [] as Array<Knex.Raw>;

    const viewFilterList = await Filter.rootFilterList(baseModel.context, {
      viewId: baseModel.viewId,
    });

    try {
      if (!bulkFilterList?.length) {
        return NcError.badRequest('bulkFilterList is required');
      }

      for (const f of bulkFilterList) {
        const { where, ...rest } = baseModel._getListArgs(f);
        const groupBySelectors = [];
        const groupByColumns: Record<string, Column> = {};

        const getAlias = getAliasGenerator('__nc_gb');
        const { filters: groupFilter } = extractFilterFromXwhere(
          baseModel.context,
          f?.where,
          aliasColObjMap,
        );
        let groupSort = extractSortsObject(
          baseModel.context,
          rest?.sort,
          aliasColObjMap,
        );

        const tQb = baseModel.dbDriver(baseModel.tnPath);
        const colSelectors = [];
        const colIds = rest.column_name
          .split(',')
          .map((col) => {
            const column = columns.find(
              (c) => c.column_name === col || c.title === col,
            );
            if (!column) {
              throw NcError.fieldNotFound(col);
            }
            return column?.id;
          })
          .join('_');

        await Promise.all(
          rest.column_name.split(',').map(async (col) => {
            let column = columns.find(
              (c) => c.column_name === col || c.title === col,
            );

            // if qrCode or Barcode replace it with value column nd keep the alias
            if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt)) {
              column = new Column({
                ...(await column
                  .getColOptions<BarcodeColumn | QrCodeColumn>(
                    baseModel.context,
                  )
                  .then((col) => col.getValueColumn(baseModel.context))),
                asId: column.id,
              });
            }

            groupByColumns[getAs(column)] = column;

            switch (column.uidt) {
              case UITypes.Attachment:
                NcError.badRequest(
                  'Group by using attachment column is not supported',
                );
                break;
              case UITypes.Button: {
                NcError.badRequest(
                  'Group by using Button column is not supported',
                );
                break;
              }
              case UITypes.Links:
              case UITypes.Rollup:
                colSelectors.push(
                  (
                    await genRollupSelectv2({
                      baseModelSqlv2: baseModel,
                      knex: baseModel.dbDriver,
                      columnOptions: (await column.getColOptions(
                        baseModel.context,
                      )) as RollupColumn,
                    })
                  ).builder.as(getAs(column)),
                );
                groupBySelectors.push(getAs(column));
                break;
              case UITypes.Formula: {
                let selectQb;
                try {
                  const _selectQb =
                    await baseModel.getSelectQueryBuilderForFormula(column);
                  selectQb = baseModel.dbDriver.raw(`?? as ??`, [
                    _selectQb.builder,
                    getAs(column),
                  ]);
                } catch (e) {
                  console.log(e);
                  selectQb = baseModel.dbDriver.raw(`'ERR' as ??`, [
                    getAs(column),
                  ]);
                }
                colSelectors.push(selectQb);
                groupBySelectors.push(getAs(column));
                break;
              }

              case UITypes.Lookup:
              case UITypes.LinkToAnotherRecord: {
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
                colSelectors.push(selectQb);
                groupBySelectors.push(getAs(column));
                break;
              }
              case UITypes.DateTime:
              case UITypes.CreatedTime:
              case UITypes.LastModifiedTime:
                {
                  const columnName = await getColumnName(
                    baseModel.context,
                    column,
                    columns,
                  );
                  // ignore seconds part in datetime and group
                  if (baseModel.dbDriver.clientType() === 'pg') {
                    colSelectors.push(
                      baseModel.dbDriver.raw(
                        "date_trunc('minute', ??) + interval '0 seconds' as ??",
                        [columnName, getAs(column)],
                      ),
                    );
                  } else if (
                    baseModel.dbDriver.clientType() === 'mysql' ||
                    baseModel.dbDriver.clientType() === 'mysql2'
                  ) {
                    colSelectors.push(
                      // baseModel.dbDriver.raw('??::date as ??', [columnName, getAs(column)]),
                      baseModel.dbDriver.raw(
                        "DATE_SUB(CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00'), INTERVAL SECOND(??) SECOND) as ??",
                        [columnName, columnName, getAs(column)],
                      ),
                    );
                  } else if (baseModel.dbDriver.clientType() === 'sqlite3') {
                    colSelectors.push(
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
   END) AS :id:`,
                        {
                          column: columnName,
                          id: getAs(column),
                        },
                      ),
                    );
                  } else {
                    colSelectors.push(
                      baseModel.dbDriver.raw('DATE(??) as ??', [
                        columnName,
                        getAs(column),
                      ]),
                    );
                  }
                  groupBySelectors.push(getAs(column));
                }
                break;
              default: {
                const columnName = await getColumnName(
                  baseModel.context,
                  column,
                  columns,
                );
                colSelectors.push(
                  baseModel.dbDriver.raw('?? as ??', [
                    columnName,
                    getAs(column),
                  ]),
                );
                groupBySelectors.push(getAs(column));
                break;
              }
            }
          }),
        );

        // get aggregated count of each group
        tQb.count(`${baseModel.model.primaryKey?.column_name || '*'} as count`);
        tQb.select(...colSelectors);

        if (+rest?.shuffle) {
          await baseModel.shuffle({ qb: tQb });
        }

        await conditionV2(
          baseModel,
          [
            ...(baseModel.viewId
              ? [
                  new Filter({
                    children: viewFilterList || [],
                    is_group: true,
                  }),
                ]
              : []),
            new Filter({
              children: rest.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: extractFilterFromXwhere(
                baseModel.context,
                where,
                aliasColObjMap,
              ).filters,
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: groupFilter,
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
          ],
          tQb,
        );

        if (!groupSort) {
          if (rest.sortArr?.length) {
            groupSort = rest.sortArr;
          } else if (baseModel.viewId) {
            groupSort = await Sort.list(baseModel.context, {
              viewId: baseModel.viewId,
            });
          }
        }

        for (const sort of groupSort || []) {
          if (!groupByColumns[sort.fk_column_id]) {
            continue;
          }

          const column = groupByColumns[sort.fk_column_id];

          if (
            [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
              column.uidt as UITypes,
            )
          ) {
            const columnName = await getColumnName(
              baseModel.context,
              column,
              columns,
            );
            const baseUsers = await BaseUser.getUsersList(baseModel.context, {
              base_id: column.base_id,
            });

            // create nested replace statement for each user
            const finalStatement = baseUsers.reduce((acc, user) => {
              const qb = baseModel.dbDriver.raw(`REPLACE(${acc}, ?, ?)`, [
                user.id,
                user.display_name || user.email,
              ]);
              return qb.toQuery();
            }, baseModel.dbDriver.raw(`??`, [columnName]).toQuery());

            if (!['asc', 'desc'].includes(sort.direction)) {
              tQb.orderBy(
                'count',
                sort.direction === 'count-desc' ? 'desc' : 'asc',
                sort.direction === 'count-desc' ? 'LAST' : 'FIRST',
              );
            } else {
              tQb.orderBy(
                sanitize(baseModel.dbDriver.raw(finalStatement)),
                sort.direction,
                sort.direction === 'desc' ? 'LAST' : 'FIRST',
              );
            }
          } else {
            if (!['asc', 'desc'].includes(sort.direction)) {
              tQb.orderBy(
                'count',
                sort.direction === 'count-desc' ? 'desc' : 'asc',
                sort.direction === 'count-desc' ? 'LAST' : 'FIRST',
              );
            } else {
              tQb.orderBy(
                getAs(column),
                sort.direction,
                sort.direction === 'desc' ? 'LAST' : 'FIRST',
              );
            }
          }
          tQb.groupBy(...groupBySelectors);
          applyPaginate(tQb, rest);
        }

        let subQuery;
        switch (baseModel.dbDriver.client.config.client) {
          case 'pg':
            subQuery = baseModel.dbDriver
              .select(
                baseModel.dbDriver.raw(
                  `json_agg(json_build_object('count', "count", '${rest.column_name}', "${colIds}")) as ??`,
                  [getAlias()],
                ),
              )
              .from(tQb.as(getAlias()));
            selectors.push(
              baseModel.dbDriver.raw(`(??) as ??`, [subQuery, `${f.alias}`]),
            );
            break;
          case 'mysql2':
            subQuery = baseModel.dbDriver
              .select(
                baseModel.dbDriver.raw(
                  `JSON_ARRAYAGG(JSON_OBJECT('count', \`count\`, '${rest.column_name}', \`${colIds}\`))`,
                ),
              )
              .from(baseModel.dbDriver.raw(`(??) as ??`, [tQb, getAlias()]));
            selectors.push(
              baseModel.dbDriver.raw(`(??) as ??`, [subQuery, f.alias]),
            );
            break;
          case 'sqlite3':
            subQuery = baseModel.dbDriver
              .select(
                baseModel.dbDriver.raw(
                  `json_group_array(json_object('count', "count", '${rest.column_name}', "${colIds}")) as ??`,
                  [f.alias],
                ),
              )
              .from(tQb.as(getAlias()));
            selectors.push(
              baseModel.dbDriver.raw(`(??) as ??`, [subQuery, f.alias]),
            );
            break;
          default:
            NcError.notImplemented(
              'This database does not support bulk groupBy',
            );
        }
      }

      const qb = baseModel.dbDriver(baseModel.tnPath);
      qb.select(...selectors).limit(1);

      return await baseModel.execAndParse(qb, null, {
        raw: true,
        first: true,
      });
    } catch (err) {
      logger.log(err);
      return [];
    }
  };

  return {
    count,
    list,
    bulkCount,
    bulkList,
  };
};
