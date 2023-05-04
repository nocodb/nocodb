import { MetaTable } from '../utils/globals';
import type { NcUpgraderCtx } from './NcUpgrader';

export default async function ({ ncMeta }: NcUpgraderCtx) {
  const actions = [];
  const hooks = await ncMeta.metaList2(null, null, MetaTable.HOOKS);
  for (const hook of hooks) {
    actions.push(
      ncMeta.metaUpdate(null, null, MetaTable.HOOKS, { version: 'v1' }, hook.id)
    );
  }
  await Promise.all(actions);
}
