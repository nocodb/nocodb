import axios from 'axios';
import Project from '../../../models/Project';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import Noco from '../../../Noco';
import User from '../../../models/User';
import NocoCache from '../../../cache/NocoCache';
import { CacheScope } from '../../../utils/globals';
import ProjectUser from '../../../models/ProjectUser';
import { Workspace } from '../../../models';
import resetPgSakilaProject from './resetPgSakilaProject';
import resetMysqlSakilaProject from './resetMysqlSakilaProject';
import resetMetaSakilaSqliteProject from './resetMetaSakilaSqliteProject';
import type { UserType } from 'nocodb-sdk';

const workerStatus = {};

const loginRootUser = async () => {
  const response = await axios.post(
    'http://localhost:8080/api/v1/auth/user/signin',
    { email: 'user@nocodb.com', password: 'Password123.' }
  );

  const user: UserType = (await User.getByEmail('user@nocodb.com')) as any;

  return { user, token: response.data.token };
};

const projectTitleByType = {
  sqlite: 'sampleREST',
  mysql: 'externalREST',
  pg: 'pgExtREST',
};

export class TestResetService {
  private readonly parallelId;
  // todo: Hack to resolve issue with pg resetting
  private readonly workerId;
  private readonly dbType;
  private readonly isEmptyProject: boolean;
  private readonly projectType: string;

  constructor({
    parallelId,
    dbType,
    isEmptyProject,
    workerId,
    projectType,
  }: {
    parallelId: string;
    dbType: string;
    isEmptyProject: boolean;
    workerId: string;
    projectType: string;
  }) {
    this.parallelId = parallelId;
    this.dbType = dbType;
    this.isEmptyProject = isEmptyProject;
    this.workerId = workerId;
    this.projectType = projectType;
  }

  async process() {
    try {
      // console.log(
      //   `earlier workerStatus: parrelledId: ${this.parallelId}:`,
      //   workerStatus[this.parallelId]
      // );

      // wait till previous worker is done
      while (workerStatus[this.parallelId] === 'processing') {
        console.log(
          `waiting for previous worker to finish parrelelId:${this.parallelId}`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      workerStatus[this.parallelId] = 'processing';

      const { token, user } = await loginRootUser();

      const { project, workspace } = await this.resetProject({
        user,
        token,
        dbType: this.dbType,
        parallelId: this.parallelId,
        workerId: this.workerId,
      });

      try {
        await removeAllProjectCreatedByTheTest(this.parallelId);
        await removeAllPrefixedUsersExceptSuper(this.parallelId);
      } catch (e) {
        console.log(`Error in cleaning up project: ${this.parallelId}`, e);
      }

      workerStatus[this.parallelId] = 'completed';
      return { token, project, user, workspace };
    } catch (e) {
      console.error('TestResetService:process', e);
      workerStatus[this.parallelId] = 'errored';
      return { error: e };
    }
  }

  async resetProject({
    user,
    token,
    dbType,
    parallelId,
    workerId,
  }: {
    user: UserType;
    token: string;
    dbType: string;
    parallelId: string;
    workerId: string;
  }) {
    const workspaceTitle = `ws_${projectTitleByType[dbType]}${parallelId}`;
    const workspace = await Workspace.getByTitle({ title: workspaceTitle });

    const title = `${projectTitleByType[dbType]}${parallelId}`;

    const projects = workspace
      ? await Project.listByWorkspaceAndUser(workspace?.id, user.id)
      : [];

    const oldProject = projects.find(
      (project) => project.title == title && project.type === 'database'
    );

    await Promise.all(
      projects.map(async (_project) => {
        const project = await Project.get(_project.id);
        await removeProjectUsersFromCache(project);

        const bases = await project.getBases();

        for (const base of bases) {
          await NcConnectionMgrv2.deleteAwait(base);
          await base.delete(Noco.ncMeta, { force: true });
        }

        await Project.delete(project.id);
      })
    );

    if (workspace) {
      await Workspace.delete(workspace.id);
    }

    if (dbType == 'sqlite') {
      await resetMetaSakilaSqliteProject({
        token,
        title,
        parallelId,
        isEmptyProject: this.isEmptyProject,
        projectType: this.projectType,
        workspaceTitle,
      });
    } else if (dbType == 'mysql') {
      await resetMysqlSakilaProject({
        token,
        title,
        parallelId,
        oldProject,
        isEmptyProject: this.isEmptyProject,
        projectType: this.projectType,
        workspaceTitle,
      });
    } else if (dbType == 'pg') {
      await resetPgSakilaProject({
        token,
        title,
        parallelId: workerId,
        oldProject,
        isEmptyProject: this.isEmptyProject,
        projectType: this.projectType,
        workspaceTitle,
      });
    }

    return {
      project: await Project.getByTitle(title),
      workspace: await Workspace.getByTitle({ title: workspaceTitle }),
    };
  }
}

const removeAllProjectCreatedByTheTest = async (parallelId: string) => {
  const projects = await Project.list({});

  for (const project of projects) {
    if (project.title.startsWith(`nc_test_${parallelId}_`)) {
      await Project.delete(project.id);
    }
  }
};

const removeAllPrefixedUsersExceptSuper = async (parallelId: string) => {
  const users = (await User.list()).filter(
    (user) => !user.roles.includes('super')
  );

  for (const user of users) {
    if (user.email.startsWith(`nc_test_${parallelId}_`)) {
      await NocoCache.del(`${CacheScope.USER}:${user.email}`);
      await User.delete(user.id);
    }
  }
};

// todo: Remove this once user deletion improvement PR is merged
const removeProjectUsersFromCache = async (project: Project) => {
  const projectUsers: ProjectUser[] = await ProjectUser.getUsersList({
    project_id: project.id,
    limit: 1000,
    offset: 0,
  });

  for (const projectUser of projectUsers) {
    try {
      const user: User = await User.get(projectUser.fk_user_id);
      await NocoCache.del(
        `${CacheScope.PROJECT_USER}:${project.id}:${user.id}`
      );
    } catch (e) {
      console.error('removeProjectUsersFromCache', e);
    }
  }
};
