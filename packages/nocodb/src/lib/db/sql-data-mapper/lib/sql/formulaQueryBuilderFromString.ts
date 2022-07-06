import jsep from 'jsep';
import mapFunctionName from './mapFunctionName';

// todo: switch function based on database

export function formulaQueryBuilderFromString(str, alias, knex) {
  return formulaQueryBuilder(jsep(str), alias, knex);
}

export default function formulaQueryBuilder(
  tree,
  alias,
  knex,
  aliasToColumn = {}
) {
  const fn = (pt, alias?, prevBinaryOp?) => {
    const colAlias = alias ? ` as "${alias}"` : '';
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
              alias,
              prevBinaryOp
            );
          } else {
            return fn(pt.arguments[0], alias, prevBinaryOp);
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
                alias,
                prevBinaryOp
              );
            } else {
              return fn(pt.arguments[0], alias, prevBinaryOp);
            }
          }
          break;
        case 'DATEADD':
          if (pt.arguments[1].value) {
            pt.callee.name = 'DATE_ADD';
            return fn(pt, alias, prevBinaryOp);
          } else if (pt.arguments[1].operator == '-') {
            pt.callee.name = 'DATE_SUB';
            return fn(pt, alias, prevBinaryOp);
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
              a: alias,
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
          .map((arg) => fn(arg).toQuery())
          .join()})${colAlias}`
      );
    } else if (pt.type === 'Literal') {
      return knex.raw(`?${colAlias}`, [pt.value]);
    } else if (pt.type === 'Identifier') {
      return knex.raw(`??${colAlias}`, [aliasToColumn[pt.name] || pt.name]);
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

      const query = knex.raw(
        `${fn(pt.left, null, pt.operator).toQuery()} ${pt.operator} ${fn(
          pt.right,
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
  return fn(tree, alias);
}
