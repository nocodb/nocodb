import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes, ViewTypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

export const viewCreateTypesTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Internal API - View Create Types', () => {
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
      workspaceId = context.fk_workspace_id;

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

      // Create table with multiple field types including Geo
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
            // TODO: fix GeoData column in swagger v3
            // { title: 'GeoData', type: 'GeoData' },
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

    describe('gridViewCreate (POST)', () => {
      it('should create basic grid view', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'BasicGridView' })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.id).to.exist;
        expect(response.body.title).to.eq('BasicGridView');
        expect(response.body.type).to.eq(ViewTypes.GRID);
        expect(response.body.fk_model_id).to.eq(table.id);
      });

      it('should create grid view with groups configuration', async () => {
        // Get a column to group by (SingleSelect)
        const columns = await table.getColumns(ctx);
        const singleSelectCol = columns.find(
          (c: any) => c.uidt === 'SingleSelect',
        );

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'GroupedGridView',
            meta: {
              groups: [{ fk_column_id: singleSelectCol.id }],
            },
          })
          .expect(200);

        expect(response.body.title).to.eq('GroupedGridView');
        expect(response.body.meta).to.be.an('object');
        expect(response.body.meta.groups).to.be.an('array');
        expect(response.body.meta.groups[0].fk_column_id).to.eq(
          singleSelectCol.id,
        );
      });

      it('should create grid view with custom row height', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'CustomHeightGridView',
            meta: {
              row_height: 2,
            },
          })
          .expect(200);

        expect(response.body.title).to.eq('CustomHeightGridView');
        expect(response.body.meta).to.be.an('object');
        expect(response.body.meta.row_height).to.eq(2);
      });

      it.skip('should create grid view copying from existing view', async () => {
        // First get the default view
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
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'CopiedGridView',
            copy_from_id: defaultView.id,
          })
          .expect(200);

        expect(response.body.title).to.eq('CopiedGridView');
        expect(response.body.type).to.eq(ViewTypes.GRID);
        // Verify it has the same fk_model_id as source
        expect(response.body.fk_model_id).to.eq(defaultView.fk_model_id);
      });

      it('should verify grid view appears in viewList', async () => {
        // Create a new grid view
        const createResponse = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'gridViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'ListTestGridView' })
          .expect(200);

        // Verify it appears in viewList
        const listResponse = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const foundView = listResponse.body.list.find(
          (v: any) => v.id === createResponse.body.id,
        );
        expect(foundView).to.exist;
        expect(foundView.title).to.eq('ListTestGridView');
      });
    });

    describe('formViewCreate (POST)', () => {
      it('should create basic form view', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'formViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'BasicFormView' })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.id).to.exist;
        expect(response.body.title).to.eq('BasicFormView');
        expect(response.body.type).to.eq(ViewTypes.FORM);
        expect(response.body.fk_model_id).to.eq(table.id);
      });

      it('should create form view with field configuration', async () => {
        // Get columns
        const columns = await table.getColumns(ctx);
        const titleCol = columns.find((c: any) => c.title === 'Title');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'formViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'ConfiguredFormView',
            meta: {
              submit_button_label: 'Submit Form',
              success_msg: 'Form submitted successfully!',
            },
            columns: [
              {
                fk_column_id: titleCol.id,
                label: 'Your Title',
                required: true,
                show: true,
              },
            ],
          })
          .expect(200);

        expect(response.body.title).to.eq('ConfiguredFormView');
        expect(response.body.meta).to.be.an('object');
        expect(response.body.meta.submit_button_label).to.eq('Submit Form');
        expect(response.body.meta.success_msg).to.eq(
          'Form submitted successfully!',
        );
      });

      // TODO: backend - form view response doesn't include lock_type/show_system_fields
      it.skip('should verify form view has proper defaults', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'formViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'DefaultFormView' })
          .expect(200);

        expect(response.body.type).to.eq(ViewTypes.FORM);
        expect(response.body.lock_type).to.exist;
        expect(response.body.show_system_fields).to.exist;
        // Verify it appears in viewList
        const listResponse = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const foundView = listResponse.body.list.find(
          (v: any) => v.id === response.body.id,
        );
        expect(foundView).to.exist;
        expect(foundView.type).to.eq(ViewTypes.FORM);
      });
    });

    // TODO: fix API response - form view data structure issues
    describe.skip('formViewGet (GET)', () => {
      it('should get form view details', async () => {
        // Create a form view first
        const createResponse = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'formViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'DetailFormView',
            meta: {
              submit_button_label: 'Submit',
            },
          })
          .expect(200);

        // Get form view details
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'formViewGet',
            formViewId: createResponse.body.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.id).to.eq(createResponse.body.id);
        expect(response.body.title).to.eq('DetailFormView');
        expect(response.body.type).to.eq(ViewTypes.FORM);
        expect(response.body.meta).to.be.an('object');
        expect(response.body.meta.submit_button_label).to.eq('Submit');
      });

      it('should return 404 with invalid formId', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'formViewGet',
            formViewId: 'invalid-form-id',
          })
          .set('xc-token', context.xc_token)
          .expect(404);
      });
    });

    describe('galleryViewCreate (POST)', () => {
      it('should create basic gallery view', async () => {
        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'galleryViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({ title: 'BasicGalleryView' })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.id).to.exist;
        expect(response.body.title).to.eq('BasicGalleryView');
        expect(response.body.type).to.eq(ViewTypes.GALLERY);
        expect(response.body.fk_model_id).to.eq(table.id);
      });

      it('should create gallery view with cover_field_id', async () => {
        // Get Attachment column for cover
        const columns = await table.getColumns(ctx);
        const attachmentCol = columns.find((c: any) => c.uidt === 'Attachment');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'galleryViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'CoverGalleryView',
            meta: {
              fk_cover_image_col_id: attachmentCol.id,
            },
          })
          .expect(200);

        expect(response.body.title).to.eq('CoverGalleryView');
        expect(response.body.type).to.eq(ViewTypes.GALLERY);
        expect(response.body.meta).to.be.an('object');
        expect(response.body.meta.fk_cover_image_col_id).to.eq(
          attachmentCol.id,
        );
      });

      // TODO: backend - cover column not automatically set to visible in gallery view
      it.skip('should verify gallery shows cover + 3 columns', async () => {
        // Get columns
        const columns = await table.getColumns(ctx);
        const attachmentCol = columns.find((c: any) => c.uidt === 'Attachment');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'galleryViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'VerifiedGalleryView',
            meta: {
              fk_cover_image_col_id: attachmentCol.id,
            },
          })
          .expect(200);

        // Get view columns to verify visibility
        const columnsResponse = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewColumnList',
            viewId: response.body.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(columnsResponse.body.list).to.be.an('array');
        // Cover column should be visible
        const coverCol = columnsResponse.body.list.find(
          (vc: any) => vc.fk_column_id === attachmentCol.id,
        );
        expect(coverCol).to.exist;
        expect(coverCol.show).to.be.true;
      });

      // TODO: backend - add validation for invalid fk_cover_image_col_id
      it.skip('should return 400 with invalid cover field', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'galleryViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'InvalidCoverGalleryView',
            meta: {
              fk_cover_image_col_id: 'invalid-column-id',
            },
          })
          .expect(400);
      });
    });

    describe('kanbanViewCreate (POST)', () => {
      it('should create kanban view with stack_by (SingleSelect field)', async () => {
        // Get SingleSelect column for stacking
        const columns = await table.getColumns(ctx);
        const singleSelectCol = columns.find(
          (c: any) => c.uidt === 'SingleSelect',
        );

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'kanbanViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'BasicKanbanView',
            meta: {
              fk_grp_col_id: singleSelectCol.id,
            },
          })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.id).to.exist;
        expect(response.body.title).to.eq('BasicKanbanView');
        expect(response.body.type).to.eq(ViewTypes.KANBAN);
        expect(response.body.fk_model_id).to.eq(table.id);
        expect(response.body.meta).to.be.an('object');
        expect(response.body.meta.fk_grp_col_id).to.eq(singleSelectCol.id);
      });

      it('should create kanban with grouping column', async () => {
        // Get SingleSelect column for grouping
        const columns = await table.getColumns(ctx);
        const singleSelectCol = columns.find(
          (c: any) => c.uidt === 'SingleSelect',
        );

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'kanbanViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'GroupedKanbanView',
            meta: {
              fk_grp_col_id: singleSelectCol.id,
            },
          })
          .expect(200);

        expect(response.body.title).to.eq('GroupedKanbanView');
        expect(response.body.meta.fk_grp_col_id).to.eq(singleSelectCol.id);

        // Verify it appears in viewList
        const listResponse = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const foundView = listResponse.body.list.find(
          (v: any) => v.id === response.body.id,
        );
        expect(foundView).to.exist;
        expect(foundView.type).to.eq(ViewTypes.KANBAN);
      });

      // TODO: backend - grouping/cover columns not automatically set to visible in kanban
      it.skip('should verify kanban shows grouping + cover + 3 columns', async () => {
        // Get columns
        const columns = await table.getColumns(ctx);
        const singleSelectCol = columns.find(
          (c: any) => c.uidt === 'SingleSelect',
        );
        const attachmentCol = columns.find((c: any) => c.uidt === 'Attachment');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'kanbanViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'VerifiedKanbanView',
            meta: {
              fk_grp_col_id: singleSelectCol.id,
              fk_cover_image_col_id: attachmentCol.id,
            },
          })
          .expect(200);

        // Get view columns to verify visibility
        const columnsResponse = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewColumnList',
            viewId: response.body.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(columnsResponse.body.list).to.be.an('array');

        // Grouping column should be visible
        const grpCol = columnsResponse.body.list.find(
          (vc: any) => vc.fk_column_id === singleSelectCol.id,
        );
        expect(grpCol).to.exist;
        expect(grpCol.show).to.be.true;

        // Cover column should be visible
        const coverCol = columnsResponse.body.list.find(
          (vc: any) => vc.fk_column_id === attachmentCol.id,
        );
        expect(coverCol).to.exist;
        expect(coverCol.show).to.be.true;
      });

      // TODO: backend - require fk_grp_col_id for kanban views
      it.skip('should return 400 without grouping column', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'kanbanViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'InvalidKanbanView',
            // Missing fk_grp_col_id
          })
          .expect(400);
      });

      // TODO: backend - validate fk_grp_col_id must be SingleSelect/MultiSelect
      it.skip('should return 400 with invalid field type', async () => {
        // Get a non-SingleSelect column (e.g., Number)
        const columns = await table.getColumns(ctx);
        const numberCol = columns.find((c: any) => c.uidt === 'Number');

        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'kanbanViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'InvalidTypeKanbanView',
            meta: {
              fk_grp_col_id: numberCol.id, // Wrong type - should be SingleSelect
            },
          })
          .expect(400);
      });
    });

    // TODO: fix GeoData column in swagger v3
    describe.skip('mapViewCreate (POST)', () => {
      it('should create basic map view (requires geo data column)', async () => {
        // Get GeoData column
        const columns = await table.getColumns(ctx);
        const geoCol = columns.find((c: any) => c.uidt === 'GeoData');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'mapViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'BasicMapView',
            meta: {
              fk_geo_data_col_id: geoCol.id,
            },
          })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.id).to.exist;
        expect(response.body.title).to.eq('BasicMapView');
        expect(response.body.type).to.eq(ViewTypes.MAP);
        expect(response.body.fk_model_id).to.eq(table.id);
        expect(response.body.meta).to.be.an('object');
        expect(response.body.meta.fk_geo_data_col_id).to.eq(geoCol.id);
      });

      it('should verify geo column always visible', async () => {
        // Get GeoData column
        const columns = await table.getColumns(ctx);
        const geoCol = columns.find((c: any) => c.uidt === 'GeoData');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'mapViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'VerifiedMapView',
            meta: {
              fk_geo_data_col_id: geoCol.id,
            },
          })
          .expect(200);

        // Get view columns to verify geo column is visible
        const columnsResponse = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewColumnList',
            viewId: response.body.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(columnsResponse.body.list).to.be.an('array');

        // Geo column should be visible
        const geoViewCol = columnsResponse.body.list.find(
          (vc: any) => vc.fk_column_id === geoCol.id,
        );
        expect(geoViewCol).to.exist;
        expect(geoViewCol.show).to.be.true;
      });

      it('should return 400 without geo column', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'mapViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'InvalidMapView',
            // Missing fk_geo_data_col_id
          })
          .expect(400);
      });
    });

    // TODO: fix GeoData column in swagger v3
    describe.skip('mapViewGet (GET)', () => {
      it('should get map view details', async () => {
        // Get GeoData column
        const columns = await table.getColumns(ctx);
        const geoCol = columns.find((c: any) => c.uidt === 'GeoData');

        // Create a map view first
        const createResponse = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'mapViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'DetailMapView',
            meta: {
              fk_geo_data_col_id: geoCol.id,
            },
          })
          .expect(200);

        // Get map view details
        const response = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'mapViewGet',
            mapViewId: createResponse.body.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.id).to.eq(createResponse.body.id);
        expect(response.body.title).to.eq('DetailMapView');
        expect(response.body.type).to.eq(ViewTypes.MAP);
        expect(response.body.meta).to.be.an('object');
        expect(response.body.meta.fk_geo_data_col_id).to.eq(geoCol.id);
      });

      it('should return 404 with invalid mapId', async () => {
        await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'mapViewGet',
            mapViewId: 'invalid-map-id',
          })
          .set('xc-token', context.xc_token)
          .expect(404);
      });
    });

    describe('calendarViewCreate (POST)', () => {
      it('should create calendar with date range', async () => {
        // Get DateTime column
        const columns = await table.getColumns(ctx);
        const dateTimeCol = columns.find((c: any) => c.uidt === 'DateTime');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'calendarViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'BasicCalendarView',
            calendar_range: [
              {
                fk_from_col_id: dateTimeCol.id,
              },
            ],
          })
          .expect(200);

        expect(response.body).to.be.an('object');
        expect(response.body.id).to.exist;
        expect(response.body.title).to.eq('BasicCalendarView');
        expect(response.body.type).to.eq(ViewTypes.CALENDAR);
        expect(response.body.fk_model_id).to.eq(table.id);
      });

      it('should create calendar with start and end date fields', async () => {
        // Get DateTime column
        const columns = await table.getColumns(ctx);
        const dateTimeCol = columns.find((c: any) => c.uidt === 'DateTime');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'calendarViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'RangeCalendarView',
            calendar_range: [
              {
                fk_from_col_id: dateTimeCol.id,
                fk_to_col_id: dateTimeCol.id,
              },
            ],
          })
          .expect(200);

        expect(response.body.title).to.eq('RangeCalendarView');
        expect(response.body.type).to.eq(ViewTypes.CALENDAR);

        // Verify it appears in viewList
        const listResponse = await request(context.app)
          .get(INTERNAL_API_BASE)
          .query({
            operation: 'viewList',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .expect(200);

        const foundView = listResponse.body.list.find(
          (v: any) => v.id === response.body.id,
        );
        expect(foundView).to.exist;
        expect(foundView.type).to.eq(ViewTypes.CALENDAR);
      });

      // TODO: backend - calendar_range not included in API response
      it.skip('should verify date range configuration', async () => {
        // Get DateTime column
        const columns = await table.getColumns(ctx);
        const dateTimeCol = columns.find((c: any) => c.uidt === 'DateTime');

        const response = await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'calendarViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'ConfiguredCalendarView',
            calendar_range: [
              {
                fk_from_col_id: dateTimeCol.id,
                fk_to_col_id: dateTimeCol.id,
              },
            ],
          })
          .expect(200);

        expect(response.body.calendar_range).to.be.an('array');
        expect(response.body.calendar_range.length).to.be.greaterThan(0);
        expect(response.body.calendar_range[0].fk_from_col_id).to.eq(
          dateTimeCol.id,
        );
        expect(response.body.calendar_range[0].fk_to_col_id).to.eq(
          dateTimeCol.id,
        );
      });

      // TODO: backend - require calendar_range for calendar views
      it.skip('should return 400 without date range', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'calendarViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'InvalidCalendarView',
            // Missing calendar_range
          })
          .expect(400);
      });

      // TODO: backend - validate calendar_range field IDs
      it.skip('should return 400 with invalid date fields', async () => {
        await request(context.app)
          .post(INTERNAL_API_BASE)
          .query({
            operation: 'calendarViewCreate',
            tableId: table.id,
          })
          .set('xc-token', context.xc_token)
          .send({
            title: 'InvalidDateCalendarView',
            calendar_range: [
              {
                fk_from_col_id: 'invalid-column-id',
              },
            ],
          })
          .expect(400);
      });
    });
  });
};
