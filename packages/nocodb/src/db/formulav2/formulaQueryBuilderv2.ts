import jsep from 'jsep';
import {
  ComparisonOperators,
  FormulaDataTypes,
  jsepCurlyHook,
  JSEPNode,
  LongTextAiMetaProp,
  RelationTypes,
  UITypes,
  validateDateWithUnknownFormat,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import mapFunctionName from '../mapFunctionName';
import genRollupSelectv2 from '../genRollupSelectv2';
import type {
  CallExpressionNode,
  ComparisonOperator,
  IdentifierNode,
  LiteralNode,
  ParsedFormulaNode,
} from 'nocodb-sdk';
import type {
  FnParsedTreeNode,
  FormulaQueryBuilderBaseParams,
} from './formula-query-builder.types';
import type RollupColumn from '~/models/RollupColumn';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import type LookupColumn from '~/models/LookupColumn';
import type Column from '~/models/Column';
import type { User } from '~/models';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type CustomKnex from '~/db/CustomKnex';
import Model from '~/models/Model';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import { convertDateFormatForConcat } from '~/helpers/formulaFnHelper';
import FormulaColumn from '~/models/FormulaColumn';
import { BaseUser, ButtonColumn } from '~/models';
import { getRefColumnIfAlias } from '~/helpers';
import { ExternalTimeout, NcError } from '~/helpers/catchError';

const logger = new Logger('FormulaQueryBuilderv2');

export const getAggregateFn: (
  fnName: string,
) => (args: { qb; knex?: CustomKnex; cn }) => any = (parentFn) => {
  switch (parentFn?.toUpperCase()) {
    case 'MIN':
      return ({ qb, cn }) => qb.clear('select').min(cn);
    case 'MAX':
      return ({ qb, cn }) => qb.clear('select').max(cn);
    case 'ADD':
    case 'SUM':
    case 'FLOAT':
    case 'NUMBER':
    case 'ARITH':
      return ({ qb, cn }) => qb.clear('select').sum(cn);

    case 'AVG':
      return ({ qb, cn }) => qb.clear('select').sum(cn);

    // todo:
    //   return ({ qb, cn, knex, argsCount }) =>
    //     qb
    //       .clear('select')
    //       .select(
    //         knex.raw('sum(??)/(count(??)) + ?)', [cn, cn, (argsCount || 1) - 1])
    //       );
    case 'CONCAT':
    default:
      return ({ qb, cn }) => qb.clear('select').concat(cn);
    // return '';
  }
};

async function _formulaQueryBuilder(params: FormulaQueryBuilderBaseParams) {
  const getLinkedColumnDisplayValue = async (params: {
    model: Model;
    aliasToColumn?: Record<string, () => Promise<{ builder: any }>>;
  }) => {
    const displayValueColumn = params.model?.displayValue;
    if (!displayValueColumn) {
      return undefined;
    }
    const formulOption = await params.model.displayValue.getColOptions<
      FormulaColumn | ButtonColumn
    >(baseModelSqlv2.context);
    if (displayValueColumn.uidt !== UITypes.Formula) {
      return displayValueColumn.column_name;
    } else {
      const innerQb = await _formulaQueryBuilder({
        baseModelSqlv2: await Model.getBaseModelSQL(baseModelSqlv2.context, {
          model: params.model,
          dbDriver: baseModelSqlv2.dbDriver,
        }),
        _tree: formulOption.formula,
        alias,
        model: params.model,
        column: params.model.displayValue,
        aliasToColumn: params.aliasToColumn,
        tableAlias,
        parsedTree: formulOption.getParsedTree(),
        baseUsers,
      });
      return innerQb;
    }
  };

  const {
    baseModelSqlv2,
    _tree,
    alias,
    model,
    aliasToColumn = {},
    tableAlias,
    parsedTree,
    column = null,
  } = params;

  let { baseUsers = null } = params;

  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

  const columns = await model.getColumns(context);

  let tree = parsedTree;
  if (!tree) {
    // formula may include double curly brackets in previous version
    // convert to single curly bracket here for compatibility
    // const _tree1 = jsep(_tree.replaceAll('{{', '{').replaceAll('}}', '}'));
    tree = await validateFormulaAndExtractTreeWithType({
      formula: _tree.replaceAll('{{', '{').replaceAll('}}', '}'),
      columns,
      column,
      clientOrSqlUi: baseModelSqlv2.clientType as
        | 'mysql'
        | 'pg'
        | 'sqlite3'
        | 'mssql'
        | 'mysql2'
        | 'oracledb'
        | 'mariadb'
        | 'sqlite'
        | 'snowflake',
      getMeta: async (modelId) => {
        const model = await Model.get(context, modelId);
        await model.getColumns(context);
        return model;
      },
    });

    // populate and save parsedTree to column if not exist
    if (column) {
      if (column.uidt === UITypes.Formula) {
        FormulaColumn.update(context, column.id, { parsed_tree: tree }).then(
          () => {
            // ignore
          },
          (err) => {
            logger.error(err);
          },
        );
      } else {
        ButtonColumn.update(context, column.id, { parsed_tree: tree }).then(
          () => {
            // ignore
          },
          (err) => {
            logger.error(err);
          },
        );
      }
    }
  }

  const columnIdToUidt: Record<string, UITypes> = {};

  // todo: improve - implement a common solution for filter, sort, formula, etc
  for (const col of columns) {
    columnIdToUidt[col.id] = col.uidt;
    if (col.id in aliasToColumn) continue;
    switch (col.uidt) {
      case UITypes.Formula:
      case UITypes.Button:
        {
          aliasToColumn[col.id] = async () => {
            const formulOption = await col.getColOptions<
              FormulaColumn | ButtonColumn
            >(context);
            const { builder } = await _formulaQueryBuilder({
              baseModelSqlv2,
              _tree: formulOption.formula,
              alias,
              model,
              aliasToColumn: { ...aliasToColumn, [col.id]: null },
              tableAlias,
              parsedTree: formulOption.getParsedTree(),
              baseUsers,
            });
            builder.sql = '(' + builder.sql + ')';
            return {
              builder,
            };
          };
        }
        break;
      case UITypes.Lookup:
        aliasToColumn[col.id] = async (): Promise<any> => {
          let aliasCount = 0;
          let selectQb;
          let isArray = false;
          const alias = `__nc_formula${aliasCount++}`;
          const lookup = await col.getColOptions<LookupColumn>(context);
          {
            const relationCol = await lookup.getRelationColumn(context);
            const relation =
              await relationCol.getColOptions<LinkToAnotherRecordColumn>(
                context,
              );
            // if (relation.type !== RelationTypes.BELONGS_TO) continue;

            const childColumn = await relation.getChildColumn(context);
            const parentColumn = await relation.getParentColumn(context);
            const childModel = await childColumn.getModel(context);
            await childModel.getColumns(context);
            const parentModel = await parentColumn.getModel(context);
            await parentModel.getColumns(context);

            let relationType = relation.type;

            if (relationType === RelationTypes.ONE_TO_ONE) {
              relationType = relationCol.meta?.bt
                ? RelationTypes.BELONGS_TO
                : RelationTypes.HAS_MANY;
            }

            switch (relationType) {
              case RelationTypes.BELONGS_TO:
                selectQb = knex(
                  knex.raw(`?? as ??`, [
                    baseModelSqlv2.getTnPath(parentModel.table_name),
                    alias,
                  ]),
                ).where(
                  `${alias}.${parentColumn.column_name}`,
                  knex.raw(`??`, [
                    `${
                      tableAlias ??
                      baseModelSqlv2.getTnPath(childModel.table_name)
                    }.${childColumn.column_name}`,
                  ]),
                );
                break;
              case RelationTypes.HAS_MANY:
                isArray = relation.type !== RelationTypes.ONE_TO_ONE;
                selectQb = knex(
                  knex.raw(`?? as ??`, [
                    baseModelSqlv2.getTnPath(childModel.table_name),
                    alias,
                  ]),
                ).where(
                  `${alias}.${childColumn.column_name}`,
                  knex.raw(`??`, [
                    `${
                      tableAlias ??
                      baseModelSqlv2.getTnPath(parentModel.table_name)
                    }.${parentColumn.column_name}`,
                  ]),
                );
                break;
              case RelationTypes.MANY_TO_MANY:
                {
                  isArray = true;
                  const mmModel = await relation.getMMModel(context);
                  const mmParentColumn = await relation.getMMParentColumn(
                    context,
                  );
                  const mmChildColumn = await relation.getMMChildColumn(
                    context,
                  );

                  const assocAlias = `__nc${aliasCount++}`;
                  selectQb = knex(
                    knex.raw(`?? as ??`, [
                      baseModelSqlv2.getTnPath(parentModel.table_name),
                      alias,
                    ]),
                  )
                    .join(
                      knex.raw(`?? as ??`, [
                        baseModelSqlv2.getTnPath(mmModel.table_name),
                        assocAlias,
                      ]),
                      `${assocAlias}.${mmParentColumn.column_name}`,
                      `${alias}.${parentColumn.column_name}`,
                    )
                    .where(
                      `${assocAlias}.${mmChildColumn.column_name}`,
                      knex.raw(`??`, [
                        `${
                          tableAlias ??
                          baseModelSqlv2.getTnPath(childModel.table_name)
                        }.${childColumn.column_name}`,
                      ]),
                    );
                }
                break;
            }

            let lookupColumn = await lookup.getLookupColumn(context);
            let prevAlias = alias;
            while (lookupColumn.uidt === UITypes.Lookup) {
              const nestedAlias = `__nc_formula${aliasCount++}`;
              const nestedLookup =
                await lookupColumn.getColOptions<LookupColumn>(context);
              const relationCol = await nestedLookup.getRelationColumn(context);
              const relation =
                await relationCol.getColOptions<LinkToAnotherRecordColumn>(
                  context,
                );
              // if any of the relation in nested lookup is
              // not belongs to then ignore the sort option
              // if (relation.type !== RelationTypes.BELONGS_TO) continue;

              const childColumn = await relation.getChildColumn(context);
              const parentColumn = await relation.getParentColumn(context);
              const childModel = await childColumn.getModel(context);
              await childModel.getColumns(context);
              const parentModel = await parentColumn.getModel(context);
              await parentModel.getColumns(context);

              let relationType = relation.type;

              if (relationType === RelationTypes.ONE_TO_ONE) {
                relationType = relationCol.meta?.bt
                  ? RelationTypes.BELONGS_TO
                  : RelationTypes.HAS_MANY;
              }

              switch (relationType) {
                case RelationTypes.BELONGS_TO:
                  {
                    selectQb.join(
                      knex.raw(`?? as ??`, [
                        baseModelSqlv2.getTnPath(parentModel.table_name),
                        nestedAlias,
                      ]),
                      `${prevAlias}.${childColumn.column_name}`,
                      `${nestedAlias}.${parentColumn.column_name}`,
                    );
                  }
                  break;
                case RelationTypes.HAS_MANY:
                  {
                    isArray = relation.type !== RelationTypes.ONE_TO_ONE;
                    selectQb.join(
                      knex.raw(`?? as ??`, [
                        baseModelSqlv2.getTnPath(childModel.table_name),
                        nestedAlias,
                      ]),
                      `${prevAlias}.${parentColumn.column_name}`,
                      `${nestedAlias}.${childColumn.column_name}`,
                    );
                  }
                  break;
                case RelationTypes.MANY_TO_MANY: {
                  isArray = true;
                  const mmModel = await relation.getMMModel(context);
                  const mmParentColumn = await relation.getMMParentColumn(
                    context,
                  );
                  const mmChildColumn = await relation.getMMChildColumn(
                    context,
                  );

                  const assocAlias = `__nc${aliasCount++}`;

                  selectQb
                    .join(
                      knex.raw(`?? as ??`, [
                        baseModelSqlv2.getTnPath(mmModel.table_name),
                        assocAlias,
                      ]),
                      `${assocAlias}.${mmChildColumn.column_name}`,
                      `${prevAlias}.${childColumn.column_name}`,
                    )
                    .join(
                      knex.raw(`?? as ??`, [
                        baseModelSqlv2.getTnPath(parentModel.table_name),
                        nestedAlias,
                      ]),
                      `${nestedAlias}.${parentColumn.column_name}`,
                      `${assocAlias}.${mmParentColumn.column_name}`,
                    );
                }
              }

              /*selectQb.join(
`${parentModel.title} as ${nestedAlias}`,
`${nestedAlias}.${parentColumn.title}`,
`${prevAlias}.${childColumn.title}`
);*/

              lookupColumn = await nestedLookup.getLookupColumn(context);
              prevAlias = nestedAlias;
            }

            switch (lookupColumn.uidt) {
              case UITypes.Links:
              case UITypes.Rollup:
                {
                  const builder = (
                    await genRollupSelectv2({
                      baseModelSqlv2,
                      knex,
                      alias: prevAlias,
                      columnOptions: (await lookupColumn.getColOptions(
                        context,
                      )) as RollupColumn,
                    })
                  ).builder;
                  // selectQb.select(builder);

                  if (isArray) {
                    const qb = selectQb;
                    selectQb = (fn) =>
                      knex
                        .raw(
                          getAggregateFn(fn)({
                            qb,
                            knex,
                            cn: knex.raw(builder).wrap('(', ')'),
                          }),
                        )
                        .wrap('(', ')');
                  } else {
                    selectQb.select(knex.raw(builder).wrap('(', ')'));
                  }
                }
                break;
              case UITypes.LinkToAnotherRecord:
                {
                  const nestedAlias = `__nc_formula${aliasCount++}`;
                  const relation =
                    await lookupColumn.getColOptions<LinkToAnotherRecordColumn>(
                      context,
                    );
                  // if (relation.type !== RelationTypes.BELONGS_TO) continue;

                  const colOptions = (await lookupColumn.getColOptions(
                    context,
                  )) as LinkToAnotherRecordColumn;
                  const childColumn = await colOptions.getChildColumn(context);
                  const parentColumn = await colOptions.getParentColumn(
                    context,
                  );
                  const childModel = await childColumn.getModel(context);
                  await childModel.getColumns(context);
                  const parentModel = await parentColumn.getModel(context);
                  await parentModel.getColumns(context);
                  let cn;

                  let relationType = relation.type;

                  if (relationType === RelationTypes.ONE_TO_ONE) {
                    relationType = relationCol.meta?.bt
                      ? RelationTypes.BELONGS_TO
                      : RelationTypes.HAS_MANY;
                  }

                  switch (relationType) {
                    case RelationTypes.BELONGS_TO:
                      {
                        selectQb.join(
                          knex.raw(`?? as ??`, [
                            baseModelSqlv2.getTnPath(parentModel.table_name),
                            nestedAlias,
                          ]),
                          `${alias}.${childColumn.column_name}`,
                          `${nestedAlias}.${parentColumn.column_name}`,
                        );
                        cn = knex.raw('??.??', [
                          nestedAlias,
                          parentModel?.displayValue?.column_name,
                        ]);
                      }
                      break;
                    case RelationTypes.HAS_MANY:
                      {
                        isArray = relation.type !== RelationTypes.ONE_TO_ONE;
                        selectQb.join(
                          knex.raw(`?? as ??`, [
                            baseModelSqlv2.getTnPath(childModel.table_name),
                            nestedAlias,
                          ]),
                          `${alias}.${parentColumn.column_name}`,
                          `${nestedAlias}.${childColumn.column_name}`,
                        );
                        cn = knex.raw('??.??', [
                          nestedAlias,
                          childModel?.displayValue?.column_name,
                        ]);
                      }
                      break;
                    case RelationTypes.MANY_TO_MANY:
                      {
                        isArray = true;
                        const mmModel = await relation.getMMModel(context);
                        const mmParentColumn = await relation.getMMParentColumn(
                          context,
                        );
                        const mmChildColumn = await relation.getMMChildColumn(
                          context,
                        );

                        const assocAlias = `__nc${aliasCount++}`;

                        selectQb
                          .join(
                            knex.raw(`?? as ??`, [
                              baseModelSqlv2.getTnPath(mmModel.table_name),
                              assocAlias,
                            ]),
                            `${assocAlias}.${mmChildColumn.column_name}`,
                            `${alias}.${childColumn.column_name}`,
                          )
                          .join(
                            knex.raw(`?? as ??`, [
                              baseModelSqlv2.getTnPath(parentModel.table_name),
                              nestedAlias,
                            ]),
                            `${nestedAlias}.${parentColumn.column_name}`,
                            `${assocAlias}.${mmParentColumn.column_name}`,
                          );
                      }
                      cn = knex.raw('??.??', [
                        nestedAlias,
                        parentModel?.displayValue?.column_name,
                      ]);
                  }

                  selectQb.join(
                    knex.raw(`?? as ??`, [
                      baseModelSqlv2.getTnPath(parentModel.table_name),
                      nestedAlias,
                    ]),
                    `${nestedAlias}.${parentColumn.column_name}`,
                    `${prevAlias}.${childColumn.column_name}`,
                  );

                  if (isArray) {
                    const qb = selectQb;
                    selectQb = (fn) =>
                      knex
                        .raw(
                          getAggregateFn(fn)({
                            qb,
                            knex,
                            cn: lookupColumn.column_name,
                          }),
                        )
                        .wrap('(', ')');
                  } else {
                    selectQb.select(`${prevAlias}.${cn}`);
                  }
                }
                break;
              case UITypes.Formula:
                {
                  const formulaOption =
                    await lookupColumn.getColOptions<FormulaColumn>(context);
                  const lookupModel = await lookupColumn.getModel(context);
                  const { builder } = await _formulaQueryBuilder({
                    baseModelSqlv2,
                    _tree: formulaOption.formula,
                    alias: '',
                    model: lookupModel,
                    aliasToColumn,
                    parsedTree: formulaOption.getParsedTree(),
                  });
                  if (isArray) {
                    const qb = selectQb;
                    selectQb = (fn) =>
                      knex
                        .raw(
                          getAggregateFn(fn)({
                            qb,
                            knex,
                            cn: knex.raw(builder).wrap('(', ')'),
                          }),
                        )
                        .wrap('(', ')');
                  } else {
                    selectQb.select(builder);
                  }
                }
                break;
              default:
                {
                  if (isArray) {
                    const qb = selectQb;
                    selectQb = (fn) =>
                      knex
                        .raw(
                          getAggregateFn(fn)({
                            qb,
                            knex,
                            cn: `${prevAlias}.${lookupColumn.column_name}`,
                          }),
                        )
                        .wrap('(', ')');
                  } else {
                    selectQb.select(`${prevAlias}.${lookupColumn.column_name}`);
                  }
                }

                break;
            }

            if (selectQb)
              return {
                builder:
                  typeof selectQb === 'function'
                    ? selectQb
                    : knex.raw(selectQb as any).wrap('(', ')'),
              };
          }
        };
        break;
      case UITypes.Rollup:
      case UITypes.Links:
        aliasToColumn[col.id] = async (): Promise<any> => {
          const qb = await genRollupSelectv2({
            baseModelSqlv2,
            knex,
            columnOptions: (await col.getColOptions(context)) as RollupColumn,
            alias: tableAlias,
          });
          return { builder: knex.raw(qb.builder).wrap('(', ')') };
        };
        break;
      case UITypes.LinkToAnotherRecord:
        aliasToColumn[col.id] = async (): Promise<any> => {
          const alias = `__nc_formula_ll`;
          const relation = await col.getColOptions<LinkToAnotherRecordColumn>(
            context,
          );
          // if (relation.type !== RelationTypes.BELONGS_TO) continue;

          const colOptions = (await col.getColOptions(
            context,
          )) as LinkToAnotherRecordColumn;
          const childColumn = await colOptions.getChildColumn(context);
          const parentColumn = await colOptions.getParentColumn(context);
          const childModel = await childColumn.getModel(context);
          await childModel.getColumns(context);
          const parentModel = await parentColumn.getModel(context);
          await parentModel.getColumns(context);

          let relationType = relation.type;

          if (relationType === RelationTypes.ONE_TO_ONE) {
            relationType = col.meta?.bt
              ? RelationTypes.BELONGS_TO
              : RelationTypes.HAS_MANY;
          }

          let selectQb;
          if (relationType === RelationTypes.BELONGS_TO) {
            const linkedDisplayValue = await getLinkedColumnDisplayValue({
              model: parentModel,
              aliasToColumn: { ...aliasToColumn, [col.id]: null },
            });
            selectQb = knex(baseModelSqlv2.getTnPath(parentModel.table_name))
              .select(
                typeof linkedDisplayValue === 'string'
                  ? linkedDisplayValue
                  : knex.raw(linkedDisplayValue.builder).wrap('(', ')'),
              )
              .where(
                `${baseModelSqlv2.getTnPath(parentModel.table_name)}.${
                  parentColumn.column_name
                }`,
                knex.raw(`??`, [
                  `${
                    tableAlias ??
                    baseModelSqlv2.getTnPath(childModel.table_name)
                  }.${childColumn.column_name}`,
                ]),
              );
          } else if (relationType == RelationTypes.HAS_MANY) {
            const qb = knex(baseModelSqlv2.getTnPath(childModel.table_name))
              // .select(knex.raw(`GROUP_CONCAT(??)`, [childModel?.pv?.title]))
              .where(
                `${baseModelSqlv2.getTnPath(childModel.table_name)}.${
                  childColumn.column_name
                }`,
                knex.raw(`??`, [
                  `${
                    tableAlias ??
                    baseModelSqlv2.getTnPath(parentModel.table_name)
                  }.${parentColumn.column_name}`,
                ]),
              );
            const childDisplayValue = await getLinkedColumnDisplayValue({
              model: childModel,
              aliasToColumn: { ...aliasToColumn, [col.id]: null },
            });
            selectQb = (fn) =>
              knex
                .raw(
                  getAggregateFn(fn)({
                    qb,
                    knex,
                    cn:
                      typeof childDisplayValue === 'string'
                        ? childDisplayValue
                        : childDisplayValue.builder,
                  }),
                )
                .wrap('(', ')');
            // getAggregateFn();
          } else if (relationType == RelationTypes.MANY_TO_MANY) {
            // todo:
            // const qb = knex(childModel.title)
            //   // .select(knex.raw(`GROUP_CONCAT(??)`, [childModel?.pv?.title]))
            //   .where(
            //     `${childModel.title}.${childColumn.title}`,
            //     knex.raw(`??`, [`${parentModel.title}.${parentColumn.title}`])
            //   );
            //
            // selectQb = fn =>
            //   knex
            //     .raw(
            //       getAggregateFn(fn)({
            //         qb,
            //         knex,
            //         cn: childModel?.pv?.title
            //       })
            //     )
            //     .wrap('(', ')');
            //
            // // getAggregateFn();

            //   todo: provide unique alias

            const mmModel = await relation.getMMModel(context);
            const mmParentColumn = await relation.getMMParentColumn(context);
            const mmChildColumn = await relation.getMMChildColumn(context);

            const qb = knex(
              knex.raw(`?? as ??`, [
                baseModelSqlv2.getTnPath(parentModel.table_name),
                alias,
              ]),
            )
              .join(
                `${baseModelSqlv2.getTnPath(mmModel.table_name)}`,
                `${baseModelSqlv2.getTnPath(mmModel.table_name)}.${
                  mmParentColumn.column_name
                }`,
                `${alias}.${parentColumn.column_name}`,
              )
              .where(
                `${baseModelSqlv2.getTnPath(mmModel.table_name)}.${
                  mmChildColumn.column_name
                }`,
                knex.raw(`??`, [
                  `${
                    tableAlias ??
                    baseModelSqlv2.getTnPath(childModel.table_name)
                  }.${childColumn.column_name}`,
                ]),
              );
            selectQb = (fn) =>
              knex
                .raw(
                  getAggregateFn(fn)({
                    qb,
                    knex,
                    cn: parentModel?.displayValue?.column_name,
                  }),
                )
                .wrap('(', ')');
          }
          if (selectQb)
            return {
              builder:
                typeof selectQb === 'function'
                  ? selectQb
                  : knex.raw(selectQb as any).wrap('(', ')'),
            };
        };
        break;
      case UITypes.CreatedTime:
      case UITypes.LastModifiedTime:
      case UITypes.DateTime:
        {
          const refCol = await getRefColumnIfAlias(context, col);

          if (refCol.id in aliasToColumn) {
            aliasToColumn[col.id] = aliasToColumn[refCol.id];
            break;
          }
          if (knex.clientType().startsWith('mysql')) {
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                // convert from DB timezone to UTC
                builder: knex.raw(
                  `CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00')`,
                  [refCol.column_name],
                ),
              };
            };
          } else if (
            knex.clientType() === 'pg' &&
            refCol.dt !== 'timestamp with time zone' &&
            refCol.dt !== 'timestamptz'
          ) {
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                // convert from DB timezone to UTC
                builder: knex
                  .raw(
                    `?? AT TIME ZONE CURRENT_SETTING('timezone') AT TIME ZONE 'UTC'`,
                    [refCol.column_name],
                  )
                  .wrap('(', ')'),
              };
            };
          } else if (
            knex.clientType() === 'mssql' &&
            refCol.dt !== 'datetimeoffset'
          ) {
            // convert from DB timezone to UTC
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                builder: knex.raw(
                  `CONVERT(DATETIMEOFFSET, ?? AT TIME ZONE 'UTC')`,
                  [refCol.column_name],
                ),
              };
            };
          } else {
            aliasToColumn[col.id] = () =>
              Promise.resolve({ builder: refCol.column_name });
          }
          aliasToColumn[refCol.id] = aliasToColumn[col.id];
        }
        break;
      case UITypes.User:
      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy:
        {
          aliasToColumn[col.id] = async (): Promise<any> => {
            baseUsers =
              baseUsers ??
              (await BaseUser.getUsersList(context, {
                base_id: model.base_id,
              }));

            // create nested replace statement for each user
            const finalStatement = baseUsers.reduce((acc, user) => {
              const qb = knex.raw(`REPLACE(${acc}, ?, ?)`, [
                user.id,
                user.email,
              ]);
              return qb.toQuery();
            }, knex.raw(`??`, [col.column_name]).toQuery());

            return {
              builder: knex.raw(finalStatement).wrap('(', ')'),
            };
          };
        }
        break;
      case UITypes.LongText: {
        if (col.meta?.[LongTextAiMetaProp] === true) {
          if (knex.clientType() === 'pg') {
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                builder: knex.raw(`TRIM('"' FROM (??::jsonb->>'value'))`, [
                  col.column_name,
                ]),
              };
            };
          } else if (knex.clientType().startsWith('mysql')) {
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                builder: knex.raw(`JSON_UNQUOTE(JSON_EXTRACT(??, '$.value'))`, [
                  col.column_name,
                ]),
              };
            };
          } else if (knex.clientType() === 'sqlite3') {
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                builder: knex.raw(`json_extract(??, '$.value')`, [
                  col.column_name,
                ]),
              };
            };
          } else if (knex.clientType() === 'mssql') {
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                builder: knex.raw(`JSON_VALUE(??, '$.value')`, [
                  col.column_name,
                ]),
              };
            };
          }
        } else {
          aliasToColumn[col.id] = () =>
            Promise.resolve({ builder: col.column_name });
        }
        break;
      }
      default:
        aliasToColumn[col.id] = () =>
          Promise.resolve({ builder: col.column_name });
        break;
    }
  }

  const fn = async (pt: FnParsedTreeNode, a?: string, prevBinaryOp?) => {
    const colAlias = a ? ` as ${a}` : '';
    if (pt.type === JSEPNode.CALL_EXP) {
      pt.arguments?.forEach?.((arg: FnParsedTreeNode) => {
        if (arg.fnName) return;
        arg.fnName = pt.callee.name.toUpperCase();
        arg.argsCount = pt.arguments?.length;
      });
    }

    // if cast is string, then wrap with STRING() function
    if (pt.cast === FormulaDataTypes.STRING) {
      return fn(
        {
          type: JSEPNode.CALL_EXP,
          arguments: [{ ...pt, cast: null }],
          callee: {
            type: 'Identifier',
            name: 'STRING',
          },
        },
        a,
        prevBinaryOp,
      );
    }

    if (pt.type === JSEPNode.CALL_EXP) {
      switch (pt.callee.name.toUpperCase()) {
        case 'ADD':
        case 'SUM':
          if (pt.arguments.length > 1) {
            return fn(
              {
                type: JSEPNode.BINARY_EXP,
                operator: '+',
                left: pt.arguments[0],
                right: { ...pt, arguments: pt.arguments.slice(1) },
              },
              a,
              prevBinaryOp,
            );
          } else {
            return fn(pt.arguments[0], a, prevBinaryOp);
          }
          break;
        case 'CONCAT':
          if (knex.clientType() === 'sqlite3') {
            if (pt.arguments.length > 1) {
              return fn(
                {
                  type: JSEPNode.BINARY_EXP,
                  operator: '||',
                  left: pt.arguments[0],
                  right: { ...pt, arguments: pt.arguments.slice(1) },
                },
                a,
                prevBinaryOp,
              );
            } else {
              return fn(pt.arguments[0], a, prevBinaryOp);
            }
          } else if (knex.clientType() === 'databricks') {
            const res = await mapFunctionName({
              pt,
              knex,
              alias,
              a,
              aliasToCol: aliasToColumn,
              fn,
              colAlias,
              prevBinaryOp,
              model,
            });
            if (res) return res;
          }
          break;
        case 'URL':
          return fn(
            {
              type: JSEPNode.CALL_EXP,
              arguments: [
                {
                  type: JSEPNode.LITERAL,
                  value: 'URI::(',
                  raw: '"URI::("',
                },
                pt.arguments[0],
                {
                  type: JSEPNode.LITERAL,
                  value: ')',
                  raw: '")"',
                },
                ...(pt.arguments[1]
                  ? ([
                      {
                        type: JSEPNode.LITERAL,
                        value: ' LABEL::(',
                        raw: ' LABEL::(',
                      },
                      pt.arguments[1],
                      {
                        type: JSEPNode.LITERAL,
                        value: ')',
                        raw: ')',
                      },
                    ] as ParsedFormulaNode[])
                  : ([] as ParsedFormulaNode[])),
              ],
              callee: {
                type: 'Identifier',
                name: 'CONCAT',
              },
            },
            alias,
            prevBinaryOp,
          );
          break;
        default:
          {
            const res = await mapFunctionName({
              pt,
              knex,
              alias,
              a,
              aliasToCol: aliasToColumn,
              fn,
              colAlias,
              prevBinaryOp,
              model,
            });
            if (res) return res;
          }
          break;
      }

      const calleeName = pt.callee.name.toUpperCase();
      return {
        builder: knex.raw(
          `${calleeName}(${(
            await Promise.all(
              pt.arguments.map(async (arg) => {
                let query = (await fn(arg)).builder.toQuery();
                if (calleeName === 'CONCAT') {
                  if (knex.clientType() !== 'sqlite3') {
                    query = await convertDateFormatForConcat(
                      context,
                      arg,
                      columnIdToUidt,
                      query,
                      knex.clientType(),
                    );
                  } else {
                    // sqlite3: special handling - See BinaryExpression
                  }

                  if (knex.clientType() === 'mysql2') {
                    // mysql2: CONCAT() returns NULL if any argument is NULL.
                    // adding IFNULL to convert NULL values to empty strings
                    return `IFNULL(${query}, '')`;
                  } else {
                    // do nothing
                    // pg / mssql: Concatenate all arguments. NULL arguments are ignored.
                    // sqlite3: special handling - See BinaryExpression
                  }
                }
                return query;
              }),
            )
          ).join()})${colAlias}`.replace(/\?/g, '\\?'),
        ),
      };
    } else if (pt.type === 'Literal') {
      return { builder: knex.raw(`?${colAlias}`, [pt.value]) };
    } else if (pt.type === 'Identifier') {
      const { builder } = (await aliasToColumn?.[pt.name]?.()) || {};
      if (typeof builder === 'function') {
        return { builder: knex.raw(`??${colAlias}`, builder(pt.fnName)) };
      }

      if (
        knex.clientType() === 'databricks' &&
        builder.toQuery().endsWith(')')
      ) {
        // limit 1 for subquery
        return {
          builder: knex.raw(
            `${builder.toQuery().replace(/\)$/, '')} LIMIT 1)${colAlias}`,
          ),
        };
      }

      return { builder: knex.raw(`??${colAlias}`, [builder || pt.name]) };
    } else if (pt.type === 'BinaryExpression') {
      // treat `&` as shortcut for concat
      if (pt.operator === '&') {
        return fn(
          {
            type: JSEPNode.CALL_EXP,
            arguments: [pt.left, pt.right],
            callee: {
              type: 'Identifier',
              name: 'CONCAT',
            },
          },
          alias,
          prevBinaryOp,
        );
      }

      // if operator is + and expected return type is string, convert to concat
      if (pt.operator === '+' && pt.dataType === FormulaDataTypes.STRING) {
        return fn(
          {
            type: JSEPNode.CALL_EXP,
            arguments: [pt.left, pt.right],
            callee: {
              type: 'Identifier',
              name: 'CONCAT',
            },
          },
          alias,
          prevBinaryOp,
        );
      }

      // if operator is == or !=, then handle comparison with BLANK which should accept NULL and empty string
      if (pt.operator === '==' || pt.operator === '!=') {
        for (const operand of ['left', 'right']) {
          if (
            pt[operand].dataType === FormulaDataTypes.BOOLEAN &&
            pt[operand === 'left' ? 'right' : 'left'].dataType ===
              FormulaDataTypes.NUMERIC
          ) {
            pt[operand === 'left' ? 'right' : 'left'] = {
              type: JSEPNode.CALL_EXP,
              arguments: [pt[operand === 'left' ? 'right' : 'left']],
              callee: {
                type: 'Identifier',
                name: 'BOOLEAN',
              },
              dataType: FormulaDataTypes.BOOLEAN,
            };
          }
        }
        if (
          (pt.left as CallExpressionNode).callee?.name !==
          (pt.right as CallExpressionNode).callee?.name
        ) {
          // if left/right is BLANK, accept both NULL and empty string
          for (const operand of ['left', 'right']) {
            if (
              pt[operand].type === 'CallExpression' &&
              pt[operand].callee.name === 'BLANK'
            ) {
              const isString =
                pt[operand === 'left' ? 'right' : 'left'].dataType ===
                FormulaDataTypes.STRING;
              let calleeName;

              if (pt.operator === '==') {
                calleeName = isString ? 'ISBLANK' : 'ISNULL';
              } else {
                calleeName = isString ? 'ISNOTBLANK' : 'ISNOTNULL';
              }

              return fn(
                {
                  type: JSEPNode.CALL_EXP,
                  arguments: [operand === 'left' ? pt.right : pt.left],
                  callee: {
                    type: 'Identifier',
                    name: calleeName,
                  },
                },
                alias,
                prevBinaryOp,
              );
            }
          }
        }
      }

      if (pt.operator === '==') {
        pt.operator = '=';
        // if left/right is of different type, convert to string and compare
        if (
          pt.left.dataType !== pt.right.dataType &&
          [pt.left.dataType, pt.right.dataType].every(
            (type) => type !== FormulaDataTypes.NULL,
          )
        ) {
          pt.left = {
            type: JSEPNode.CALL_EXP,
            arguments: [pt.left],
            callee: {
              type: 'Identifier',
              name: 'STRING',
            },
          };
          pt.right = {
            type: JSEPNode.CALL_EXP,
            arguments: [pt.right],
            callee: {
              type: 'Identifier',
              name: 'STRING',
            },
          };
        }
      }

      if (pt.operator === '/') {
        pt.left = {
          callee: { name: 'FLOAT' },
          type: JSEPNode.CALL_EXP,
          arguments: [pt.left],
        };
        pt.right = {
          callee: { name: 'FLOAT' },
          type: JSEPNode.CALL_EXP,
          arguments: [pt.right],
        };
      }
      (pt.left as FnParsedTreeNode).fnName =
        (pt.left as FnParsedTreeNode).fnName || 'ARITH';
      (pt.right as FnParsedTreeNode).fnName =
        (pt.right as FnParsedTreeNode).fnName || 'ARITH';

      let left = (await fn(pt.left, null, pt.operator)).builder.toQuery();
      let right = (await fn(pt.right, null, pt.operator)).builder.toQuery();
      let sql = `${left} ${pt.operator} ${right}${colAlias}`;

      if (ComparisonOperators.includes(pt.operator as ComparisonOperator)) {
        // comparing a date with empty string would throw
        // `ERROR: zero-length delimited identifier` in Postgres
        if (
          knex.clientType() === 'pg' &&
          columnIdToUidt[(pt.left as IdentifierNode).name] === UITypes.Date
        ) {
          // The correct way to compare with Date should be using
          // `IS_AFTER`, `IS_BEFORE`, or `IS_SAME`
          // This is to prevent empty data returned to UI due to incorrect SQL
          if ((pt.right as LiteralNode).value === '') {
            if (pt.operator === '=') {
              sql = `${left} IS NULL ${colAlias}`;
            } else {
              sql = `${left} IS NOT NULL ${colAlias}`;
            }
          } else if (
            !validateDateWithUnknownFormat(
              (pt.right as LiteralNode).value as string,
            )
          ) {
            // left tree value is date but right tree value is not date
            // return true if left tree value is not null, else false
            sql = `${left} IS NOT NULL ${colAlias}`;
          }
        }
        if (
          knex.clientType() === 'pg' &&
          columnIdToUidt[(pt.right as IdentifierNode).name] === UITypes.Date
        ) {
          // The correct way to compare with Date should be using
          // `IS_AFTER`, `IS_BEFORE`, or `IS_SAME`
          // This is to prevent empty data returned to UI due to incorrect SQL
          if ((pt.left as LiteralNode).value === '') {
            if (pt.operator === '=') {
              sql = `${right} IS NULL ${colAlias}`;
            } else {
              sql = `${right} IS NOT NULL ${colAlias}`;
            }
          } else if (
            !validateDateWithUnknownFormat(
              (pt.left as LiteralNode).value as string,
            )
          ) {
            // right tree value is date but left tree value is not date
            // return true if right tree value is not null, else false
            sql = `${right} IS NOT NULL ${colAlias}`;
          }
        }
      }

      if (
        (pt.left as FnParsedTreeNode).fnName === 'CONCAT' &&
        knex.clientType() === 'sqlite3'
      ) {
        // handle date format
        left = await convertDateFormatForConcat(
          context,
          (pt.left as CallExpressionNode)?.arguments?.[0],
          columnIdToUidt,
          left,
          knex.clientType(),
        );
        right = await convertDateFormatForConcat(
          context,
          (pt.right as CallExpressionNode)?.arguments?.[0],
          columnIdToUidt,
          right,
          knex.clientType(),
        );

        // handle NULL values when calling CONCAT for sqlite3
        sql = `COALESCE(${left}, '') ${pt.operator} COALESCE(${right},'')${colAlias}`;
      }

      if (knex.clientType() === 'mysql2') {
        sql = `IFNULL(${left} ${pt.operator} ${right}, ${
          pt.operator === '='
            ? pt.left.type === 'Literal'
              ? (pt.left as LiteralNode).value === ''
              : (pt.right as LiteralNode).value === ''
            : pt.operator === '!='
            ? pt.left.type !== 'Literal'
              ? (pt.left as any).value === ''
              : (pt.right as any).value === ''
            : 0
        }) ${colAlias}`;
      } else if (
        knex.clientType() === 'sqlite3' ||
        knex.clientType() === 'pg' ||
        knex.clientType() === 'mssql'
      ) {
        if (pt.operator === '=') {
          if (pt.left.type === 'Literal' && pt.left.value === '') {
            sql = `${right} IS NULL OR CAST(${right} AS TEXT) = ''`;
          } else if (pt.right.type === 'Literal' && pt.right.value === '') {
            sql = `${left} IS NULL OR CAST(${left} AS TEXT) = ''`;
          }
        } else if (pt.operator === '!=') {
          if (pt.left.type === 'Literal' && pt.left.value === '') {
            sql = `${right} IS NOT NULL AND CAST(${right} AS TEXT) != ''`;
          } else if (pt.right.type === 'Literal' && pt.right.value === '') {
            sql = `${left} IS NOT NULL AND CAST(${left} AS TEXT) != ''`;
          }
        }

        if (
          (pt.operator === '=' || pt.operator === '!=') &&
          prevBinaryOp !== 'AND' &&
          prevBinaryOp !== 'OR'
        ) {
          sql = `(CASE WHEN ${sql} THEN true ELSE false END ${colAlias})`;
        } else {
          sql = `${sql} ${colAlias}`;
        }
      }
      const query = knex.raw(sql.replace(/\?/g, '\\?'));
      if (prevBinaryOp && pt.operator !== prevBinaryOp) {
        query.wrap('(', ')');
      }
      return { builder: query };
    } else if (pt.type === 'UnaryExpression') {
      let query;
      if (
        (pt.operator === '-' || pt.operator === '+') &&
        pt.dataType === FormulaDataTypes.NUMERIC
      ) {
        query = knex.raw('?', [
          (pt.operator === '-' ? -1 : 1) *
            ((pt.argument as LiteralNode).value as number),
        ]);
      } else {
        query = knex.raw(
          `${pt.operator}${(
            await fn(pt.argument, null, pt.operator)
          ).builder.toQuery()}${colAlias}`,
        );
      }

      if (prevBinaryOp && pt.operator !== prevBinaryOp) {
        query.wrap('(', ')');
      }
      return { builder: query };
    }
  };
  const builder = (await fn(tree, alias)).builder;
  return { builder };
}

