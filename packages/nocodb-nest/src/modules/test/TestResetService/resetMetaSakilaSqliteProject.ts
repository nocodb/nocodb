import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';

const sqliteFilePath = (parallelId: string) => {
  const rootDir = process.cwd();

  return `${rootDir}/test_sakila_${parallelId}.db`;
};

const sakilaProjectConfig = (title: string, parallelId: string) => ({
  title,
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
}: {
  parallelId: string;
  token: string;
  title: string;
  isEmptyProject: boolean;
}) => {
  await deleteSqliteFileIfExists(parallelId);

  if (!isEmptyProject) await seedSakilaSqliteFile(parallelId);

  await createProject(token, title, parallelId);
};

const createProject = async (
  token: string,
  title: string,
  parallelId: string,
) => {
  const response = await axios.post(
    'http://localhost:8080/api/v1/db/meta/projects/',
    sakilaProjectConfig(title, parallelId),
    {
      headers: {
        'xc-auth': token,
      },
    },
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
  const testsDir = path.join(process.cwd(), 'tests');

  await fs.copyFile(
    `${testsDir}/sqlite-sakila-db/sakila.db`,
    sqliteFilePath(parallelId),
  );
};

export default resetMetaSakilaSqliteProject;
