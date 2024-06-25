import request from 'supertest';
import Base from '~/models/Base';

interface ProjectArgs {
  fk_workspace_id?: string;
  title?: string;
  type?: string;
}

const sakilaProjectConfig = (context, additionalConfig = {}) => {
  let source;

  if (
    context.sakilaDbConfig.client === 'mysql2' ||
    context.sakilaDbConfig.client === 'pg'
  ) {
    source = {
      type: context.sakilaDbConfig.client,
      config: {
        client: context.sakilaDbConfig.client,
        connection: context.sakilaDbConfig.connection,
      },
    };
  } else {
    source = {
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

  source = {
    ...source,
    inflection_column: 'camelize',
    inflection_table: 'camelize',
    ...additionalConfig,
  };

  return {
    title: 'sakila',
    sources: [source],
    external: true,
    ...(process.env.EE ? { fk_workspace_id: context.fk_workspace_id } : {}),
  };
};

const defaultProjectValue = {
  title: 'Title',
};

const defaultSharedBaseValue = {
  roles: 'viewer',
  password: 'password123',
};

const createSharedBase = async (app, token, base, sharedBaseArgs = {}) => {
  await request(app)
    .post(`/api/v1/db/meta/projects/${base.id}/shared`)
    .set('xc-auth', token)
    .send({
      ...defaultSharedBaseValue,
      ...sharedBaseArgs,
    });
};

const createSakilaProject = async (context, additionalConfig = {}) => {
  const response = await request(context.app)
    .post('/api/v1/db/meta/projects/')
    .set('xc-auth', context.token)
    .send(sakilaProjectConfig(context, additionalConfig));

  return (await Base.getByTitleOrId(
    {
      workspace_id: response.body.fk_workspace_id,
      base_id: response.body.id,
    },
    response.body.id,
  )) as Base;
};

const createProject = async (
  context,
  baseArgs: ProjectArgs = defaultProjectValue,
) => {
  const response = await request(context.app)
    .post('/api/v1/db/meta/projects/')
    .set('xc-auth', context.token)
    .send({
      ...baseArgs,
      ...(process.env.EE ? { fk_workspace_id: context.fk_workspace_id } : {}),
    });

  return (await Base.getByTitleOrId(
    {
      workspace_id: response.body.fk_workspace_id,
      base_id: response.body.id,
    },
    response.body.id,
  )) as Base;
};

export { createProject, createSharedBase, createSakilaProject };
