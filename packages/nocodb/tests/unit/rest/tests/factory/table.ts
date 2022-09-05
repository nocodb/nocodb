import request from 'supertest';
import Model from '../../../../../src/lib/models/Model';
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

  const table = await Model.get(response.body.id);
  return table;
};

const getTable = async ({project, name}: {project, name: string}) => {
  return await Model.getByIdOrName({
    project_id: project.id,
    base_id: project.bases[0].id,
    table_name: name,
  });
}

export { createTable, getTable };
