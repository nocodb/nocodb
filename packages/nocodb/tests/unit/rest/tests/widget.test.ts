import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import { Exception } from 'handlebars';
import { createWidget } from '../../factory/widget';
import init from '../../init';
import { createLayout } from '../../factory/layout';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { Widget } from '../../../../src/models';

// Test case list
// 1. Create widget
// 2. Delete widget
// 3. Update widget type
// 4. Get widgets list

function widgetTests() {
  let context;
  let layout;
  let dashboardProject;
  let widget;
  let table;
  let dbProject;

  beforeEach(async function () {
    console.time('#### widgetTests');
    context = await init();

    dbProject = await createProject(context);

    dashboardProject = await createProject(context, {
      title: 'Dashboard1',
      type: 'dashboard',
      // linked_db_project_ids: [dbProject.id],
    });

    layout = await createLayout(context, dashboardProject, {
      title: 'Layout1',
      base_id: dashboardProject.id,
    });

    table = await createTable(context, dbProject);

    widget = await createWidget(context, {
      schema_version: 'v0.2',
      widget_type: 'number',
      layout_id: layout.id,
    });
    console.timeEnd('#### widgetTests');
  });

  describe('Widget create, delete, update, list', async function () {
    it('Create widget', async () => {
      const response = await request(context.app)
        .post(`/api/v1/layouts/${layout.id}/widgets`)
        .set('xc-auth', context.token)
        .send({
          layout_id: layout.id,
          schema_version: 'v0.2',
          widget_type: 'number',
        })
        .expect(200);

      const newWidget = await Widget.get(response.body.id);
      if (!newWidget) return new Error('Widget not created');
    });

    it('Delete widget', async function () {
      await request(context.app)
        .delete(`/api/v1/layouts/${layout.id}/widgets/${widget.id}`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      const deletedWidget = await Widget.get(widget.id);

      if (deletedWidget !== undefined) {
        throw new Exception('Widget not deleted');
      }
    });

    it('Update widget type', async () => {
      await request(context.app)
        .patch(`/api/v1/layouts/${layout.id}/widgets/${widget.id}`)
        .set('xc-auth', context.token)
        .send({
          layout_id: layout.id,
          schema_version: 'v0.2',
          widget_type: 'line_chart',
        })
        .expect(200);

      const newWidgetType = await Widget.get(widget.id);
      if (newWidgetType.widget_type !== 'number') {
        return new Error('Widget not updated');
      }
    });

    it('Get widgets list', async function () {
      const response = await request(context.app)
        .get(`/api/v1/layouts/${layout.id}/widgets/`)
        .set('xc-auth', context.token)
        .send({})
        .expect(200);

      expect(response.body.list).to.be.an('array').not.empty;
    });
  });
}

// describe('Widget config update edge cases', async function () {
//   it('trying to connect to a table of a DB base that exists, but is not linked to the Dashboard Base results in a "FORBIDDEN"/403', async function () {
//     const req: WidgetReqType = {
//       layout_id: layout.id,
//       schema_version: 'v0.2',
//       widget_type: 'line_chart' as WidgetTypeType,
//       data_source: {
//         dataSourceType: DataSourceType.INTERNAL,
//         baseId: dbProject.id,
//         tableId: table.id,
//       } as DataSource,
//     };
//     await request(context.app)
//       .patch(`/api/v1/layouts/${layout.id}/widgets/${widget.id}`)
//       .set('xc-auth', context.token)
//       .send(req)
//       .expect(403);
//   });

// it('trying to connect to a non existing table results in an error', async function () {
//   const req: WidgetReqType = {
//     layout_id: layout.id,
//     schema_version: 'v0.2',
//     widget_type: 'line_chart' as WidgetTypeType,
//     data_source: {
//       dataSourceType: DataSourceType.INTERNAL,
//       baseId: dbProject.id,
//       tableId: table.id,
//     } as DataSource,
//   };
//   const response = await request(context.app)
//     .patch(`/api/v1/layouts/${layout.id}/widgets/${widget.id}`)
//     .set('xc-auth', context.token)
//     .send(req);
//   console.log('----------------------------');
// });

// it('trying to connect to a non existing view results in an error', async function () {});
// describe('trying to connect to a non existing columns results in an error', async function () {
//   it('for number widget: trying to connect to a non existing column results in an error', async function () {});
//   it('for chart widget: trying to connect to a non existing column for the x-axis results in an error', async function () {});
//   it('for chart widget: trying to connect to a non existing column for the y-axis results in an error', async function () {});
// });

export default function () {
  describe('Widget', widgetTests);
}
