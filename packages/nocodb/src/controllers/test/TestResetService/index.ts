import axios from 'axios';
import resetPgSakilaProject from './resetPgSakilaProject';
import resetMysqlSakilaProject from './resetMysqlSakilaProject';
import resetMetaSakilaSqliteProject from './resetMetaSakilaSqliteProject';
import type ApiToken from '~/models/ApiToken';
import Project from '~/models/Project';
// import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import Noco from '~/Noco';
import User from '~/models/User';
import NocoCache from '~/cache/NocoCache';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';
import ProjectUser from '~/models/ProjectUser';

const workerStatus = {};

const loginRootUser = async () => {
  const response = await axios.post(
    'http://localhost:8080/api/v1/auth/user/signin',
    { email: 'user@nocodb.com', password: 'Password123.' },
  );

  return response.data.token;
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

  constructor({
    parallelId,
    dbType,
    isEmptyProject,
    workerId,
  }: {
    parallelId: string;
    dbType: string;
    isEmptyProject: boolean;
    workerId: string;
  }) {
    this.parallelId = parallelId;
    this.dbType = dbType;
    this.isEmptyProject = isEmptyProject;
    this.workerId = workerId;
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
          `waiting for previous worker to finish parrelelId:${this.parallelId}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      workerStatus[this.parallelId] = 'processing';

      const token = await loginRootUser();

      const { project } = await this.resetProject({
        token,
        dbType: this.dbType,
        parallelId: this.parallelId,
        workerId: this.workerId,
      });

      try {
        await removeAllProjectCreatedByTheTest(this.parallelId);
        await removeAllPrefixedUsersExceptSuper(this.parallelId);
        await removeAllTokensCreatedByTheTest(this.parallelId);
      } catch (e) {
        console.log(`Error in cleaning up project: ${this.parallelId}`, e);
      }

      workerStatus[this.parallelId] = 'completed';
      return { token, project };
    } catch (e) {
      console.error('TestResetService:process', e);
      workerStatus[this.parallelId] = 'errored';
      return { error: e };
    }
  }

  async resetProject({
    token,
    dbType,
    parallelId,
    workerId,
  }: {
    token: string;
    dbType: string;
    parallelId: string;
    workerId: string;
  }) {
    const title = `${projectTitleByType[dbType]}${parallelId}`;
    const project: Project | undefined = await Project.getByTitle(title);

    if (project) {
      await this.removeProjectUsersFromCache(project);

      // Kludge: Soft reset to support PG as root DB in PW tests
      // Revisit to fix this later

      // const bases = await project.getBases();
      //
      // for (const base of bases) {
      //   await NcConnectionMgrv2.deleteAwait(base);
      //   await base.delete(Noco.ncMeta, { force: true });
      // }
      //
      // await Project.delete(project.id);

      await Project.softDelete(project.id);
    }

    if (dbType == 'sqlite') {
      await resetMetaSakilaSqliteProject({
        token,
        title,
        parallelId,
        isEmptyProject: this.isEmptyProject,
      });
    } else if (dbType == 'mysql') {
      await resetMysqlSakilaProject({
        token,
        title,
        parallelId,
        oldProject: project,
        isEmptyProject: this.isEmptyProject,
      });
    } else if (dbType == 'pg') {
      await resetPgSakilaProject({
        token,
        title,
        parallelId: workerId,
        oldProject: project,
        isEmptyProject: this.isEmptyProject,
      });
    }

    return {
      project: await Project.getByTitle(title),
    };
  }

  // todo: Remove this once user deletion improvement PR is merged
  removeProjectUsersFromCache = async (project: Project) => {
    const projectUsers = await ProjectUser.getUsersList({
      project_id: project.id,
      limit: 1000,
      offset: 0,
    });

    for (const projectUser of projectUsers) {
      try {
        const user: User = (await User.get(projectUser.id)) as any;
        await NocoCache.del(
          `${CacheScope.PROJECT_USER}:${project.id}:${user.id}`,
        );
      } catch (e) {
        console.error('removeProjectUsersFromCache', e);
      }
    }
  };
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
    (user) => !user.roles.includes('super'),
  );

  for (const user of users) {
    if (user.email.startsWith(`nc_test_${parallelId}_`)) {
      await NocoCache.del(`${CacheScope.USER}:${user.email}`);
      await User.delete(user.id);
    }
  }
};

const removeAllTokensCreatedByTheTest = async (parallelId: string) => {
  const tokens: ApiToken[] = await Noco.ncMeta.metaList(
    null,
    null,
    MetaTable.API_TOKENS,
  );

  for (const token of tokens) {
    if (token.description.startsWith(`nc_test_${parallelId}`)) {
      await NocoCache.deepDel(
        CacheScope.API_TOKEN,
        `${CacheScope.API_TOKEN}:${token.token}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );

      await Noco.ncMeta.metaDelete(null, null, MetaTable.API_TOKENS, {
        token: token.token,
      });
    }
  }
};
