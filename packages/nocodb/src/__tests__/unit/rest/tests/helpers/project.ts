import request from 'supertest';
import { sakilaDbName } from '../../dbConfig';

const externalProjectConfig = {
  title: 'sakila',
  bases: [
    {
      type: 'mysql2',
      config: {
        client: 'mysql2',
        connection: {
          host: 'localhost',
          port: '3306',
          user: 'root',
          password: 'password',
          database: sakilaDbName,
        },
      },
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    },
  ],
  external: true,
};

const defaultProjectValue = {
  title: 'Title',
};

const defaultSharedBaseValue = {
  roles: 'viewer',
  password: 'test',
};

const createSharedBase = async (app, token, project, sharedBaseArgs = {}) => {
  await request(app)
    .post(`/api/v1/db/meta/projects/${project.id}/shared`)
    .set('xc-auth', token)
    .send({
      ...defaultSharedBaseValue,
      ...sharedBaseArgs,
    });
};

const createExternalProject = async (app, token) => {
  const response = await request(app)
    .post('/api/v1/db/meta/projects/')
    .set('xc-auth', token)
    .send(externalProjectConfig);

  const project = response.body;
  return project;
};

const createProject = async (app, token, projectArgs = defaultProjectValue) => {
  const response = await request(app)
    .post('/api/v1/db/meta/projects/')
    .set('xc-auth', token)
    .send(projectArgs);

  const project = response.body;
  return project;
};

export { createProject, createSharedBase, createExternalProject };
