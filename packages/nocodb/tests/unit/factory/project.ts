import request from 'supertest';
import Project from '../../../src/lib/models/Project';

const sakilaProjectConfig = (context) => {
  let base;

  if(context.sakilaDbConfig.client === 'mysql2'){
    base = {
      type: context.sakilaDbConfig.client,
      config: {
        client: context.sakilaDbConfig.client,
        connection: context.sakilaDbConfig.connection
      }
    };
  } else {
    base = {
      type: context.sakilaDbConfig.client,
      config: {
        client: context.sakilaDbConfig.client,
        connection: {
          client: context.sakilaDbConfig.client,
          connection: context.sakilaDbConfig.connection,
        },
      },
    };
  }

  base = {
    ...base, 
    inflection_column: 'camelize',
    inflection_table: 'camelize',
  };

  return {
    title: 'sakila',
    bases: [base],
    external: true,
  }
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

const createSakilaProject = async (context) => {
  const response = await request(context.app)
    .post('/api/v1/db/meta/projects/')
    .set('xc-auth', context.token)
    .send(sakilaProjectConfig(context));

  return (await Project.getByTitleOrId(response.body.id)) as Project;
};

const createProject = async (context, projectArgs = defaultProjectValue) => {
  const response = await request(context.app)
    .post('/api/v1/db/meta/projects/')
    .set('xc-auth', context.token)
    .send(projectArgs);

  return (await Project.getByTitleOrId(response.body.id)) as Project;
};

export { createProject, createSharedBase, createSakilaProject };
