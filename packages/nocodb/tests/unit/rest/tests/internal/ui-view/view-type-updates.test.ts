import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { overrideFeature } from '../../../../utils/plan.utils';
import { Base, Model } from '~/models';
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

      // Create table
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

    describe('gridViewUpdate (POST)', () => {
      it.skip('should update grid row height', async () => {
        // TODO: Implement
      });

      it.skip('should update grid groups configuration', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 when updating non-grid view', async () => {
        // TODO: Implement
      });
    });

    describe('formViewUpdate (POST)', () => {
      it.skip('should update form view settings', async () => {
        // TODO: Implement
      });

      it.skip('should update form field configuration', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 when updating non-form view', async () => {
        // TODO: Implement
      });
    });

    describe('formColumnUpdate (POST)', () => {
      it.skip('should update form column (label, help, required)', async () => {
        // TODO: Implement
      });

      it.skip('should update form column scanner settings', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid columnId', async () => {
        // TODO: Implement
      });
    });

    describe('galleryViewUpdate (POST)', () => {
      it.skip('should update gallery cover_field_id', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 when updating non-gallery view', async () => {
        // TODO: Implement
      });
    });

    describe('kanbanViewUpdate (POST)', () => {
      it.skip('should update kanban stack_by field', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 when updating non-kanban view', async () => {
        // TODO: Implement
      });
    });

    describe('mapViewUpdate (POST)', () => {
      it.skip('should update map geo data column', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });
    });

    describe('calendarViewUpdate (POST)', () => {
      it.skip('should update calendar date ranges', async () => {
        // TODO: Implement
      });

      it.skip('should return 404 with invalid viewId', async () => {
        // TODO: Implement
      });

      it.skip('should return 400 when updating non-calendar view', async () => {
        // TODO: Implement
      });
    });
  });
}
