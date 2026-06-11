import type { NcUpgraderCtx } from '~/version-upgrader/NcUpgrader';
import { MetaTable } from '~/utils/globals';

export default async function ({ ncMeta }: NcUpgraderCtx) {
  const actions = [];
  const hooks = await ncMeta.knexConnection(MetaTable.HOOKS);
  for (const hook of hooks) {
    actions.push(
      ncMeta.metaUpdate(
        hook.fk_workspace_id,
        hook.base_id,
        MetaTable.HOOKS,
        { version: 'v1' },
        hook.id,
      ),
    );
  }
  await Promise.all(actions);
}
