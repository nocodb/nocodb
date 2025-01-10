import request from 'supertest';
import { Model } from '../../../src/models';
import { defaultColumns } from './column';
import type { Base } from '../../../src/models';

const defaultTableValue = (context) => ({
  table_name: 'Table1',
  title: 'Table1_Title',
  columns: defaultColumns(context),
});

const createTable = async (context, base, args = {}) => {
  const defaultValue = defaultTableValue(context);
  const response = await request(context.app)
    .post(`/api/v1/db/meta/projects/${base.id}/tables`)
    .set('xc-auth', context.token)
    .send({ ...defaultValue, ...args })
    .expect(200);

  const table: Model = await Model.get(
    {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    },
    response.body.id,
  );
  return table;
};

const getTableByAPI = async (context, base) => {
  const response = await request(context.app)
    .get(`/api/v1/db/meta/projects/${base.id}/tables`)
    .set('xc-auth', context.token);

  return response.body;
};

const getTableMeta = async (context, table) => {
  const response = await request(context.app)
    .get(`/api/v1/db/meta/tables/${table.id}`)
    .set('xc-auth', context.token)
    .expect(200);

  return response.body;
}

const getColumnsByAPI = async (context, base, table) => {
  const response = await request(context.app)
    .get(`/api/v2/meta/tables/${table.id}`)
    .set('xc-auth', context.token);

  return response.body;
};

const getTable = async ({ base, name }: { base: Base; name: string }) => {
  const sources = await base.getSources();
  return await Model.getByIdOrName(
    {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    },
    {
      base_id: base.id,
      source_id: sources[0].id!,
      table_name: name,
    },
  );
};

const getAllTables = async ({ base }: { base: Base }) => {
  const sources = await base.getSources();
  const tables = await Model.list(
    {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    },
    {
      base_id: base.id,
      source_id: sources[0].id!,
    },
  );

  return tables;
};

const updateTable = async (
  context,
  { table, args }: { table: Model; args: any },
) => {
  const response = await request(context.app)
    .patch(`/api/v1/db/meta/tables/${table.id}`)
    .set('xc-auth', context.token)
    .send(args);

  return response.body;
};

export {
  createTable,
  getTable,
  getTableMeta,
  getAllTables,
  updateTable,
  getTableByAPI,
  getColumnsByAPI,
};
