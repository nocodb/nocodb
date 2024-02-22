import request from 'supertest';
import type View from '../../../src/models/View';
import { APIContext } from 'nocodb-sdk'

const updateViewColumns = async (
  context,
  {
    view,
    viewColumns,
  }: {
    view: View;
    viewColumns: Record<string, any>[] | Record<string, Record<string, any>[]>;
  },
) => {
  // generate key-value pair of column id and column
  const fields = Array.isArray(viewColumns)
    ? viewColumns.reduce((acc, column) => {
        acc[column.fk_column_id] = column;
        return acc;
      }, {})
    : viewColumns;

  // configure view to hide selected fields
  await request(context.app)
    .patch(`/api/v3/meta/views/${view.id}/columns`)
    .set('xc-auth', context.token)
    .send({ [APIContext.VIEW_COLUMNS]: fields })
    .expect(200);
};

const getViewColumns = async (
  context,
  {
    view,
  }: {
    view: View;
  },
) => {
  return (
    await request(context.app)
      .get(`/api/v3/meta/views/${view.id}/columns`)
      .set('xc-auth', context.token)
      .expect(200)
  ).body;
};

export { updateViewColumns, getViewColumns };
