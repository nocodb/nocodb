import { promises as fs } from 'fs';
import axios from 'axios';
import { Workspace } from '../../../models';

const sqliteFilePath = (parallelId: string) => {
  const rootDir = __dirname.replace(
    '/src/lib/services/test/TestResetService',
    ''
  );

  return `${rootDir}/test_sakila_${parallelId}.db`;
};

const sakilaProjectConfig = (
  workspaceId: string,
  title: string,
  parallelId: string,
  projectType: string
) => ({
  title,
  fk_workspace_id: workspaceId,
  type: projectType,
  bases: [
    {
      type: 'sqlite3',
      config: {
        client: 'sqlite3',
        connection: {
          client: 'sqlite3',
          connection: {
            filename: sqliteFilePath(parallelId),
            database: 'test_sakila',
            multipleStatements: true,
          },
        },
      },
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    },
  ],
  external: true,
});

const resetMetaSakilaSqliteProject = async ({
  parallelId,
  token,
  title,
  isEmptyProject,
  projectType,
  workspaceTitle,
}: {
  parallelId: string;
  token: string;
  title: string;
  isEmptyProject: boolean;
  projectType: string;
  workspaceTitle: string;
}) => {
  await deleteSqliteFileIfExists(parallelId);

  if (!isEmptyProject) await seedSakilaSqliteFile(parallelId);

  // const ws = await Workspace.insert({
  //   title: workspaceTitle,
  // });
  const ws: Workspace = await createWorkspace(workspaceTitle ,token)

  await createProject(ws.id, token, title, parallelId, projectType);
};

const createWorkspace = async (
  workspaceId: string,
  token: string
) => {
  const response = await axios.post(
    'http://localhost:8080/api/v1/workspaces',
    {"title": workspaceId ,"meta":{"color":"#146C8E"}},
    {
      headers: {
        'xc-auth': token,
      },
    }
  );
  if (response.status !== 200) {
    console.error('Error creating workspace', response.data);
  }
  return response.data;
};

const createProject = async (
  workspaceId: string,
  token: string,
  title: string,
  parallelId: string,
  projectType: string
) => {
  const response = await axios.post(
    'http://localhost:8080/api/v1/db/meta/projects/',
    sakilaProjectConfig(workspaceId, title, parallelId, projectType),
    {
      headers: {
        'xc-auth': token,
      },
    }
  );
  if (response.status !== 200) {
    console.error('Error creating project', response.data);
  }
  return response.data;
};

const deleteSqliteFileIfExists = async (parallelId: string) => {
  if (await fs.stat(sqliteFilePath(parallelId)).catch(() => null)) {
    await fs.unlink(sqliteFilePath(parallelId));
  }
};

const seedSakilaSqliteFile = async (parallelId: string) => {
  const testsDir = __dirname.replace(
    '/src/lib/services/test/TestResetService',
    '/tests'
  );

  await fs.copyFile(
    `${testsDir}/sqlite-sakila-db/sakila.db`,
    sqliteFilePath(parallelId)
  );
};

export default resetMetaSakilaSqliteProject;
