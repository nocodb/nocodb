import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import type { AxiosResponse } from 'axios';

const sqliteFilePath = (parallelId: string) => {
  const rootDir = process.cwd();

  return `${rootDir}/test_sakila_${parallelId}.db`;
};

const sakilaProjectConfig = (title: string, parallelId: string) => ({
  title,
  sources: [
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
}: {
  parallelId: string;
  token: string;
  title: string;
  isEmptyProject: boolean;
}) => {
  await deleteSqliteFileIfExists(parallelId);

  if (!isEmptyProject) await seedSakilaSqliteFile(parallelId);

  await createProject(token, title, parallelId, isEmptyProject);
};

const createProject = async (
  token: string,
  title: string,
  parallelId: string,
  isEmptyProject: boolean,
) => {
  let response: AxiosResponse;
  if (isEmptyProject) {
    response = await axios.post(
      'http://localhost:8080/api/v1/meta/bases/',
      { title },
      {
        headers: {
          'xc-auth': token,
        },
      },
    );
  } else {
    response = await axios.post(
      'http://localhost:8080/api/v1/meta/bases/',
      sakilaProjectConfig(title, parallelId),
      {
        headers: {
          'xc-auth': token,
        },
      },
    );
  }
  if (response.status !== 200) {
    console.error('Error creating base', response.data);
  }
  return response.data;
};

const deleteSqliteFileIfExists = async (parallelId: string) => {
  if (await fs.stat(sqliteFilePath(parallelId)).catch(() => null)) {
    await fs.unlink(sqliteFilePath(parallelId));
  }
};

const seedSakilaSqliteFile = async (parallelId: string) => {
  const testsDir = path.join(process.cwd(), 'tests');

  await fs.copyFile(
    `${testsDir}/sqlite-sakila-db/sakila.db`,
    sqliteFilePath(parallelId),
  );
};

export default resetMetaSakilaSqliteProject;
