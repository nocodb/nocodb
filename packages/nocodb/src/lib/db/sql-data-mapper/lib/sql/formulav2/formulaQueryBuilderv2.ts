import jsep from 'jsep';
import { jsepCurlyHook, UITypes } from 'nocodb-sdk';
import mapFunctionName from '../mapFunctionName';
import genRollupSelectv2 from '../genRollupSelectv2';
import FormulaColumn from '../../../../../models/FormulaColumn';
import { validateDateWithUnknownFormat } from '../helpers/formulaFnHelper';
import { CacheGetType, CacheScope } from '../../../../../utils/globals';
import NocoCache from '../../../../../cache/NocoCache';
import Column from '../../../../../models/Column';
import { convertDateFormat } from '../helpers/convertDateFormat';
import type Model from '../../../../../models/Model';
import type RollupColumn from '../../../../../models/RollupColumn';
import type { XKnex } from '../../../index';
import type LinkToAnotherRecordColumn from '../../../../../models/LinkToAnotherRecordColumn';
import type LookupColumn from '../../../../../models/LookupColumn';

// todo: switch function based on database

// @ts-ignore
const getAggregateFn: (fnName: string) => (args: { qb; knex?; cn }) => any = (
  parentFn
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
  _tree,
  alias,
  knex: XKnex,
  model: Model,
  aliasToColumn: Record<string, () => Promise<{ builder: any }>> = {},
  tableAlias?: string
) {
  // formula may include double curly brackets in previous version
  // convert to single curly bracket here for compatibility
  const tree = jsep(_tree.replaceAll('{{', '{').replaceAll('}}', '}'));

  const columnIdToUidt = {};

  // todo: improve - implement a common solution for filter, sort, formula, etc
  for (const col of await model.getColumns()) {
    columnIdToUidt[col.id] = col.uidt;
    if (col.id in aliasToColumn) continue;
    switch (col.uidt) {
      case UITypes.Formula:
        {
          aliasToColumn[col.id] = async () => {
            const formulOption = await col.getColOptions<FormulaColumn>();
            const { builder } = await _formulaQueryBuilder(
              formulOption.formula,
              alias,
              knex,
              model,
              { ...aliasToColumn, [col.id]: null },
              tableAlias
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
          let isMany = false;
          const alias = `__nc_formula${aliasCount++}`;
          const lookup = await col.getColOptions<LookupColumn>();
          {
            const relationCol = await lookup.getRelationColumn();
            const relation =
              await relationCol.getColOptions<LinkToAnotherRecordColumn>();
            // if (relation.type !== 'bt') continue;

            const childColumn = await relation.getChildColumn();
            const parentColumn = await relation.getParentColumn();
            const childModel = await childColumn.getModel();
            await childModel.getColumns();
            const parentModel = await parentColumn.getModel();
            await parentModel.getColumns();
            switch (relation.type) {
              case 'bt':
                selectQb = knex(`${parentModel.table_name} as ${alias}`).where(
                  `${alias}.${parentColumn.column_name}`,
                  knex.raw(`??`, [
                    `${tableAlias ?? childModel.table_name}.${
                      childColumn.column_name
                    }`,
                  ])
                );
                break;
              case 'hm':
                isMany = true;
                selectQb = knex(`${childModel.table_name} as ${alias}`).where(
                  `${alias}.${childColumn.column_name}`,
                  knex.raw(`??`, [
                    `${tableAlias ?? parentModel.table_name}.${
                      parentColumn.column_name
                    }`,
                  ])
                );
                break;
              case 'mm':
                {
                  isMany = true;
                  const mmModel = await relation.getMMModel();
                  const mmParentColumn = await relation.getMMParentColumn();
                  const mmChildColumn = await relation.getMMChildColumn();

                  const assocAlias = `__nc${aliasCount++}`;
                  selectQb = knex(`${parentModel.table_name} as ${alias}`)
                    .join(
                      `${mmModel.table_name} as ${assocAlias}`,
                      `${assocAlias}.${mmParentColumn.column_name}`,
                      `${alias}.${parentColumn.column_name}`
                    )
                    .where(
                      `${assocAlias}.${mmChildColumn.column_name}`,
                      knex.raw(`??`, [
                        `${tableAlias ?? childModel.table_name}.${
                          childColumn.column_name
                        }`,
                      ])
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
              // if (relation.type !== 'bt') continue;

              const childColumn = await relation.getChildColumn();
              const parentColumn = await relation.getParentColumn();
              const childModel = await childColumn.getModel();
              await childModel.getColumns();
              const parentModel = await parentColumn.getModel();
              await parentModel.getColumns();

              switch (relation.type) {
                case 'bt':
                  {
                    selectQb.join(
                      `${parentModel.table_name} as ${nestedAlias}`,
                      `${prevAlias}.${childColumn.column_name}`,
                      `${nestedAlias}.${parentColumn.column_name}`
                    );
                  }
                  break;
                case 'hm':
                  {
                    isMany = true;
                    selectQb.join(
                      `${childModel.table_name} as ${nestedAlias}`,
                      `${prevAlias}.${parentColumn.column_name}`,
                      `${nestedAlias}.${childColumn.column_name}`
                    );
                  }
                  break;
                case 'mm': {
                  isMany = true;
                  const mmModel = await relation.getMMModel();
                  const mmParentColumn = await relation.getMMParentColumn();
                  const mmChildColumn = await relation.getMMChildColumn();

                  const assocAlias = `__nc${aliasCount++}`;

                  selectQb
                    .join(
                      `${mmModel.table_name} as ${assocAlias}`,
                      `${assocAlias}.${mmChildColumn.column_name}`,
                      `${prevAlias}.${childColumn.column_name}`
                    )
                    .join(
                      `${parentModel.table_name} as ${nestedAlias}`,
                      `${nestedAlias}.${parentColumn.column_name}`,
                      `${assocAlias}.${mmParentColumn.column_name}`
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
              case UITypes.Rollup:
                {
                  const builder = (
                    await genRollupSelectv2({
                      knex,
                      alias: prevAlias,
                      columnOptions:
                        (await lookupColumn.getColOptions()) as RollupColumn,
                    })
                  ).builder;
                  // selectQb.select(builder);

                  if (isMany) {
                    const qb = selectQb;
                    selectQb = (fn) =>
                      knex
                        .raw(
                          getAggregateFn(fn)({
                            qb,
                            knex,
                            cn: knex.raw(builder).wrap('(', ')'),
                          })
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
                  // if (relation.type !== 'bt') continue;

                  const colOptions =
                    (await lookupColumn.getColOptions()) as LinkToAnotherRecordColumn;
                  const childColumn = await colOptions.getChildColumn();
                  const parentColumn = await colOptions.getParentColumn();
                  const childModel = await childColumn.getModel();
                  await childModel.getColumns();
                  const parentModel = await parentColumn.getModel();
                  await parentModel.getColumns();
                  let cn;
                  switch (relation.type) {
                    case 'bt':
                      {
                        selectQb.join(
                          `${parentModel.table_name} as ${nestedAlias}`,
                          `${alias}.${childColumn.column_name}`,
                          `${nestedAlias}.${parentColumn.column_name}`
                        );
                        cn = knex.raw('??.??', [
                          nestedAlias,
                          parentModel?.displayValue?.column_name,
                        ]);
                      }
                      break;
                    case 'hm':
                      {
                        isMany = true;
                        selectQb.join(
                          `${childModel.table_name} as ${nestedAlias}`,
                          `${alias}.${parentColumn.column_name}`,
                          `${nestedAlias}.${childColumn.column_name}`
                        );
                        cn = knex.raw('??.??', [
                          nestedAlias,
                          childModel?.displayValue?.column_name,
                        ]);
                      }
                      break;
                    case 'mm':
                      {
                        isMany = true;
                        const mmModel = await relation.getMMModel();
                        const mmParentColumn =
                          await relation.getMMParentColumn();
                        const mmChildColumn = await relation.getMMChildColumn();

                        const assocAlias = `__nc${aliasCount++}`;

                        selectQb
                          .join(
                            `${mmModel.table_name} as ${assocAlias}`,
                            `${assocAlias}.${mmChildColumn.column_name}`,
                            `${alias}.${childColumn.column_name}`
                          )
                          .join(
                            `${parentModel.table_name} as ${nestedAlias}`,
                            `${nestedAlias}.${parentColumn.column_name}`,
                            `${assocAlias}.${mmParentColumn.column_name}`
                          );
                      }
                      cn = knex.raw('??.??', [
                        nestedAlias,
                        parentModel?.displayValue?.column_name,
                      ]);
                  }

                  selectQb.join(
                    `${parentModel.table_name} as ${nestedAlias}`,
                    `${nestedAlias}.${parentColumn.column_name}`,
                    `${prevAlias}.${childColumn.column_name}`
                  );

                  if (isMany) {
                    const qb = selectQb;
                    selectQb = (fn) =>
                      knex
                        .raw(
                          getAggregateFn(fn)({
                            qb,
                            knex,
                            cn: lookupColumn.column_name,
                          })
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
                    formulaOption.formula,
                    '',
                    knex,
                    lookupModel,
                    aliasToColumn
                  );
                  if (isMany) {
                    const qb = selectQb;
                    selectQb = (fn) =>
                      knex
                        .raw(
                          getAggregateFn(fn)({
                            qb,
                            knex,
                            cn: knex.raw(builder).wrap('(', ')'),
                          })
                        )
                        .wrap('(', ')');
                  } else {
                    selectQb.select(builder);
                  }
                }
                break;
              default:
                {
                  if (isMany) {
                    const qb = selectQb;
                    selectQb = (fn) =>
                      knex
                        .raw(
                          getAggregateFn(fn)({
                            qb,
                            knex,
                            cn: `${prevAlias}.${lookupColumn.column_name}`,
                          })
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
        aliasToColumn[col.id] = async (): Promise<any> => {
          const qb = await genRollupSelectv2({
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
          // if (relation.type !== 'bt') continue;

          const colOptions =
            (await col.getColOptions()) as LinkToAnotherRecordColumn;
          const childColumn = await colOptions.getChildColumn();
          const parentColumn = await colOptions.getParentColumn();
          const childModel = await childColumn.getModel();
          await childModel.getColumns();
          const parentModel = await parentColumn.getModel();
          await parentModel.getColumns();

          let selectQb;
          if (relation.type === 'bt') {
            selectQb = knex(parentModel.table_name)
              .select(parentModel?.displayValue?.column_name)
              .where(
                `${parentModel.table_name}.${parentColumn.column_name}`,
                knex.raw(`??`, [
                  `${tableAlias ?? childModel.table_name}.${
                    childColumn.column_name
                  }`,
                ])
              );
          } else if (relation.type == 'hm') {
            const qb = knex(childModel.table_name)
              // .select(knex.raw(`GROUP_CONCAT(??)`, [childModel?.pv?.title]))
              .where(
                `${childModel.table_name}.${childColumn.column_name}`,
                knex.raw(`??`, [
                  `${tableAlias ?? parentModel.table_name}.${
                    parentColumn.column_name
                  }`,
                ])
              );

            selectQb = (fn) =>
              knex
                .raw(
                  getAggregateFn(fn)({
                    qb,
                    knex,
                    cn: childModel?.displayValue?.column_name,
                  })
                )
                .wrap('(', ')');

            // getAggregateFn();
          } else if (relation.type == 'mm') {
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

            const qb = knex(`${parentModel.table_name} as ${alias}`)
              .join(
                `${mmModel.table_name}`,
                `${mmModel.table_name}.${mmParentColumn.column_name}`,
                `${alias}.${parentColumn.column_name}`
              )
              .where(
                `${mmModel.table_name}.${mmChildColumn.column_name}`,
                knex.raw(`??`, [
                  `${tableAlias ?? childModel.table_name}.${
                    childColumn.column_name
                  }`,
                ])
              );
            selectQb = (fn) =>
              knex
                .raw(
                  getAggregateFn(fn)({
                    qb,
                    knex,
                    cn: parentModel?.displayValue?.column_name,
                  })
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
      arg.fnName = pt.callee.name;
      arg.argsCount = pt.arguments?.length;
    });
    if (pt.type === 'CallExpression') {
      switch (pt.callee.name) {
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
              prevBinaryOp
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
                prevBinaryOp
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
            prevBinaryOp
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
            });
            if (res) return res;
          }
          break;
      }

      return {
        builder: knex.raw(
          `${pt.callee.name}(${(
            await Promise.all(
              pt.arguments.map(async (arg) => {
                let query = (await fn(arg)).builder.toQuery();
                if (pt.callee.name === 'CONCAT') {
                  if (
                    arg.type === 'Identifier' &&
                    arg.name in columnIdToUidt &&
                    columnIdToUidt[arg.name] === UITypes.Date
                  ) {
                    const meta = (
                      await Column.get({
                        colId: arg.name,
                      })
                    ).meta;

                    if (knex.clientType() === 'mysql2') {
                      query = `DATE_FORMAT(${query}, '${convertDateFormat(
                        meta.date_format,
                        knex.clientType()
                      )}')`;
                    } else if (knex.clientType() === 'pg') {
                      query = `TO_CHAR(${query}, '${convertDateFormat(
                        meta.date_format,
                        knex.clientType()
                      )}')`;
                    } else if (knex.clientType() === 'sqlite') {
                      query = `strftime('${convertDateFormat(
                        meta.date_format,
                        knex.clientType()
                      )}', ${query})`;
                    } else if (knex.clientType() === 'mssql') {
                      query = `FORMAT(${query}, '${convertDateFormat(
                        meta.date_format,
                        knex.clientType()
                      )}')`;
                    }
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
              })
            )
          ).join()})${colAlias}`.replace(/\?/g, '\\?')
        ),
      };
    } else if (pt.type === 'Literal') {
      return { builder: knex.raw(`?${colAlias}`, [pt.value]) };
    } else if (pt.type === 'Identifier') {
      const { builder } = await aliasToColumn?.[pt.name]?.();
      if (typeof builder === 'function') {
        return { builder: knex.raw(`??${colAlias}`, builder(pt.fnName)) };
      }
      return { builder: knex.raw(`??${colAlias}`, [builder || pt.name]) };
    } else if (pt.type === 'BinaryExpression') {
      if (pt.operator === '==') {
        pt.operator = '=';
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

      const left = (await fn(pt.left, null, pt.operator)).builder.toQuery();
      const right = (await fn(pt.right, null, pt.operator)).builder.toQuery();
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

      // handle NULL values when calling CONCAT for sqlite3
      if (pt.left.fnName === 'CONCAT' && knex.clientType() === 'sqlite3') {
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
      const query = knex.raw(
        `${pt.operator}${fn(
          pt.argument,
          null,
          pt.operator
        ).toQuery()}${colAlias}`
      );
      if (prevBinaryOp && pt.operator !== prevBinaryOp) {
        query.wrap('(', ')');
      }
      return { builder: query };
    }
  };
  const builder = (await fn(tree, alias)).builder;

  return { builder };
}

function getTnPath(tb: Model, knex, tableAlias?: string) {
  const schema = knex.searchPath?.();
  if (knex.clientType() === 'mssql' && schema) {
    return knex.raw(`??.??${tableAlias ? ' as ??' : ''}`, [
      schema,
      tb.table_name,
      ...(tableAlias ? [tableAlias] : []),
    ]);
  } else if (knex.clientType() === 'snowflake') {
    return (
      [
        knex.client.config.connection.database,
        knex.client.config.connection.schema,
        tb.table_name,
      ].join('.') + (tableAlias ? ` as ${tableAlias}` : '')
    );
  } else {
    return knex.raw(`??${tableAlias ? ' as ??' : ''}`, [
      tb.table_name,
      ...(tableAlias ? [tableAlias] : []),
    ]);
  }
}

export default async function formulaQueryBuilderv2(
  _tree,
  alias,
  knex: XKnex,
  model: Model,
  column?: Column,
  aliasToColumn = {},
  tableAlias?: string,
  validateFormula = false
) {
  // register jsep curly hook once only
  jsep.plugins.register(jsepCurlyHook);
  // generate qb
  const qb = await _formulaQueryBuilder(
    _tree,
    alias,
    knex,
    model,
    aliasToColumn,
    tableAlias
  );

  if (!validateFormula) return qb;

  try {
    // dry run qb.builder to see if it will break the grid view or not
    // if so, set formula error and show empty selectQb instead
    await knex(getTnPath(model, knex, tableAlias))
      .select(knex.raw(`?? as ??`, [qb.builder, '__dry_run_alias']))
      .as('dry-run-only');

    // if column is provided, i.e. formula has been created
    if (column) {
      const formula = await column.getColOptions<FormulaColumn>();
      // clean the previous formula error if the formula works this time
      if (formula.error) {
        await FormulaColumn.update(formula.id, {
          error: null,
        });
      }
    }
  } catch (e) {
    console.error(e);
    if (column) {
      const formula = await column.getColOptions<FormulaColumn>();
      // add formula error to show in UI
      await FormulaColumn.update(formula.id, {
        error: e.message,
      });
      // update cache to reflect the error in UI
      const key = `${CacheScope.COL_FORMULA}:${column.id}`;
      let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
      if (o) {
        o = { ...o, error: e.message };
        // set cache
        await NocoCache.set(key, o);
      }
    }
    throw new Error(`Formula error: ${e.message}`);
  }
  return qb;
}
