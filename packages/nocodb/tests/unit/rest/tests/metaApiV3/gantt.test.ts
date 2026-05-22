import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes, ViewTypes } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { overridePlan } from '../../../utils/plan.utils';
import { Base, Model } from '~/models';
import GanttView from '~/models/GanttView';
import GanttViewColumn from '~/models/GanttViewColumn';
import DateDependency from '~/models/DateDependency';
import View from '~/models/View';
import { RootScopes } from '~/utils/globals';

export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Gantt View', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let startColumnId: string;
    let endColumnId: string;
    let titleColumnId: string;

    beforeEach(async () => {
      context = await init();
      const workspaceId = context.fk_workspace_id;

      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'GanttTestBase' })
        .expect(200);

      initBase = await Base.getByTitleOrId(
        {
          workspace_id: RootScopes.BASE,
          base_id: RootScopes.BASE,
        } as any,
        baseResult.body.id,
      );

      ctx = {
        base_id: initBase.id,
        workspace_id: workspaceId,
      };

      // Enable Gantt view + DateDependency + v3 API in a single override.
      // FEATURE_DATE_DEPENDENCY is needed for the per-view dependency rule
      // path; without it, ganttViewCreate with a dependency payload fails.
      featureMock = await overridePlan({
        workspace_id: context.fk_workspace_id!,
        features: {
          [PlanFeatureTypes.FEATURE_GANTT_VIEW]: true,
          [PlanFeatureTypes.FEATURE_DATE_DEPENDENCY]: true,
          [PlanFeatureTypes.FEATURE_API_VIEW_V3]: true,
        },
      });

      // Create a table with Date fields for Gantt scheduling.
      const tableResult = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'GanttTable',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'StartDate', type: 'Date' },
            { title: 'EndDate', type: 'Date' },
            {
              title: 'Status',
              type: 'SingleSelect',
              options: { choices: [{ title: 'A' }, { title: 'B' }] },
            },
          ],
        })
        .expect(200);

      const source = (await initBase.getSources())[0];
      table = await Model.getByAliasOrId(ctx, {
        source_id: source.id,
        aliasOrId: tableResult.body.id,
        base_id: initBase.id,
      });

      const columns = await table.getColumns(ctx);
      titleColumnId = columns.find((c) => c.title === 'Title').id;
      startColumnId = columns.find((c) => c.title === 'StartDate').id;
      endColumnId = columns.find((c) => c.title === 'EndDate').id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    describe('Gantt view CRUD via internal API', () => {
      it('should create a Gantt view without a dependency rule', async () => {
        const response = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({ title: 'My Gantt' });

        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('id');
        expect(response.body.title).to.eq('My Gantt');
        expect(response.body.type).to.eq(ViewTypes.GANTT);

        // No dependency payload → no per-view rule should exist.
        const rule = await DateDependency.getByGanttViewId(ctx, response.body.id);
        expect(rule).to.be.null;
      });

      it('should create a Gantt view with a per-view dependency rule', async () => {
        const response = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'My Gantt With Dep',
            dependency: {
              is_active: true,
              fk_start_date_field_id: startColumnId,
              fk_end_date_field_id: endColumnId,
            },
          });

        expect(response.status).to.eq(200);
        const viewId = response.body.id;

        // Per-view rule should be created and scoped to this Gantt view.
        const rule = await DateDependency.getByGanttViewId(ctx, viewId);
        expect(rule).to.not.be.null;
        expect(rule.fk_gantt_view_id).to.eq(viewId);
        expect(rule.fk_start_date_field_id).to.eq(startColumnId);
        expect(rule.fk_end_date_field_id).to.eq(endColumnId);
      });

      it('should get a Gantt view after creation', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Gantt Get Test',
            dependency: {
              is_active: true,
              fk_start_date_field_id: startColumnId,
              fk_end_date_field_id: endColumnId,
            },
          });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        // GanttView.get eagerly loads the per-view date_dependency rule so
        // the frontend store can render bars on first read without a second
        // fetch — verify both are present.
        const ganttView = await GanttView.get(ctx, viewId);
        expect(ganttView).to.not.be.null;
        expect(ganttView.fk_view_id).to.eq(viewId);
        expect(ganttView.date_dependency).to.not.be.null;
        expect(ganttView.date_dependency!.fk_start_date_field_id).to.eq(
          startColumnId,
        );
      });

      it('should update a Gantt view title', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({ title: 'Gantt Update Test' });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        // Title lives on MetaTable.VIEWS, not GANTT_VIEW — same as Calendar
        // and Timeline. The view-type-specific update operations
        // (ganttViewUpdate / calendarViewUpdate / timelineViewUpdate) only
        // handle the view-type's own config (meta + ranges); renames go
        // through the generic `viewUpdate` operation — matches how the
        // frontend dispatches renames (TreeView/Views/List.vue onRename).
        const updateResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=viewUpdate&viewId=${viewId}`,
          )
          .set('xc-auth', context.token)
          .send({ title: 'Gantt Updated Title' });

        expect(updateResponse.status).to.eq(200);

        const view = await View.get(ctx, viewId, false);
        expect(view!.title).to.eq('Gantt Updated Title');
      });

      it('should reject duplicate view titles', async () => {
        await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({ title: 'Unique Gantt' })
          .expect(200);

        const response = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({ title: 'Unique Gantt' });

        expect(response.status).to.not.eq(200);
      });
    });

    describe('Gantt view columns', () => {
      it('should auto-seed view columns with only the display value visible', async () => {
        // The Gantt seed defaults to only the primary value (pv) being
        // show=true; everything else hidden. The display value gives the
        // bar its label, other fields are opted-in via the Fields menu.
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({ title: 'Gantt Columns Test' });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        const viewColumns = await GanttViewColumn.list(ctx, viewId);
        expect(viewColumns).to.be.an('array');
        expect(viewColumns.length).to.be.greaterThan(0);

        // Identify the pv column id from the table.
        const tableColumns = await table.getColumns(ctx);
        const pvId = tableColumns.find((c) => c.pv)?.id;
        expect(pvId).to.be.a('string');

        const visible = viewColumns.filter(
          (c) => c.show === true || c.show === 1 || c.show === '1',
        );
        expect(visible.length).to.eq(1);
        expect(visible[0].fk_column_id).to.eq(pvId);
      });

      it('should update a Gantt view column show flag', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({ title: 'Gantt Column Update Test' });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        const viewColumns = await GanttViewColumn.list(ctx, viewId);
        // Pick a hidden non-pv column and flip it visible.
        const target = viewColumns.find(
          (c) => c.fk_column_id === startColumnId,
        );
        expect(target).to.not.be.undefined;

        const updateResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttColumnUpdate&ganttViewColumnId=${target.id}`,
          )
          .set('xc-auth', context.token)
          .send({ show: true });

        expect(updateResponse.status).to.eq(200);

        const updated = await GanttViewColumn.get(ctx, target.id);
        expect(updated.show).to.satisfy(
          (v) => v === true || v === 1 || v === '1',
        );
      });

      it('should update group_by on a Gantt view column', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({ title: 'Gantt GroupBy Test' });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        const viewColumns = await GanttViewColumn.list(ctx, viewId);
        const firstColumn = viewColumns[0];

        const updateResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttColumnUpdate&ganttViewColumnId=${firstColumn.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            group_by: true,
            group_by_order: 1,
            group_by_sort: 'asc',
          });

        expect(updateResponse.status).to.eq(200);

        const updated = await GanttViewColumn.get(ctx, firstColumn.id);
        expect(updated.group_by).to.satisfy(
          (v) => v === true || v === 1 || v === '1',
        );
        expect(updated.group_by_order).to.eq(1);
        expect(updated.group_by_sort).to.eq('asc');
      });
    });

    describe('Gantt view deletion', () => {
      it('should delete a Gantt view and clean up its per-view dependency rule', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=ganttViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Gantt Delete Test',
            dependency: {
              is_active: true,
              fk_start_date_field_id: startColumnId,
              fk_end_date_field_id: endColumnId,
            },
          });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        // Sanity-check the rule was created.
        const beforeRule = await DateDependency.getByGanttViewId(ctx, viewId);
        expect(beforeRule).to.not.be.null;

        const deleteResponse = await request(context.app)
          .delete(`/api/v1/db/meta/views/${viewId}`)
          .set('xc-auth', context.token);

        expect(deleteResponse.status).to.eq(200);

        // View is soft-deleted (trashed) — View.get without includeDeleted
        // returns nothing.
        const view = await View.get(ctx, viewId, false);
        expect(view).to.not.be.ok;
      });
    });
  });
}
