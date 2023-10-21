import { ViewTypes } from 'nocodb-sdk';
import request from 'supertest';
import View from '../../../src/models/View';
import type Model from '../../../src/models/Model';

const createView = async (
  context,
  {
    title,
    table,
    type,
  }: {
    title: string;
    table: Model;
    type: ViewTypes;
  },
) => {
  const viewTypeStr = (type) => {
    switch (type) {
      case ViewTypes.GALLERY:
        return 'galleries';
      case ViewTypes.FORM:
        return 'forms';
      case ViewTypes.GRID:
        return 'grids';
      case ViewTypes.KANBAN:
        return 'kanbans';
      default:
        throw new Error('Invalid view type');
    }
  };

  const response = await request(context.app)
    .post(`/api/v1/db/meta/tables/${table.id}/${viewTypeStr(type)}`)
    .set('xc-auth', context.token)
    .send({
      title,
      type,
    });
  if (response.status !== 200) {
    throw new Error('createView', response.body.message);
  }

  const view = (await View.getByTitleOrId({
    fk_model_id: table.id,
    titleOrId: title,
  })) as View;
  return view;
};

const getView = async (
  context,
  { table, name }: { table: Model; name: string },
) => {
  const response = await request(context.app)
    .get(`/api/v1/db/meta/tables/${table.id}/views`)
    .set('xc-auth', context.token);
  if (response.status !== 200) {
    throw new Error('List Views', response.body.message);
  }
  const _view = response.body.list.find((v) => v.title === name);
  const view = View.getByTitleOrId({
    titleOrId: _view.id,
    fk_model_id: _view.fk_model_id,
  });
  return view;
};

const updateView = async (
  context,
  {
    table,
    view,
    filter = [],
    sort = [],
    field = [],
  }: {
    table: Model;
    view: View;
    filter?: any[];
    sort?: any[];
    field?: any[];
  },
) => {
  if (filter.length) {
    for (let i = 0; i < filter.length; i++) {
      await request(context.app)
        .post(`/api/v1/db/meta/views/${view.id}/filters`)
        .set('xc-auth', context.token)
        .send(filter[i])
        .expect(200);
    }
  }

  if (sort.length) {
    for (let i = 0; i < sort.length; i++) {
      await request(context.app)
        .post(`/api/v1/db/meta/views/${view.id}/sorts`)
        .set('xc-auth', context.token)
        .send(sort[i])
        .expect(200);
    }
  }

  if (field.length) {
    for (let i = 0; i < field.length; i++) {
      const columns = await table.getColumns();
      const viewColumns = await view.getColumns();

      const columnId = columns.find((c) => c.title === field[i]).id;
      const viewColumnId = viewColumns.find(
        (c) => c.fk_column_id === columnId,
      ).id;
      // configure view to hide selected fields
      await request(context.app)
        .patch(`/api/v1/db/meta/views/${view.id}/columns/${viewColumnId}`)
        .set('xc-auth', context.token)
        .send({ show: false })
        .expect(200);
    }
  }
};

const deleteView = async (
  context,
  {
    viewId,
  }: {
    viewId: string;
  },
) => {
  await request(context.app)
    .delete(`/api/v1/db/meta/views/${viewId}`)
    .set('xc-auth', context.token)
    .expect(200);
};

export { createView, updateView, getView, deleteView };
