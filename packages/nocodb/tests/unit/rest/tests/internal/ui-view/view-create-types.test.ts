import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { PlanFeatureTypes } from 'nocodb-sdk';
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
            { title: 'GeoData', type: 'GeoData' },
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
      it.skip('should create basic grid view', async () => {
        // TODO: Implement
      });

      it.skip('should create grid view with groups configuration', async () => {
        // TODO: Implement
      });

      it.skip('should create grid view with custom row height', async () => {
        // TODO: Implement
      });

      it.skip('should create grid view copying from existing view', async () => {
        // TODO: Implement
      });

      it.skip('should verify grid view appears in viewList', async () => {
        // TODO: Implement
      });
    });

    describe('formViewCreate (POST)', () => {
      it.skip('should create basic form view', async () => {
        // TODO: Implement
      });

      it.skip('should create form view with field configuration', async () => {
        // TODO: Implement
      });

      it.skip('should verify form view has proper defaults', async () => {
        // TODO: Implement
      });
    });

    describe('formViewGet (GET)', () => {
      it.skip('should get form view details', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid formId', async () => {
        // TODO: Implement
      });
    });

    describe('galleryViewCreate (POST)', () => {
      it.skip('should create basic gallery view', async () => {
        // TODO: Implement
      });

      it.skip('should create gallery view with cover_field_id', async () => {
        // TODO: Implement
      });

      it.skip('should verify gallery shows cover + 3 columns', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid cover field', async () => {
        // TODO: Implement
      });
    });

    describe('kanbanViewCreate (POST)', () => {
      it.skip('should create kanban view with stack_by (SingleSelect field)', async () => {
        // TODO: Implement
      });

      it.skip('should create kanban with grouping column', async () => {
        // TODO: Implement
      });

      it.skip('should verify kanban shows grouping + cover + 3 columns', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 without grouping column', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid field type', async () => {
        // TODO: Implement
      });
    });

    describe('mapViewCreate (POST)', () => {
      it.skip('should create basic map view (requires geo data column)', async () => {
        // TODO: Implement
      });

      it.skip('should verify geo column always visible', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 without geo column', async () => {
        // TODO: Implement
      });
    });

    describe('mapViewGet (GET)', () => {
      it.skip('should get map view details', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid mapId', async () => {
        // TODO: Implement
      });
    });

    describe('calendarViewCreate (POST)', () => {
      it.skip('should create calendar with date range', async () => {
        // TODO: Implement
      });

      it.skip('should create calendar with start and end date fields', async () => {
        // TODO: Implement
      });

      it.skip('should verify date range configuration', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 without date range', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 with invalid date fields', async () => {
        // TODO: Implement
      });
    });
  });
}
