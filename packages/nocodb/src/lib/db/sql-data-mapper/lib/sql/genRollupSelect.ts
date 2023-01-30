import { Knex } from 'knex';
import { RelationTypes } from 'nocodb-sdk';

export default function ({
  knex,
  rollup: _rollup,
  hasMany,
  manyToMany,
}: {
  tn: string;
  knex: Knex;
  rollup: any;
  hasMany: any[];
  manyToMany: any[];
}) {
  let rollup = _rollup;

  switch (rollup.type) {
    case RelationTypes.HAS_MANY:
      if (!rollup.tn || !rollup.rtn) {
        rollup = { ...rollup, ...hasMany.find((hm) => hm.tn === rollup.rltn) };
      }
      return knex(rollup.rltn)
        [rollup.fn]?.(knex.ref(`${rollup.rltn}.${rollup.rlcn}`))
        .where(
          knex.ref(`${rollup.tn}.${rollup.cn}`),
          '=',
          knex.ref(`${rollup.rtn}.${rollup.rcn}`)
        );
      break;
    case RelationTypes.MANY_TO_MANY:
      if (!rollup.tn || !rollup.rtn || !rollup.vtn) {
        rollup = {
          ...rollup,
          ...manyToMany.find((mm) => mm.rtn === rollup.rltn),
        };
      }
      return knex(rollup.rltn)
        [rollup.fn]?.(knex.ref(`${rollup.rltn}.${rollup.rlcn}`))
        .innerJoin(
          rollup.vtn,
          knex.ref(`${rollup.vtn}.${rollup.vrcn}`),
          '=',
          knex.ref(`${rollup.rtn}.${rollup.rcn}`)
        )
        .where(
          knex.ref(`${rollup.vtn}.${rollup.vcn}`),
          '=',
          knex.ref(`${rollup.tn}.${rollup.cn}`)
        );

    default:
      throw Error(`Unsupported relation type '${rollup.type}'`);
  }
}