export default async function formulaQueryBuilderv2(
  baseModelSqlv2: BaseModelSqlv2,
  _tree,
  alias,
  model: Model,
  column?: Column,
  aliasToColumn = {},
  tableAlias?: string,
  validateFormula = false,
  parsedTree?: any,
  baseUsers?: (Partial<User> & BaseUser)[],
) {
  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

  // register jsep curly hook once only
  jsep.plugins.register(jsepCurlyHook);
  let qb;
  try {
    // generate qb
    qb = await _formulaQueryBuilder({
      baseModelSqlv2,
      _tree,
      alias,
      model,
      aliasToColumn,
      tableAlias,
      parsedTree:
        parsedTree ??
        (await column
          ?.getColOptions<FormulaColumn | ButtonColumn>(context)
          .then((formula) => formula?.getParsedTree())),
      baseUsers,
    });

    if (!validateFormula) return qb;

    // dry run qb.builder to see if it will break the grid view or not
    // if so, set formula error and show empty selectQb instead
    await baseModelSqlv2.execAndParse(
      knex(baseModelSqlv2.getTnPath(model, tableAlias))
        .select(knex.raw(`?? as ??`, [qb.builder, '__dry_run_alias']))
        .as('dry-run-only'),
      null,
      { raw: true },
    );

    // if column is provided, i.e. formula has been created
    if (column) {
      const formula = await column.getColOptions<FormulaColumn | ButtonColumn>(
        context,
      );
      // clean the previous formula error if the formula works this time
      if (formula.error) {
        if (formula.constructor.name === 'ButtonColumn') {
          await ButtonColumn.update(context, column.id, {
            error: null,
          });
        } else {
          await FormulaColumn.update(context, column.id, {
            error: null,
          });
        }
      }
    }
  } catch (e) {
    if (!validateFormula) throw e;

    console.error(e);
    if (column) {
      if (column?.uidt === UITypes.Button) {
        await ButtonColumn.update(context, column.id, {
          error: null,
        });
        // update cache to reflect the error in UI
        await NocoCache.update(`${CacheScope.COL_BUTTON}:${column.id}`, {
          error: e.message,
        });
      } else if (!(e instanceof ExternalTimeout)) {
        // add formula error to show in UI
        await FormulaColumn.update(context, column.id, {
          error: e.message,
        });

        // update cache to reflect the error in UI
        await NocoCache.update(`${CacheScope.COL_FORMULA}:${column.id}`, {
          error: e.message,
        });
      }
    }
    NcError.formulaError(e.message);
  }
  return qb;
}
