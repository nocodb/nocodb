import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { PlanFeatureTypes, ViewTypes } from 'nocodb-sdk';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model, View, TimelineViewColumn } from '~/models';
import { RootScopes } from '~/utils/globals';

export const viewTypeUpdatesTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - View Type Updates', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;
    let singleSelectColId: string;
    let dateTimeColId: string;
    let attachmentColId: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'ViewTypeUpdateBase' })
        .expect(200);

      initBase = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseResult.body.id,
      );
      baseId = initBase.id;

      // Create table with multiple field types
      const tableResult = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'ViewTypeUpdateTable',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'Number', type: 'Number' },
            { title: 'DateTime', type: 'DateTime' },
            {
              title: 'SingleSelect',
              type: 'SingleSelect',
              options: {
                choices: [
                  { title: 'Option1', color: '#ff0000' },
                  { title: 'Option2', color: '#00ff00' },
                ],
              },
            },
            { title: 'Attachment', type: 'Attachment' },
          ],
        })
        .expect(200);

      // Get table model
      const source = (await initBase.getSources())[0];
      ctx = { base_id: initBase.id, workspace_id: workspaceId };
      table = await Model.getByAliasOrId(ctx, {
        source_id: source.id,
        aliasOrId: tableResult.body.id,
        base_id: initBase.id,
      });

      // Get column IDs from V3-created columns
      const columns = await table.getColumns(ctx);
      singleSelectColId = columns.find(
        (c: any) => c.uidt === 'SingleSelect',
      )?.id;
      dateTimeColId = columns.find((c: any) => c.uidt === 'DateTime')?.id;
      attachmentColId = columns.find((c: any) => c.uidt === 'Attachment')?.id;

      // Override feature flag
      featureMock = await overrideFeature({
        workspace_id: workspaceId,
        feature: PlanFeatureTypes.FEATURE_API_VIEW_V3,
        allowed: true,
      });

      INTERNAL_API_BASE = `/api/v2/internal/${workspaceId}/${baseId}`;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    // Helper: create a view via internal API
    async function createView(
      operation: string,
      title: string,
      extraBody: any = {},
    ) {
      const res = await request(context.app)
        .post(INTERNAL_API_BASE)
        .query({ operation, tableId: table.id })
        .set('xc-token', context.xc_token)
        .send({ title, ...extraBody })
        .expect(200);
      return res.body;
    }

    // ── gridViewUpdate ──────────────────────────────────────────────

    describe('gridViewUpdate (POST)', () => {
      it('should update grid row height', async () => {
        const view = await createView('gridViewCreate', 'GridForUpdate');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'gridViewUpdate', viewId: view.id })
          .set('xc-token', context.xc_token)
          .send({ row_height: 2 })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const view = await createView('gridViewCreate', 'GridAuth');

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'gridViewUpdate', viewId: view.id })
          .send({ row_height: 2 })
          .expect(401);
      });
    });

    // ── formViewUpdate ──────────────────────────────────────────────

    describe('formViewUpdate (POST)', () => {
      it('should update form view heading and subheading', async () => {
        const view = await createView('formViewCreate', 'FormForUpdate');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'formViewUpdate', viewId: view.id })
          .set('xc-token', context.xc_token)
          .send({ heading: 'New Heading', subheading: 'New Subheading' })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const view = await createView('formViewCreate', 'FormAuth');

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'formViewUpdate', viewId: view.id })
          .send({ heading: 'Test' })
          .expect(401);
      });
    });

    // ── formColumnUpdate ────────────────────────────────────────────

    describe('formColumnUpdate (POST)', () => {
      it('should update form column label and required', async () => {
        const view = await createView('formViewCreate', 'FormColUpdate');

        // Get view columns to find a form column ID
        const colRes = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewColumnList', viewId: view.id })
          .set('xc-token', context.xc_token)
          .expect(200);

        const formColId = colRes.body.list[0]?.id;
        expect(formColId).to.exist;

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'formColumnUpdate', formColumnId: formColId })
          .set('xc-token', context.xc_token)
          .send({ label: 'Custom Label', required: true })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const view = await createView('formViewCreate', 'FormColAuth');

        const colRes = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({ operation: 'viewColumnList', viewId: view.id })
          .set('xc-token', context.xc_token)
          .expect(200);

        const formColId = colRes.body.list[0]?.id;

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'formColumnUpdate', formColumnId: formColId })
          .send({ label: 'Test' })
          .expect(401);
      });
    });

    // ── galleryViewUpdate ───────────────────────────────────────────

    describe('galleryViewUpdate (POST)', () => {
      it('should update gallery cover field', async () => {
        const view = await createView('galleryViewCreate', 'GalleryForUpdate');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'galleryViewUpdate', viewId: view.id })
          .set('xc-token', context.xc_token)
          .send({ fk_cover_image_col_id: attachmentColId })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const view = await createView('galleryViewCreate', 'GalleryAuth');

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'galleryViewUpdate', viewId: view.id })
          .send({ fk_cover_image_col_id: attachmentColId })
          .expect(401);
      });
    });

    // ── kanbanViewUpdate ────────────────────────────────────────────

    describe('kanbanViewUpdate (POST)', () => {
      it('should update kanban cover image field', async () => {
        const view = await createView('kanbanViewCreate', 'KanbanForUpdate', {
          fk_grp_col_id: singleSelectColId,
        });

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'kanbanViewUpdate', viewId: view.id })
          .set('xc-token', context.xc_token)
          .send({ fk_cover_image_col_id: attachmentColId })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const view = await createView('kanbanViewCreate', 'KanbanAuth', {
          fk_grp_col_id: singleSelectColId,
        });

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'kanbanViewUpdate', viewId: view.id })
          .send({ fk_cover_image_col_id: attachmentColId })
          .expect(401);
      });
    });

    // ── mapViewUpdate ───────────────────────────────────────────────

    describe('mapViewUpdate (POST)', () => {
      it('should update map view meta', async () => {
        const view = await createView('mapViewCreate', 'MapForUpdate');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'mapViewUpdate', viewId: view.id })
          .set('xc-token', context.xc_token)
          .send({ meta: {} })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const view = await createView('mapViewCreate', 'MapAuth');

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'mapViewUpdate', viewId: view.id })
          .send({ meta: {} })
          .expect(401);
      });
    });

    // ── calendarViewUpdate ──────────────────────────────────────────

    describe('calendarViewUpdate (POST)', () => {
      it('should update calendar date ranges', async () => {
        const view = await createView(
          'calendarViewCreate',
          'CalendarForUpdate',
          {
            calendar_range: [
              { fk_from_column_id: dateTimeColId, fk_to_column_id: null },
            ],
          },
        );

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'calendarViewUpdate', viewId: view.id })
          .set('xc-token', context.xc_token)
          .send({
            calendar_range: [
              {
                fk_from_column_id: dateTimeColId,
                fk_to_column_id: dateTimeColId,
              },
            ],
          })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const view = await createView(
          'calendarViewCreate',
          'CalendarAuth',
          {
            calendar_range: [
              { fk_from_column_id: dateTimeColId, fk_to_column_id: null },
            ],
          },
        );

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'calendarViewUpdate', viewId: view.id })
          .send({ calendar_range: [] })
          .expect(401);
      });
    });

    // ── timelineViewCreate ──────────────────────────────────────────

    describe('timelineViewCreate (POST)', () => {
      it('should create a timeline view', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'timelineViewCreate', tableId: table.id })
          .set('xc-token', context.xc_token)
          .send({ title: 'TestTimeline' })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.id).to.exist;
        expect(response.body.title).to.eq('TestTimeline');
        expect(response.body.type).to.eq(ViewTypes.TIMELINE);
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'timelineViewCreate', tableId: table.id })
          .send({ title: 'TimelineAuth' })
          .expect(401);
      });
    });

    // ── timelineViewUpdate ──────────────────────────────────────────

    describe('timelineViewUpdate (POST)', () => {
      it('should update timeline view settings', async () => {
        const view = await createView(
          'timelineViewCreate',
          'TimelineForUpdate',
        );

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'timelineViewUpdate', viewId: view.id })
          .set('xc-token', context.xc_token)
          .send({
            timeline_range: [
              {
                fk_from_column_id: dateTimeColId,
                fk_to_column_id: null,
              },
            ],
          })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const view = await createView(
          'timelineViewCreate',
          'TimelineAuth',
        );

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({ operation: 'timelineViewUpdate', viewId: view.id })
          .send({ timeline_range: [] })
          .expect(401);
      });
    });

    // ── timelineColumnUpdate ────────────────────────────────────────

    describe('timelineColumnUpdate (POST)', () => {
      it('should update timeline column settings', async () => {
        const view = await createView(
          'timelineViewCreate',
          'TimelineColUpdate',
        );

        // Manually insert a timeline view column (bulkColumnInsertToViews
        // may not populate them in all test environments)
        const columns = await table.getColumns(ctx);
        const firstCol = columns[0];
        const source = (await initBase.getSources())[0];
        const timelineCol = await TimelineViewColumn.insert(ctx, {
          fk_view_id: view.id,
          fk_column_id: firstCol.id,
          show: true,
          base_id: baseId,
          source_id: source.id,
        });
        expect(timelineCol).to.exist;

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'timelineColumnUpdate',
            timelineViewColumnId: timelineCol.id,
          })
          .set('xc-token', context.xc_token)
          .send({ show: false })
          .expect(200);

        expect(response.status).to.equal(200);
      });

      it('should return 401 without authentication', async () => {
        const view = await createView(
          'timelineViewCreate',
          'TimelineColAuth',
        );

        // Manually insert a timeline view column
        const columns = await table.getColumns(ctx);
        const firstCol = columns[0];
        const source = (await initBase.getSources())[0];
        const timelineCol = await TimelineViewColumn.insert(ctx, {
          fk_view_id: view.id,
          fk_column_id: firstCol.id,
          show: true,
          base_id: baseId,
          source_id: source.id,
        });

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'timelineColumnUpdate',
            timelineViewColumnId: timelineCol.id,
          })
          .send({ show: false })
          .expect(401);
      });
    });
  });
};
