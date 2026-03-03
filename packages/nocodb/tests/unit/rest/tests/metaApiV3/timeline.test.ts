import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes, ViewTypes } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { overridePlan } from '../../../utils/plan.utils';
import { Base, Model } from '~/models';
import TimelineView from '~/models/TimelineView';
import TimelineRange from '~/models/TimelineRange';
import TimelineViewColumn from '~/models/TimelineViewColumn';
import { RootScopes } from '~/utils/globals';

export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Timeline View', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let dateTimeColumnId: string;
    let dateTimeColumn2Id: string;
    let titleColumnId: string;

    beforeEach(async () => {
      context = await init();
      const workspaceId = context.fk_workspace_id;

      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'TimelineTestBase' })
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

      // Enable timeline view feature and v3 API in a single call
      featureMock = await overridePlan({
        workspace_id: context.fk_workspace_id!,
        features: {
          [PlanFeatureTypes.FEATURE_TIMELINE_VIEW]: true,
          [PlanFeatureTypes.FEATURE_API_VIEW_V3]: true,
        },
      });

      // Create a table with DateTime fields for timeline range
      const tableResult = await request(context.app)
        .post(`/api/v3/meta/bases/${initBase.id}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'TimelineTable',
          fields: [
            { title: 'Title', type: 'SingleLineText' },
            { title: 'StartDate', type: 'DateTime' },
            { title: 'EndDate', type: 'DateTime' },
            { title: 'Category', type: 'SingleSelect', options: { choices: [{ title: 'A' }, { title: 'B' }] } },
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
      dateTimeColumnId = columns.find((c) => c.title === 'StartDate').id;
      dateTimeColumn2Id = columns.find((c) => c.title === 'EndDate').id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    describe('Timeline view CRUD via internal API', () => {
      it('should create a timeline view', async () => {
        const response = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'My Timeline',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
                fk_to_column_id: dateTimeColumn2Id,
              },
            ],
          });

        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('id');
        expect(response.body.title).to.eq('My Timeline');
        expect(response.body.type).to.eq(ViewTypes.TIMELINE);
      });

      it('should get a timeline view after creation', async () => {
        // Create the view
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Timeline Get Test',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
                fk_to_column_id: dateTimeColumn2Id,
              },
            ],
          });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        // Fetch the timeline view via model
        const timelineView = await TimelineView.get(ctx, viewId);
        expect(timelineView).to.not.be.null;
        expect(timelineView.fk_view_id).to.eq(viewId);
        expect(timelineView.timeline_range).to.be.an('array');
        expect(timelineView.timeline_range.length).to.eq(1);
        expect(timelineView.timeline_range[0].fk_from_column_id).to.eq(
          dateTimeColumnId,
        );
        expect(timelineView.timeline_range[0].fk_to_column_id).to.eq(
          dateTimeColumn2Id,
        );
      });

      it('should update a timeline view', async () => {
        // Create the view
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Timeline Update Test',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
                fk_to_column_id: dateTimeColumn2Id,
              },
            ],
          });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        // Update the timeline view (change range to start-only)
        const updateResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewUpdate&viewId=${viewId}`,
          )
          .set('xc-auth', context.token)
          .send({
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
                fk_to_column_id: null,
              },
            ],
          });

        expect(updateResponse.status).to.eq(200);

        // Verify update via model
        const timelineView = await TimelineView.get(ctx, viewId);
        expect(timelineView.timeline_range).to.be.an('array');
        expect(timelineView.timeline_range.length).to.eq(1);
        expect(timelineView.timeline_range[0].fk_from_column_id).to.eq(
          dateTimeColumnId,
        );
      });

      it('should reject duplicate view titles', async () => {
        // Create first view
        await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Unique Timeline',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
              },
            ],
          })
          .expect(200);

        // Attempt to create second view with same title
        const response = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Unique Timeline',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
              },
            ],
          });

        expect(response.status).to.not.eq(200);
      });
    });

    describe('Timeline view columns', () => {
      it('should list view columns after creation', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Timeline Columns Test',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
                fk_to_column_id: dateTimeColumn2Id,
              },
            ],
          });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        // View columns should be auto-created for all table columns
        const viewColumns = await TimelineViewColumn.list(ctx, viewId);
        expect(viewColumns).to.be.an('array');
        expect(viewColumns.length).to.be.greaterThan(0);

        // Each view column should have an fk_column_id
        for (const col of viewColumns) {
          expect(col.fk_column_id).to.be.a('string');
          expect(col.fk_view_id).to.eq(viewId);
        }
      });

      it('should update a timeline view column', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Timeline Column Update Test',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
              },
            ],
          });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        const viewColumns = await TimelineViewColumn.list(ctx, viewId);
        const firstColumn = viewColumns[0];

        // Update column visibility
        const updateResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineColumnUpdate&timelineViewColumnId=${firstColumn.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            show: false,
          });

        expect(updateResponse.status).to.eq(200);

        // Verify update
        const updatedColumn = await TimelineViewColumn.get(ctx, firstColumn.id);
        expect(updatedColumn.show).to.satisfy(
          (v) => v === false || v === 0 || v === '0',
        );
      });

      it('should update group_by on a timeline column', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Timeline GroupBy Test',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
              },
            ],
          });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        const viewColumns = await TimelineViewColumn.list(ctx, viewId);
        const firstColumn = viewColumns[0];

        // Set group_by
        const updateResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineColumnUpdate&timelineViewColumnId=${firstColumn.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            group_by: true,
            group_by_order: 1,
            group_by_sort: 'asc',
          });

        expect(updateResponse.status).to.eq(200);

        // Verify
        const updatedColumn = await TimelineViewColumn.get(ctx, firstColumn.id);
        expect(updatedColumn.group_by).to.satisfy(
          (v) => v === true || v === 1 || v === '1',
        );
        expect(updatedColumn.group_by_order).to.eq(1);
        expect(updatedColumn.group_by_sort).to.eq('asc');
      });
    });

    describe('Timeline range model', () => {
      it('should read ranges for a view', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Timeline Range Read Test',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
                fk_to_column_id: dateTimeColumn2Id,
              },
            ],
          });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        const rangeResult = await TimelineRange.read(ctx, viewId);
        expect(rangeResult).to.not.be.null;
        expect(rangeResult.ranges).to.be.an('array');
        expect(rangeResult.ranges.length).to.eq(1);
        expect(rangeResult.ranges[0].fk_from_column_id).to.eq(
          dateTimeColumnId,
        );
        expect(rangeResult.ranges[0].fk_to_column_id).to.eq(
          dateTimeColumn2Id,
        );
      });

      it('should find a range by view id', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Timeline Range Find Test',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
              },
            ],
          });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        const range = await TimelineRange.find(ctx, viewId);
        expect(range).to.not.be.null;
        expect(range.fk_from_column_id).to.eq(dateTimeColumnId);
        expect(range.fk_view_id).to.eq(viewId);
      });

      it('should detect column used as range', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Timeline IsColumnUsed Test',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
                fk_to_column_id: dateTimeColumn2Id,
              },
            ],
          });

        expect(createResponse.status).to.eq(200);

        // Column used as from_column
        const usedAsFrom =
          await TimelineRange.IsColumnBeingUsedAsRange(
            ctx,
            dateTimeColumnId,
          );
        expect(usedAsFrom).to.be.an('array');
        expect(usedAsFrom.length).to.be.greaterThan(0);

        // Column used as to_column
        const usedAsTo =
          await TimelineRange.IsColumnBeingUsedAsRange(
            ctx,
            dateTimeColumn2Id,
          );
        expect(usedAsTo).to.be.an('array');
        expect(usedAsTo.length).to.be.greaterThan(0);

        // Column not used as range
        const notUsed =
          await TimelineRange.IsColumnBeingUsedAsRange(ctx, titleColumnId);
        expect(notUsed).to.be.an('array');
        expect(notUsed.length).to.eq(0);
      });
    });

    describe('Timeline view deletion', () => {
      it('should delete a timeline view and its ranges', async () => {
        const createResponse = await request(context.app)
          .post(
            `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=timelineViewCreate&tableId=${table.id}`,
          )
          .set('xc-auth', context.token)
          .send({
            title: 'Timeline Delete Test',
            timeline_range: [
              {
                fk_from_column_id: dateTimeColumnId,
                fk_to_column_id: dateTimeColumn2Id,
              },
            ],
          });

        expect(createResponse.status).to.eq(200);
        const viewId = createResponse.body.id;

        // Delete the view via v1 API
        const deleteResponse = await request(context.app)
          .delete(`/api/v1/db/meta/views/${viewId}`)
          .set('xc-auth', context.token);

        expect(deleteResponse.status).to.eq(200);

        // Verify timeline view is gone
        const timelineView = await TimelineView.get(ctx, viewId);
        expect(timelineView).to.not.be.ok;
      });
    });
  });
}
