import Noco from '../../../Noco';

import Knex from 'knex';
import axios from 'axios';
import Project from '../../../models/Project';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import resetMetaSakilaSqliteProject from './resetMetaSakilaSqliteProject';
import resetMysqlSakilaProject from './resetMysqlSakilaProject';

const loginRootUser = async () => {
  const response = await axios.post(
    'http://localhost:8080/api/v1/auth/user/signin',
    { email: 'user@nocodb.com', password: 'Password123.' }
  );

  return response.data.token;
};

const projectTitleByType = {
  sqlite3: 'sampleREST',
  mysql: 'externalREST',
};

export class TestResetService {
  private knex: Knex | null = null;
  private readonly parallelId;
  constructor({ parallelId }: { parallelId: string }) {
    this.knex = Noco.ncMeta.knex;
    this.parallelId = parallelId;
  }

  async process() {
    try {
      const token = await loginRootUser();

      const { project } = await this.resetProject({
        metaKnex: this.knex,
        token,
        type: 'mysql',
        parallelId: this.parallelId,
      });

      return { token, project };
    } catch (e) {
      console.error('TestResetService:process', e);
      return { error: e };
    }
  }

  async resetProject({
    metaKnex,
    token,
    type,
    parallelId,
  }: {
    metaKnex: Knex;
    token: string;
    type: string;
    parallelId: string;
  }) {
    const title = `${projectTitleByType[type]}${parallelId}`;
    const project: Project | undefined = await Project.getByTitle(title);

    if (project) {
      const bases = await project.getBases();
      await Project.delete(project.id);

      if (bases.length > 0) await NcConnectionMgrv2.deleteAwait(bases[0]);
    }

    if (type == 'sqlite3') {
      await resetMetaSakilaSqliteProject({ token, metaKnex, title });
    } else if (type == 'mysql') {
      await resetMysqlSakilaProject({ token, title, parallelId, oldProject: project });
    }

    return {
      project: await Project.getByTitle(title),
    };
  }
}
