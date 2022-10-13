import Noco from '../../../Noco';

import Knex from 'knex';
import axios from 'axios';
import Project from '../../../models/Project';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import resetMetaSakilaSqliteProject from './resetMetaSakilaSqliteProject';
import resetMysqlSakilaProject from './resetMysqlSakilaProject';
import Model from '../../../models/Model';

const loginRootUser = async () => {
  const response = await axios.post(
    'http://localhost:8080/api/v1/auth/user/signin',
    { email: 'user@nocodb.com', password: 'Password123.' }
  );

  return response.data.token;
};

const projectTitleByType = {
  sqlite: 'sampleREST',
  mysql: 'externalREST',
};

export class TestResetService {
  private knex: Knex | null = null;
  private readonly parallelId;
  private readonly dbType;

  constructor({ parallelId, dbType }: { parallelId: string; dbType: string }) {
    this.knex = Noco.ncMeta.knex;
    this.parallelId = parallelId;
    this.dbType = dbType;
  }

  async process() {
    try {
      const token = await loginRootUser();

      const { project } = await this.resetProject({
        metaKnex: this.knex,
        token,
        dbType: this.dbType,
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
    dbType,
    parallelId,
  }: {
    metaKnex: Knex;
    token: string;
    dbType: string;
    parallelId: string;
  }) {
    const title = `${projectTitleByType[dbType]}${parallelId}`;
    const project: Project | undefined = await Project.getByTitle(title);

    if (project) {
      const bases = await project.getBases();
      if (dbType == 'sqlite') await dropTablesOfProject(metaKnex, project);
      await Project.delete(project.id);

      if (bases.length > 0) await NcConnectionMgrv2.deleteAwait(bases[0]);
    }

    if (dbType == 'sqlite') {
      await resetMetaSakilaSqliteProject({ token, metaKnex, title });
    } else if (dbType == 'mysql') {
      await resetMysqlSakilaProject({
        token,
        title,
        parallelId,
        oldProject: project,
      });
    }

    return {
      project: await Project.getByTitle(title),
    };
  }
}

const dropTablesOfProject = async (knex: Knex, project: Project) => {
  const tables = await Model.list({
    project_id: project.id,
    base_id: (await project.getBases())[0].id,
  });

  for (const table of tables) {
    if (table.type == 'table') {
      await knex.raw(`DROP TABLE IF EXISTS ${table.table_name}`);
    } else {
      await knex.raw(`DROP VIEW IF EXISTS ${table.table_name}`);
    }
  }
};
