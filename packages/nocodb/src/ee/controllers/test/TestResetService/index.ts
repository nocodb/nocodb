import { TestResetService as TestResetServiceCE } from 'src/controllers/test/TestResetService';

import type Project from '~/models/Project';
import User from '~/models/User';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import ProjectUser from '~/models/ProjectUser';

export class TestResetService extends TestResetServiceCE {
  removeProjectUsersFromCache = async (project: Project) => {
    const projectUsers: ProjectUser[] = await ProjectUser.getUsersList({
      project_id: project.id,
      limit: 1000,
      workspace_id: project.fk_workspace_id,
      offset: 0,
    });

    for (const projectUser of projectUsers) {
      try {
        const user: User = (await User.get(projectUser.fk_user_id)) as any;
        await NocoCache.del(
          `${CacheScope.PROJECT_USER}:${project.id}:${user.id}`,
        );
      } catch (e) {
        console.error('removeProjectUsersFromCache', e);
      }
    }
  };
}
