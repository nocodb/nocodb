import { UITypes } from 'nocodb-sdk';
import { MetaTable } from '../utils/globals';
import { NcUpgraderCtx } from './NcUpgrader';

// The Count and AutoNumber types are removed
// so convert all existing Count and AutoNumber fields to Number type
export default async function (ctx: NcUpgraderCtx) {
  // directly update uidt of all existing Count and AutoNumber fields to Number
  await ctx.ncMeta.knex
    .update({ uidt: UITypes.Number })
    .where({ uidt: UITypes.Count })
    .orWhere({ uidt: UITypes.AutoNumber })
    .table(MetaTable.COLUMNS);
}
