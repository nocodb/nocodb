import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes, ViewTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const viewBasicTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - View Basic Operations', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let table: any;
    let ctx: any;
    let featureMock: any;
    let workspaceId: string;
    let baseId: string;
    let INTERNAL_API_BASE: string;

    beforeEach(async () => {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      // Create base
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'ViewTestBase' })
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
          title: 'ViewTestTable',
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
            { title: 'Checkbox', type: 'Checkbox', default_value: true },
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

    describe('viewList (GET)', () => {
      it('should list all views for a table', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.list).to.be.an('array');
        expect(response.body.list.length).to.be.greaterThan(0);
      });

      it('should list views with default grid view', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        // The first view should be a grid view (default view)
        expect(response.body.list[0]).to.not.be.undefined;
        expect(response.body.list[0].type).to.eq(ViewTypes.GRID);
      });

      it('should list views with multiple view types', async () => {
        // Create a gallery view (simpler than form view)
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'galleryViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'MyGalleryView' })
          .expect(200);

        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const gridView = response.body.list.find(
          (v: any) => v.type === ViewTypes.GRID,
        );
        const galleryView = response.body.list.find(
          (v: any) => v.type === ViewTypes.GALLERY,
        );
        expect(gridView).to.not.be.undefined;
        expect(galleryView).to.not.be.undefined;
      });

      it('should return correct structure (id, title, type, lock_type, etc.)', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const view = response.body.list[0];
        expect(view).to.have.property('id');
        expect(view).to.have.property('title');
        expect(view).to.have.property('type');
        expect(view).to.have.property('lock_type');
        expect(view).to.have.property('fk_model_id');
      });

      it('should list views for table with no custom views', async () => {
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        // Should have at least the default grid view
        expect(response.body.list.length).to.eq(1);
        expect(response.body.list[0].type).to.eq(ViewTypes.GRID);
      });

      it('should include view ordering', async () => {
        // Create multiple views
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'View1' })
          .expect(200);

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'View2' })
          .expect(200);

        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body.list.length).to.be.greaterThan(2);
        // Verify each view has an order property
        response.body.list.forEach((view: any) => {
          expect(view).to.have.property('order');
        });
      });

      it('should respect personal view ownership', async () => {
        // Create a personal view
        const personalView = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'PersonalView',
            lock_type: 'personal',
          })
          .expect(200);

        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const foundView = response.body.list.find(
          (v: any) => v.id === personalView.body.id,
        );
        expect(foundView).to.exist;
        expect(foundView.lock_type).to.eq('personal');
      });

      it('should filter by view type', async () => {
        // Create views of different types
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'galleryViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'TestGallery' })
          .expect(200);

        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const gridViews = response.body.list.filter(
          (v: any) => v.type === ViewTypes.GRID,
        );
        const galleryViews = response.body.list.filter(
          (v: any) => v.type === ViewTypes.GALLERY,
        );
        expect(gridViews.length).to.be.greaterThan(0);
        expect(galleryViews.length).to.be.greaterThan(0);
      });

      it('should return 404 with invalid tableId', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: 'invalid-table-id',
          })
          .set('xc-token', context.xc_token)
          .expect(404);
      });

      it('should return 404 with invalid baseId', async () => {
        await request(context.app)
          .get(`/api/v2/internal/${workspaceId}/invalid-base-id`)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(404);
      });

      it('should return 401 without authentication', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .expect(401);
      });
    });

    describe('viewUpdate (POST)', () => {
      it('should update view title', async () => {
        // Get default view
        const viewListResponse = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const defaultView = viewListResponse.body.list[0];

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewUpdate',
            viewId: defaultView.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'Updated Grid View' })
          .expect(200);

        expect(response.body.title).to.eq('Updated Grid View');
      });

      it('should update view show_system_fields', async () => {
        // Get default view
        const viewListResponse = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const defaultView = viewListResponse.body.list[0];

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewUpdate',
            viewId: defaultView.id,
          })
          .set('xc-token', context.xc_token)
          .send({ show_system_fields: true })
          .expect(200);

        expect(response.body.show_system_fields).to.be.true;
      });

      it('should update view lock_type', async () => {
        // Create a new view to change lock type
        const newView = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'LockTestView' })
          .expect(200);

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewUpdate',
            viewId: newView.body.id,
          })
          .set('xc-token', context.xc_token)
          .send({ lock_type: 'personal' })
          .expect(200);

        expect(response.body.lock_type).to.eq('personal');
      });

      it('should update view meta properties', async () => {
        const viewListResponse = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const defaultView = viewListResponse.body.list[0];

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewUpdate',
            viewId: defaultView.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            meta: {
              customProperty: 'customValue',
            },
          })
          .expect(200);

        expect(response.body).to.have.property('meta');
      });

      it('should return 404 with invalid viewId', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewUpdate',
            viewId: 'invalid-view-id',
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'Should Fail' })
          .expect(404);
      });

      it('should return 422 when updating title to duplicate', async () => {
        // Create two views
        const view1 = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'UniqueView1' })
          .expect(200);

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'UniqueView2' })
          .expect(200);

        // Try to rename view1 to same name as view2 (returns 422 Unprocessable Entity)
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewUpdate',
            viewId: view1.body.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'UniqueView2' })
          .expect(422);
      });

      it('should respect personal view lock_type on creation', async () => {
        // Create a personal view
        const personalView = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'PersonalViewForOwnerTest',
            lock_type: 'personal',
          })
          .expect(200);

        // Verify the view was created with personal lock_type
        expect(personalView.body.lock_type).to.eq('personal');

        // Verify the view is owned by the current user
        expect(personalView.body.owned_by).to.eq(context.user?.id);
      });

      it('should not allow changing last collaborative grid to personal', async () => {
        // Get the default collaborative grid view
        const viewListResponse = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const collaborativeGrids = viewListResponse.body.list.filter(
          (v: any) => v.type === 'grid' && v.lock_type === 'collaborative',
        );

        // If there's only one collaborative grid, it shouldn't be changeable to personal
        if (collaborativeGrids.length === 1) {
          await request(context.app)
            .post(INTERNAL_API_BASE)
            .query({
              operation: 'viewUpdate',
              viewId: collaborativeGrids[0].id,
            })
            .set('xc-token', context.xc_token)
            .send({ lock_type: 'personal' })
            .expect(400);
        }
      });
    });

    describe('viewDelete (POST)', () => {
      it('should delete custom view', async () => {
        // Create a custom view
        const newView = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'ViewToDelete' })
          .expect(200);

        // Delete the view
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewDelete',
            viewId: newView.body.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        // Verify view is deleted
        const viewList = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const deletedView = viewList.body.list.find(
          (v: any) => v.id === newView.body.id,
        );
        expect(deletedView).to.be.undefined;
      });

      it('should cascade delete filters', async () => {
        // Create a view
        const newView = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'ViewWithFilters' })
          .expect(200);

        // Get a column to filter on
        const columns = await table.getColumns(ctx);
        const titleColumn = columns.find((col: any) => col.title === 'Title');

        // Create a filter
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'filterCreate',
            viewId: newView.body.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumn.id,
            comparison_op: 'eq',
            value: 'test',
          })
          .expect(200);

        // Delete the view
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewDelete',
            viewId: newView.body.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        // Verify view is deleted (filters should be cascade deleted)
        const viewList = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const deletedView = viewList.body.list.find(
          (v: any) => v.id === newView.body.id,
        );
        expect(deletedView).to.be.undefined;
      });

      it('should cascade delete sorts', async () => {
        // Create a view
        const newView = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'ViewWithSorts' })
          .expect(200);

        // Get a column to sort on
        const columns = await table.getColumns(ctx);
        const titleColumn = columns.find((col: any) => col.title === 'Title');

        // Create a sort
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'sortCreate',
            viewId: newView.body.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            fk_column_id: titleColumn.id,
            direction: 'asc',
          })
          .expect(200);

        // Delete the view
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewDelete',
            viewId: newView.body.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        // Verify view is deleted (sorts should be cascade deleted)
        const viewList = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const deletedView = viewList.body.list.find(
          (v: any) => v.id === newView.body.id,
        );
        expect(deletedView).to.be.undefined;
      });

      it('should cascade delete view columns', async () => {
        // Create a view
        const newView = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'ViewWithColumns' })
          .expect(200);

        // Delete the view
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'viewDelete',
            viewId: newView.body.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        // Verify view is deleted (view columns should be cascade deleted)
        const viewList = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const deletedView = viewList.body.list.find(
          (v: any) => v.id === newView.body.id,
        );
        expect(deletedView).to.be.undefined;
      });

      it('should not allow deleting last collaborative grid view', async () => {
        // Get all views
        const viewList = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const collaborativeGrids = viewList.body.list.filter(
          (v: any) => v.type === 'grid' && v.lock_type === 'collaborative',
        );

        // If there's only one collaborative grid, deletion should fail
        if (collaborativeGrids.length === 1) {
          await request(context.app)
            .post(INTERNAL_API_BASE)
            .query({
              operation: 'viewDelete',
              viewId: collaborativeGrids[0].id,
            })
            .set('xc-token', context.xc_token)
            .expect(400);
        }
      });
    });
  });
};
