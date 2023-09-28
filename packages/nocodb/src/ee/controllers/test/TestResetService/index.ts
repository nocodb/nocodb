import { TestResetService as TestResetServiceCE } from 'src/controllers/test/TestResetService';

import type Base from '~/models/Base';
import User from '~/models/User';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import BaseUser from '~/models/BaseUser';

export class TestResetService extends TestResetServiceCE {
  removeProjectUsersFromCache = async (base: Base) => {
    const baseUsers = await BaseUser.getUsersList({
      base_id: base.id,
      limit: 1000,
      workspace_id: base.fk_workspace_id,
      offset: 0,
    });

    for (const baseUser of baseUsers) {
      try {
        const user: User = (await User.get(baseUser.fk_user_id)) as any;
        await NocoCache.del(`${CacheScope.PROJECT_USER}:${base.id}:${user.id}`);
      } catch (e) {
        console.error('removeProjectUsersFromCache', e);
      }
    }
  };
}
