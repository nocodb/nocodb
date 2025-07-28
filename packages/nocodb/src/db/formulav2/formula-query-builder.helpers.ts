import type CustomKnex from '~/db/CustomKnex';

export interface IGetAggregateFn {
  (fnName: string): (args: { qb; knex?: CustomKnex; cn }) => any;
}

export const getAggregateFn: IGetAggregateFn = (parentFn) => {
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

    case 'ARRAY_AGG':
      return ({ qb, knex, cn }) =>
        qb.clear('select').select(knex.raw(`ARRAY_AGG(??)`, [cn]));

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
