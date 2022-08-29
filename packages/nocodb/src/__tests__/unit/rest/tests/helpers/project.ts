import request from 'supertest';

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

const createProject = async (app, token, projectArgs = defaultProjectValue) => {
  const response = await request(app)
    .post('/api/v1/db/meta/projects/')
    .set('xc-auth', token)
    .send(projectArgs);

  const project = response.body;
  return project;
};

export { createProject, createSharedBase };
