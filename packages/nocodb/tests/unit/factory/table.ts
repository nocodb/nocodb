import request from 'supertest';
import Model from '../../../src/lib/models/Model';
import Project from '../../../src/lib/models/Project';
import { defaultColumns } from './column';

const defaultTableValue = (context) => ({
  table_name: 'Table1',
  title: 'Table1_Title',
  columns: defaultColumns(context),
});

const createTable = async (context, project, args = {}) => {
  const defaultValue = defaultTableValue(context);
  const response = await request(context.app)
    .post(`/api/v1/db/meta/projects/${project.id}/tables`)
    .set('xc-auth', context.token)
    .send({ ...defaultValue, ...args });

  const table: Model = await Model.get(response.body.id);
  return table;
};

const getTable = async ({project, name}: {project: Project, name: string}) => {
  const bases = await project.getBases();
  return await Model.getByIdOrName({
    project_id: project.id,
    base_id: bases[0].id!,
    table_name: name,
  });
}

const getAllTables = async ({project}: {project: Project}) => {
  const bases = await project.getBases();
  const tables = await Model.list({
    project_id: project.id,
    base_id: bases[0].id!,
  });

  return tables;
}

export { createTable, getTable, getAllTables };
