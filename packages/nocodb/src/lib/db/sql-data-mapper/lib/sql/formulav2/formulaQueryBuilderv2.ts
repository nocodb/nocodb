import jsep from 'jsep';
import mapFunctionName from '../mapFunctionName';
import Model from '../../../../../models/Model';
import genRollupSelectv2 from '../genRollupSelectv2';
import RollupColumn from '../../../../../models/RollupColumn';
import FormulaColumn from '../../../../../models/FormulaColumn';
import { XKnex } from '../../../index';
import LinkToAnotherRecordColumn from '../../../../../models/LinkToAnotherRecordColumn';
import LookupColumn from '../../../../../models/LookupColumn';
import { jsepCurlyHook, UITypes } from 'nocodb-sdk';

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

export default async function formulaQueryBuilderv2(
  _tree,
  alias,
  knex: XKnex,
  model: Model,
  aliasToColumn = {}
) {
  // register jsep curly hook
  jsep.plugins.register(jsepCurlyHook);
  const tree = jsep(_tree);

  // todo: improve - implement a common solution for filter, sort, formula, etc
  for (const col of await model.getColumns()) {
    if (col.id in aliasToColumn) continue;
    switch (col.uidt) {
      case UITypes.Formula:
        {
          const formulOption = await col.getColOptions<FormulaColumn>();
          const { builder } = await formulaQueryBuilderv2(
            formulOption.formula,
            alias,
            knex,
            model,
            { ...aliasToColumn, [col.id]: null }
          );
          builder.sql = '(' + builder.sql + ')';
          aliasToColumn[col.id] = builder;
        }
        break;
      case UITypes.Lookup:
        {
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
                    `${childModel.table_name}.${childColumn.column_name}`,
                  ])
                );
                break;
              case 'hm':
                isMany = true;
                selectQb = knex(`${childModel.table_name} as ${alias}`).where(
                  `${alias}.${childColumn.column_name}`,
                  knex.raw(`??`, [
                    `${parentModel.table_name}.${parentColumn.column_name}`,
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
                        `${childModel.table_name}.${childColumn.column_name}`,
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
                          parentModel?.primaryValue?.column_name,
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
                          childModel?.primaryValue?.column_name,
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
                        parentModel?.primaryValue?.column_name,
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
                  const { builder } = await formulaQueryBuilderv2(
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
              aliasToColumn[col.id] =
                typeof selectQb === 'function'
                  ? selectQb
                  : knex.raw(selectQb as any).wrap('(', ')');
          }
        }
        break;
      case UITypes.Rollup:
        {
          const qb = await genRollupSelectv2({
            knex,
            columnOptions: (await col.getColOptions()) as RollupColumn,
          });
          aliasToColumn[col.id] = knex.raw(qb.builder).wrap('(', ')');
        }
        break;
      case UITypes.LinkToAnotherRecord:
        {
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
              .select(parentModel?.primaryValue?.column_name)
              .where(
                `${parentModel.table_name}.${parentColumn.column_name}`,
                knex.raw(`??`, [
                  `${childModel.table_name}.${childColumn.column_name}`,
                ])
              );
          } else if (relation.type == 'hm') {
            const qb = knex(childModel.table_name)
              // .select(knex.raw(`GROUP_CONCAT(??)`, [childModel?.pv?.title]))
              .where(
                `${childModel.table_name}.${childColumn.column_name}`,
                knex.raw(`??`, [
                  `${parentModel.table_name}.${parentColumn.column_name}`,
                ])
              );

            selectQb = (fn) =>
              knex
                .raw(
                  getAggregateFn(fn)({
                    qb,
                    knex,
                    cn: childModel?.primaryValue?.column_name,
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
                  `${childModel.table_name}.${childColumn.column_name}`,
                ])
              );
            selectQb = (fn) =>
              knex
                .raw(
                  getAggregateFn(fn)({
                    qb,
                    knex,
                    cn: parentModel?.primaryValue?.column_name,
                  })
                )
                .wrap('(', ')');
          }
          if (selectQb)
            aliasToColumn[col.id] =
              typeof selectQb === 'function'
                ? selectQb
                : knex.raw(selectQb as any).wrap('(', ')');
        }
        break;
      default:
        aliasToColumn[col.id] = col.column_name;
        break;
    }
  }

  const fn = (pt, a?, prevBinaryOp?) => {
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
        // case 'AVG':
        //   if (pt.arguments.length > 1) {
        //     return fn({
        //       type: 'BinaryExpression',
        //       operator: '/',
        //       left: {...pt, callee: {name: 'SUM'}},
        //       right: {type: 'Literal', value: pt.arguments.length}
        //     }, a, prevBinaryOp)
        //   } else {
        //     return fn(pt.arguments[0], a, prevBinaryOp)
        //   }
        //   break;
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
            const res = mapFunctionName({
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

      return knex.raw(
        `${pt.callee.name}(${pt.arguments
          .map((arg) => {
            const query = fn(arg).toQuery();
            if (pt.callee.name === 'CONCAT') {
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
          .join()})${colAlias}`.replace(/\?/g, '\\?')
      );
    } else if (pt.type === 'Literal') {
      return knex.raw(`?${colAlias}`, [pt.value]);
    } else if (pt.type === 'Identifier') {
      if (typeof aliasToColumn?.[pt.name] === 'function') {
        return knex.raw(`??${colAlias}`, aliasToColumn?.[pt.name](pt.fnName));
      }
      return knex.raw(`??${colAlias}`, [aliasToColumn?.[pt.name] || pt.name]);
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
      }
      pt.left.fnName = pt.left.fnName || 'ARITH';
      pt.right.fnName = pt.right.fnName || 'ARITH';

      const left = fn(pt.left, null, pt.operator).toQuery();
      const right = fn(pt.right, null, pt.operator).toQuery();
      let sql = `${left} ${pt.operator} ${right}${colAlias}`;

      // handle NULL values when calling CONCAT for sqlite3
      if (pt.left.fnName === 'CONCAT' && knex.clientType() === 'sqlite3') {
        sql = `COALESCE(${left}, '') ${pt.operator} COALESCE(${right},'')${colAlias}`;
      }

      const query = knex.raw(sql);
      if (prevBinaryOp && pt.operator !== prevBinaryOp) {
        query.wrap('(', ')');
      }
      return query;
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
      return query;
    }
  };
  return { builder: fn(tree, alias) };
}
