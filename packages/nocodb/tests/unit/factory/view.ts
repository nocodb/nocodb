import { ViewTypes } from 'nocodb-sdk';
import request from 'supertest';
import Model from '../../../src/models/Model';
import View from '../../../src/models/View';

const createView = async (context, {title, table, type}: {title: string, table: Model, type: ViewTypes}) => {
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
  if(response.status !== 200) {
    throw new Error('createView',response.body.message);
  }

  const view = await View.getByTitleOrId({fk_model_id: table.id, titleOrId:title}) as View;

  return view
}

export {createView}
