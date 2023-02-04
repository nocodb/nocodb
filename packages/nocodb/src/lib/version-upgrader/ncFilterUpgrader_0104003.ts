import { NcUpgraderCtx } from './NcUpgrader';
import { MetaTable } from '../utils/globals';

// as of 0.104.3, almost all filter operators are available to all column types
// while some of them aren't supposed to be shown
// this upgrader is to remove those unsupported filters / migrate to the correct filter
export default async function ({ ncMeta }: NcUpgraderCtx) {
  const filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP);
  for (const filter of filters) {
    console.log(filter);
    // TODO:
  }
}
