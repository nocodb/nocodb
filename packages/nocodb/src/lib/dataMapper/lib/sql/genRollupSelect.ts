import Knex from "knex";

export default function ({knex, rollup,}: { knex: Knex, rollup: any }) {
  switch (rollup.type) {
    case 'hm':

      return knex(rollup.rltn)
        [rollup.fn]?.(knex.ref(`${rollup.rltn}.${rollup.rlcn}`))
        .where(
          knex.ref(`${rollup.tn}.${rollup.cn}`), '=', knex.ref(`${rollup.rtn}.${rollup.rcn}`)
        )
      break;
    case 'mm':

      return knex(rollup.rltn)
        [rollup.fn]?.(knex.ref(`${rollup.rltn}.${rollup.rlcn}`))
        .innerJoin(rollup.vtn,  knex.ref(`${rollup.vtn}.${rollup.vrcn}`), '=', knex.ref(`${rollup.rtn}.${rollup.rcn}`))
        .where(knex.ref(`${rollup.vtn}.${rollup.vcn}`), '=', knex.ref(`${rollup.tn}.${rollup.cn}`))


    default:
      throw Error(`Unsupported relation type '${rollup.type}'`)
  }
}

