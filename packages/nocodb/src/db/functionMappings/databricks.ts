import commonFns from './commonFns';
import type { MapFnArgs } from '../mapFunctionName';

const databricks = {
  ...commonFns,
  AND: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `CASE WHEN ${args.knex
          .raw(
            `${(
              await Promise.all(
                args.pt.arguments.map(async (ar) =>
                  (await args.fn(ar, '', 'AND')).builder.toQuery(),
                ),
              )
            ).join(' AND ')}`,
          )
          .wrap('(', ')')
          .toQuery()} THEN TRUE ELSE FALSE END`,
      ),
    };
  },
  OR: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `CASE WHEN ${args.knex
          .raw(
            `${(
              await Promise.all(
                args.pt.arguments.map(async (ar) =>
                  (await args.fn(ar, '', 'OR')).builder.toQuery(),
                ),
              )
            ).join(' OR ')}`,
          )
          .wrap('(', ')')
          .toQuery()} THEN TRUE ELSE FALSE END`,
      ),
    };
  },
  CHECKSUM_MD5: async ({ fn, knex, pt }: MapFnArgs) => {
    const value = (await fn(pt.arguments[0])).builder;
    return {
      builder: knex.raw(`CASE WHEN ? IS NULL THEN NULL ELSE MD5(CAST(? AS STRING)) END`, [
        value,
        value,
      ]),
    };
  },
  CHECKSUM_SHA1: async ({ fn, knex, pt }: MapFnArgs) => {
    const value = (await fn(pt.arguments[0])).builder;
    return {
      builder: knex.raw(
        `CASE WHEN ? IS NULL THEN NULL ELSE SHA1(CAST(? AS STRING)) END`,
        [value, value],
      ),
    };
  },
  CHECKSUM_SHA256: async ({ fn, knex, pt }: MapFnArgs) => {
    const value = (await fn(pt.arguments[0])).builder;
    return {
      builder: knex.raw(
        `CASE WHEN ? IS NULL THEN NULL ELSE SHA2(CAST(? AS STRING), 256) END`,
        [value, value],
      ),
    };
  },
};

export default databricks;
