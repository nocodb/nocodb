import request from 'supertest';
import { defaultColumns } from './column';

const defaultTableValue = {
  table_name: 'Table1',
  title: 'Table1_Title',
  columns: defaultColumns,
};

const createTable = async (context, project, args = {}) => {
  const response = await request(context.app)
    .post(`/api/v1/db/meta/projects/${project.id}/tables`)
    .set('xc-auth', context.token)
    .send({ ...defaultTableValue, ...args });

  const table = response.body;
  return table;
};

export { createTable };
