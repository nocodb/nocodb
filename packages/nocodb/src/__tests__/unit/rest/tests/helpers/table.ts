import request from 'supertest';
import { defaultColumns } from './column';

const defaultTableValue = {
  table_name: 'Table1',
  title: 'Table1 Title',
  columns: defaultColumns,
};

const createTable = async (app, token, project, args = {}) => {
  const response = await request(app)
    .post(`/api/v1/db/meta/projects/${project.id}/tables`)
    .set('xc-auth', token)
    .send({ ...defaultTableValue, ...args });

  const table = response.body;
  return table;
};

export { createTable };
