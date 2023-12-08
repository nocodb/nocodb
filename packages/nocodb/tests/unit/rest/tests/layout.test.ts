import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import { Exception } from 'handlebars';
import { createProject } from '../../factory/base';
import { createLayout } from '../../factory/layout';
import init from '../../init';
import { Layout } from '../../../../src/models';

// Test case list
// 1. Create layout
// 2. Update layout
// 3. Get layouts list
// 4. Delete layout

function layoutTests() {
  let context;
  let layout;
  let dashboard;

  beforeEach(async function () {
    console.time('#### layoutTests');
    context = await init();

    dashboard = await createProject(context, {
      title: 'Dashboard1',
      type: 'dashboard',
    });
    layout = await createLayout(context, dashboard, {
      title: 'Layout1',
      base_id: dashboard.id,
    });
    console.timeEnd('#### layoutTests');
  });

  describe('Layout create, update, list, delete', async function () {
    it('Create layout', async () => {
      const response = await request(context.app)
        .post(`/api/v1/dashboards/${dashboard.id}/layouts`)
        .set('xc-auth', context.token)
        .send({
          title: 'Layout2',
          base_id: dashboard.id,
        })
        .expect(200);

      const newLayout = await Layout.get(response.body.id);
      if (!newLayout) return new Error('Layout not created');
    });

    it('Update layout', async () => {
      const response = await request(context.app)
        .patch(`/api/v1/dashboards/${dashboard.id}/layouts/${layout.id}`)
        .set('xc-auth', context.token)
        .send({
          title: 'NewTitle',
          base_id: dashboard.id,
        })
        .expect(200);

      const newLayout = await Layout.get(layout.id);
      if (newLayout.title !== 'NewTitle') {
        return new Error('Layout not updated');
      }
    });

    it('Get layouts list', async function () {
      const response = await request(context.app)
        .get(`/api/v1/dashboards/${dashboard.id}/layouts/`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      expect(response.body.list).to.be.an('array').not.empty;
    });

    it('Delete layout', async function () {
      const response = await request(context.app)
        .delete(`/api/v1/dashboards/${dashboard.id}/layouts/${layout.id}`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      const deletedLayout = await Layout.get(layout.id);

      if (deletedLayout !== undefined) {
        throw new Exception('Layout not deleted');
      }
    });
  });
}

//   it('Create layout with same title', async function () {
//     const temp = await Layout.get(layout);
//     console.log('old layout', temp);
//     const response = await request(context.app)
//       .post(`/api/v1/dashboards/${dashboard.id}/layouts`)
//       .set('xc-auth', context.token)
//       .send({
//         title: 'Layout1',
//         base_id: dashboard.id,
//       })
//       .expect(400);

// if (!response.text.includes('Duplicate table alias')) {
//   console.error(response.text);
//   return new Error('Wrong api response');
// }

// const tables = await getAllTables({ base });
// if (tables.length !== 1) {
//   return new Error('Tables should not be created');
// }
//   });

export default function () {
  describe('Layout', layoutTests);
}
