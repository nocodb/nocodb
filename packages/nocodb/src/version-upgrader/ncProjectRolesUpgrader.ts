import { OrgUserRoles } from 'nocodb-sdk';
import { NC_APP_SETTINGS } from '../constants';
import type { NcUpgraderCtx } from './NcUpgrader';
import Store from '~/models/Store';
import { MetaTable, RootScopes } from '~/utils/globals';

/** Upgrader for upgrading roles */
export default async function ({ ncMeta }: NcUpgraderCtx) {
  const users = await ncMeta.metaList2(
    RootScopes.ROOT,
    RootScopes.ROOT,
    MetaTable.USERS,
  );

  for (const user of users) {
    user.roles = user.roles
      .split(',')
      .map((r) => {
        // update old role names with new roles
        if (r === 'user') {
          return OrgUserRoles.CREATOR;
        } else if (r === 'user-new') {
          return OrgUserRoles.VIEWER;
        }
        return r;
      })
      .join(',');
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      { roles: user.roles },
      user.id,
    );
  }

  // set invite only signup if user have environment variable set
  if (process.env.NC_INVITE_ONLY_SIGNUP) {
    await Store.saveOrUpdate(
      {
        value: '{ "invite_only_signup": true }',
        key: NC_APP_SETTINGS,
      },
      ncMeta,
    );
  }
}
