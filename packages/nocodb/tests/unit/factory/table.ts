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
    .send({ ...defaultValue, ...args });

  const table: Model = await Model.get(response.body.id);
  return table;
};

const getTable = async ({
  base,
  name,
}: {
  base: Base;
  name: string;
}) => {
  const sources = await base.getBases();
  return await Model.getByIdOrName({
    base_id: base.id,
    source_id: sources[0].id!,
    table_name: name,
  });
};

const getAllTables = async ({ base }: { base: Base }) => {
  const sources = await base.getBases();
  const tables = await Model.list({
    base_id: base.id,
    source_id: sources[0].id!,
  });

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

export { createTable, getTable, getAllTables, updateTable };
