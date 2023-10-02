import axios from 'axios';
import resetPgSakilaProject from './resetPgSakilaProject';
import resetMysqlSakilaProject from './resetMysqlSakilaProject';
import resetMetaSakilaSqliteProject from './resetMetaSakilaSqliteProject';
import type ApiToken from '~/models/ApiToken';
import Base from '~/models/Base';
// import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import Noco from '~/Noco';
import User from '~/models/User';
import NocoCache from '~/cache/NocoCache';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';
import BaseUser from '~/models/BaseUser';

const workerStatus = {};

const loginRootUser = async () => {
  const response = await axios.post(
    'http://localhost:8080/api/v1/auth/user/signin',
    { email: 'user@nocodb.com', password: 'Password123.' },
  );

  return response.data.token;
};

const baseTitleByType = {
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

      const { base } = await this.resetProject({
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
        console.log(`Error in cleaning up base: ${this.parallelId}`, e);
      }

      workerStatus[this.parallelId] = 'completed';
      return { token, base };
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
    const title = `${baseTitleByType[dbType]}${parallelId}`;
    const base: Base | undefined = await Base.getByTitle(title);

    if (base) {
      await this.removeProjectUsersFromCache(base);

      // Kludge: Soft reset to support PG as root DB in PW tests
      // Revisit to fix this later

      // const sources = await base.getBases();
      //
      // for (const base of sources) {
      //   await NcConnectionMgrv2.deleteAwait(base);
      //   await base.delete(Noco.ncMeta, { force: true });
      // }
      //
      // await Base.delete(base.id);

      await Base.softDelete(base.id);
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
        oldProject: base,
        isEmptyProject: this.isEmptyProject,
      });
    } else if (dbType == 'pg') {
      await resetPgSakilaProject({
        token,
        title,
        parallelId: workerId,
        oldProject: base,
        isEmptyProject: this.isEmptyProject,
      });
    }

    return {
      base: await Base.getByTitle(title),
    };
  }

  // todo: Remove this once user deletion improvement PR is merged
  removeProjectUsersFromCache = async (base: Base) => {
    const baseUsers = await BaseUser.getUsersList({
      base_id: base.id,
      limit: 1000,
      offset: 0,
    });

    for (const baseUser of baseUsers) {
      try {
        const user: User = (await User.get(baseUser.id)) as any;
        await NocoCache.del(`${CacheScope.PROJECT_USER}:${base.id}:${user.id}`);
      } catch (e) {
        console.error('removeProjectUsersFromCache', e);
      }
    }
  };
}

const removeAllProjectCreatedByTheTest = async (parallelId: string) => {
  const bases = await Base.list({});

  for (const base of bases) {
    if (base.title.startsWith(`nc_test_${parallelId}_`)) {
      await Base.delete(base.id);
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
