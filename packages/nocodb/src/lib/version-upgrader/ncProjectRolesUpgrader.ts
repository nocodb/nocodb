import { MetaTable } from '../utils/globals';
import { NcUpgraderCtx } from './NcUpgrader';

/** Upgrader for upgrading roles */
export default async function ({ ncMeta }: NcUpgraderCtx) {
  const users = await ncMeta.metaList2(null, null, MetaTable.USERS);

  for (const user of users) {
    user.roles = user.roles
      .split(',')
      .map((r) => {
        if (r === 'user') {
          return 'org-level-creator';
        } else if (r === 'user-new') {
          return 'org-level-viewer';
        }
        return r;
      })
      .join(',');
    await ncMeta.metaUpdate(null, null, MetaTable.USERS, user, {
      roles: user.roles,
    });
  }
}
