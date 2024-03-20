import jsep from 'jsep';
import {
  FormulaDataTypes,
  jsepCurlyHook,
  RelationTypes,
  UITypes,
  validateDateWithUnknownFormat,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import mapFunctionName from '../mapFunctionName';
import genRollupSelectv2 from '../genRollupSelectv2';
import type RollupColumn from '~/models/RollupColumn';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import type LookupColumn from '~/models/LookupColumn';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type Column from '~/models/Column';
import Model from '~/models/Model';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import { convertDateFormatForConcat } from '~/helpers/formulaFnHelper';
import FormulaColumn from '~/models/FormulaColumn';
import { Base, BaseUser } from '~/models';
import { getRefColumnIfAlias } from '~/helpers';

const logger = new Logger('FormulaQueryBuilderv2');

// @ts-ignore
const getAggregateFn: (fnName: string) => (args: { qb; knex?; cn }) => any = (
  parentFn,
) => {
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

async function _formulaQueryBuilder(
  baseModelSqlv2: BaseModelSqlv2,
  _tree,
  alias,
  model: Model,
  aliasToColumn: Record<string, () => Promise<{ builder: any }>> = {},
  tableAlias?: string,
  parsedTree?: any,
  column: Column = null,
) {
  const knex = baseModelSqlv2.dbDriver;

  const columns = await model.getColumns();

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
        const model = await Model.get(modelId);
        await model.getColumns();
        return model;
      },
    });

    // populate and save parsedTree to column if not exist
    if (column) {
      FormulaColumn.update(column.id, { parsed_tree: tree }).then(
        () => {
          // ignore
        },
        (err) => {
          logger.error(err);
        },
      );
    }
  }

  const columnIdToUidt = {};

  // todo: improve - implement a common solution for filter, sort, formula, etc
  for (const col of columns) {
    columnIdToUidt[col.id] = col.uidt;
    if (col.id in aliasToColumn) continue;
    switch (col.uidt) {
      case UITypes.Formula:
        {
          aliasToColumn[col.id] = async () => {
            const formulOption = await col.getColOptions<FormulaColumn>();
            const { builder } = await _formulaQueryBuilder(
              baseModelSqlv2,
              formulOption.formula,
              alias,
              model,
              { ...aliasToColumn, [col.id]: null },
              tableAlias,
              formulOption.getParsedTree(),
            );
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
          const lookup = await col.getColOptions<LookupColumn>();
          {
            const relationCol = await lookup.getRelationColumn();
            const relation =
              await relationCol.getColOptions<LinkToAnotherRecordColumn>();
            // if (relation.type !== RelationTypes.BELONGS_TO) continue;

            const childColumn = await relation.getChildColumn();
            const parentColumn = await relation.getParentColumn();
            const childModel = await childColumn.getModel();
            await childModel.getColumns();
            const parentModel = await parentColumn.getModel();
            await parentModel.getColumns();

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
                  const mmModel = await relation.getMMModel();
                  const mmParentColumn = await relation.getMMParentColumn();
                  const mmChildColumn = await relation.getMMChildColumn();

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

            let lookupColumn = await lookup.getLookupColumn();
            let prevAlias = alias;
            while (lookupColumn.uidt === UITypes.Lookup) {
              const nestedAlias = `__nc_formula${aliasCount++}`;
              const nestedLookup =
                await lookupColumn.getColOptions<LookupColumn>();
              const relationCol = await nestedLookup.getRelationColumn();
              const relation =
                await relationCol.getColOptions<LinkToAnotherRecordColumn>();
              // if any of the relation in nested lookup is
              // not belongs to then ignore the sort option
              // if (relation.type !== RelationTypes.BELONGS_TO) continue;

              const childColumn = await relation.getChildColumn();
              const parentColumn = await relation.getParentColumn();
              const childModel = await childColumn.getModel();
              await childModel.getColumns();
              const parentModel = await parentColumn.getModel();
              await parentModel.getColumns();

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
                  const mmModel = await relation.getMMModel();
                  const mmParentColumn = await relation.getMMParentColumn();
                  const mmChildColumn = await relation.getMMChildColumn();

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

              lookupColumn = await nestedLookup.getLookupColumn();
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
                      columnOptions:
                        (await lookupColumn.getColOptions()) as RollupColumn,
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
                    await lookupColumn.getColOptions<LinkToAnotherRecordColumn>();
                  // if (relation.type !== RelationTypes.BELONGS_TO) continue;

                  const colOptions =
                    (await lookupColumn.getColOptions()) as LinkToAnotherRecordColumn;
                  const childColumn = await colOptions.getChildColumn();
                  const parentColumn = await colOptions.getParentColumn();
                  const childModel = await childColumn.getModel();
                  await childModel.getColumns();
                  const parentModel = await parentColumn.getModel();
                  await parentModel.getColumns();
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
                        const mmModel = await relation.getMMModel();
                        const mmParentColumn =
                          await relation.getMMParentColumn();
                        const mmChildColumn = await relation.getMMChildColumn();

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
                    await lookupColumn.getColOptions<FormulaColumn>();
                  const lookupModel = await lookupColumn.getModel();
                  const { builder } = await _formulaQueryBuilder(
                    baseModelSqlv2,
                    formulaOption.formula,
                    '',
                    lookupModel,
                    aliasToColumn,
                    formulaOption.getParsedTree(),
                  );
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
            columnOptions: (await col.getColOptions()) as RollupColumn,
            alias: tableAlias,
          });
          return { builder: knex.raw(qb.builder).wrap('(', ')') };
        };
        break;
      case UITypes.LinkToAnotherRecord:
        aliasToColumn[col.id] = async (): Promise<any> => {
          const alias = `__nc_formula_ll`;
          const relation = await col.getColOptions<LinkToAnotherRecordColumn>();
          // if (relation.type !== RelationTypes.BELONGS_TO) continue;

          const colOptions =
            (await col.getColOptions()) as LinkToAnotherRecordColumn;
          const childColumn = await colOptions.getChildColumn();
          const parentColumn = await colOptions.getParentColumn();
          const childModel = await childColumn.getModel();
          await childModel.getColumns();
          const parentModel = await parentColumn.getModel();
          await parentModel.getColumns();

          let relationType = relation.type;

          if (relationType === RelationTypes.ONE_TO_ONE) {
            relationType = col.meta?.bt
              ? RelationTypes.BELONGS_TO
              : RelationTypes.HAS_MANY;
          }

          let selectQb;
          if (relationType === RelationTypes.BELONGS_TO) {
            selectQb = knex(baseModelSqlv2.getTnPath(parentModel.table_name))
              .select(parentModel?.displayValue?.column_name)
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

            selectQb = (fn) =>
              knex
                .raw(
                  getAggregateFn(fn)({
                    qb,
                    knex,
                    cn: childModel?.displayValue?.column_name,
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

            const mmModel = await relation.getMMModel();
            const mmParentColumn = await relation.getMMParentColumn();
            const mmChildColumn = await relation.getMMChildColumn();

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
          const refCol = await getRefColumnIfAlias(col);

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
          const base = await Base.get(model.base_id);
          const baseUsers = await BaseUser.getUsersList({
            base_id: base.id,
          });

          // create nested replace statement for each user
          const finalStatement = baseUsers.reduce((acc, user) => {
            const qb = knex.raw(`REPLACE(${acc}, ?, ?)`, [user.id, user.email]);
            return qb.toQuery();
          }, knex.raw(`??`, [col.column_name]).toQuery());

          aliasToColumn[col.id] = async (): Promise<any> => {
            return {
              builder: knex.raw(finalStatement).wrap('(', ')'),
            };
          };
        }
        break;
      default:
        aliasToColumn[col.id] = () =>
          Promise.resolve({ builder: col.column_name });
        break;
    }
  }

  const fn = async (pt, a?, prevBinaryOp?) => {
    const colAlias = a ? ` as ${a}` : '';
    pt.arguments?.forEach?.((arg) => {
      if (arg.fnName) return;
      arg.fnName = pt.callee.name.toUpperCase();
      arg.argsCount = pt.arguments?.length;
    });

    // if cast is string, then wrap with STRING() function
    if (pt.cast === FormulaDataTypes.STRING) {
      return fn(
        {
          type: 'CallExpression',
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

    if (pt.type === 'CallExpression') {
      switch (pt.callee.name.toUpperCase()) {
        case 'ADD':
        case 'SUM':
          if (pt.arguments.length > 1) {
            return fn(
              {
                type: 'BinaryExpression',
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
                  type: 'BinaryExpression',
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
          }
          break;
        case 'URL':
          return fn(
            {
              type: 'CallExpression',
              arguments: [
                {
                  type: 'Literal',
                  value: 'URI::(',
                  raw: '"URI::("',
                },
                pt.arguments[0],
                {
                  type: 'Literal',
                  value: ')',
                  raw: '")"',
                },
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
      return { builder: knex.raw(`??${colAlias}`, [builder || pt.name]) };
    } else if (pt.type === 'BinaryExpression') {
      // treat `&` as shortcut for concat
      if (pt.operator === '&') {
        return fn(
          {
            type: 'CallExpression',
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
            type: 'CallExpression',
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
              type: 'CallExpression',
              arguments: [pt[operand === 'left' ? 'right' : 'left']],
              callee: {
                type: 'Identifier',
                name: 'BOOLEAN',
              },
              dataType: FormulaDataTypes.BOOLEAN,
            };
          }
        }
        if (pt.left.callee?.name !== pt.right.callee?.name) {
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
                  type: 'CallExpression',
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
            type: 'CallExpression',
            arguments: [pt.left],
            callee: {
              type: 'Identifier',
              name: 'STRING',
            },
          };
          pt.right = {
            type: 'CallExpression',
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
          type: 'CallExpression',
          arguments: [pt.left],
        };
        pt.right = {
          callee: { name: 'FLOAT' },
          type: 'CallExpression',
          arguments: [pt.right],
        };
      }
      pt.left.fnName = pt.left.fnName || 'ARITH';
      pt.right.fnName = pt.right.fnName || 'ARITH';

      let left = (await fn(pt.left, null, pt.operator)).builder.toQuery();
      let right = (await fn(pt.right, null, pt.operator)).builder.toQuery();
      let sql = `${left} ${pt.operator} ${right}${colAlias}`;

      // comparing a date with empty string would throw
      // `ERROR: zero-length delimited identifier` in Postgres
      if (
        knex.clientType() === 'pg' &&
        columnIdToUidt[pt.left.name] === UITypes.Date
      ) {
        // The correct way to compare with Date should be using
        // `IS_AFTER`, `IS_BEFORE`, or `IS_SAME`
        // This is to prevent empty data returned to UI due to incorrect SQL
        if (pt.right.value === '') {
          if (pt.operator === '=') {
            sql = `${left} IS NULL ${colAlias}`;
          } else {
            sql = `${left} IS NOT NULL ${colAlias}`;
          }
        } else if (!validateDateWithUnknownFormat(pt.right.value)) {
          // left tree value is date but right tree value is not date
          // return true if left tree value is not null, else false
          sql = `${left} IS NOT NULL ${colAlias}`;
        }
      }
      if (
        knex.clientType() === 'pg' &&
        columnIdToUidt[pt.right.name] === UITypes.Date
      ) {
        // The correct way to compare with Date should be using
        // `IS_AFTER`, `IS_BEFORE`, or `IS_SAME`
        // This is to prevent empty data returned to UI due to incorrect SQL
        if (pt.left.value === '') {
          if (pt.operator === '=') {
            sql = `${right} IS NULL ${colAlias}`;
          } else {
            sql = `${right} IS NOT NULL ${colAlias}`;
          }
        } else if (!validateDateWithUnknownFormat(pt.left.value)) {
          // right tree value is date but left tree value is not date
          // return true if right tree value is not null, else false
          sql = `${right} IS NOT NULL ${colAlias}`;
        }
      }

      if (pt.left.fnName === 'CONCAT' && knex.clientType() === 'sqlite3') {
        // handle date format
        left = await convertDateFormatForConcat(
          pt.left?.arguments?.[0],
          columnIdToUidt,
          left,
          knex.clientType(),
        );
        right = await convertDateFormatForConcat(
          pt.right?.arguments?.[0],
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
              ? pt.left.value === ''
              : pt.right.value === ''
            : pt.operator === '!='
            ? pt.left.type !== 'Literal'
              ? pt.left.value === ''
              : pt.right.value === ''
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
          (pt.operator === '-' ? -1 : 1) * pt.argument.value,
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
) {
  const knex = baseModelSqlv2.dbDriver;
  // register jsep curly hook once only
  jsep.plugins.register(jsepCurlyHook);
  let qb;
  try {
    // generate qb
    qb = await _formulaQueryBuilder(
      baseModelSqlv2,
      _tree,
      alias,
      model,
      aliasToColumn,
      tableAlias,
      parsedTree ??
        (await column
          ?.getColOptions<FormulaColumn>()
          .then((formula) => formula?.getParsedTree())),
    );

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
      const formula = await column.getColOptions<FormulaColumn>();
      // clean the previous formula error if the formula works this time
      if (formula.error) {
        await FormulaColumn.update(column.id, {
          error: null,
        });
      }
    }
  } catch (e) {
    if (!validateFormula) throw e;

    console.error(e);
    if (column) {
      // add formula error to show in UI
      await FormulaColumn.update(column.id, {
        error: e.message,
      });
      // update cache to reflect the error in UI
      await NocoCache.update(`${CacheScope.COL_FORMULA}:${column.id}`, {
        error: e.message,
      });
    }
    throw new Error(`Formula error: ${e.message}`);
  }
  return qb;
}
