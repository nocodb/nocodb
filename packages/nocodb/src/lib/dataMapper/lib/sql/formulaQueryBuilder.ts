import jsep from 'jsep';


// todo: switch function based on database

export default function formulaQueryBuilder(str, alias, knex) {
  const fn = (pt, a?, prevBinaryOp ?) => {
    const colAlias = a ? ` as ${a}` : '';
    if (pt.type === 'CallExpression') {
      switch (pt.callee.name) {
        case 'ADD':
        case 'SUM':
          if (pt.arguments.length > 1) {
            return fn({
              type: 'BinaryExpression',
              operator: '+',
              left: pt.arguments[0],
              right: {...pt, arguments: pt.arguments.slice(1)}
            }, a, prevBinaryOp)
          } else {
            return fn(pt.arguments[0], a, prevBinaryOp)
          }
          break;
        case 'AVG':
          if (pt.arguments.length > 1) {
            return fn({
              type: 'BinaryExpression',
              operator: '/',
              left: {...pt, callee: {name: 'SUM'}},
              right: {type: 'Literal', value: pt.arguments.length}
            }, a, prevBinaryOp)
          } else {
            return fn(pt.arguments[0], a, prevBinaryOp)
          }
          break;
        case 'concat':
        case 'CONCAT':
          if (knex.clientType() === 'sqlite3') {
            if (pt.arguments.length > 1) {
              return fn({
                type: 'BinaryExpression',
                operator: '||',
                left: pt.arguments[0],
                right: {...pt, arguments: pt.arguments.slice(1)}
              }, a, prevBinaryOp)
            } else {
              return fn(pt.arguments[0], a, prevBinaryOp)
            }
          }
          break;
      }

      return knex.raw(`${pt.callee.name}(${pt.arguments.map(arg => fn(arg).toQuery()).join()})${colAlias}`)
    } else if (pt.type === 'Literal') {
      return knex.raw(`?${colAlias}`, [pt.value]);
    } else if (pt.type === 'Identifier') {
      return knex.raw(`??${colAlias}`, [pt.name]);
    } else if (pt.type === 'BinaryExpression') {
      const query = knex.raw(`${fn(pt.left, null, pt.operator).toQuery()} ${pt.operator} ${fn(pt.right, null, pt.operator).toQuery()}${colAlias}`)
      if (prevBinaryOp && pt.operator !== prevBinaryOp) {
        query.wrap('(', ')')
      }
      return query;
    }
  };
  return fn(jsep(str), alias)
}



