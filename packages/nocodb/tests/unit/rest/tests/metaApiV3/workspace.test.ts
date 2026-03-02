import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { overrideFeature } from '../../../utils/plan.utils';

export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`Workspace v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;
    let featureMock: any;

    beforeEach(async () => {
      context = await init();

      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT}`,
        allowed: true,
      });
    });

    afterEach(() => {
      featureMock?.restore();
    });

    it('List Workspaces v3', async () => {
      const response = await request(context.app)
        .get('/api/v3/meta/workspaces')
        .set('xc-auth', context.token)
        .expect(200);

      expect(response.body).to.have.property('list');
      expect(response.body.list).to.be.an('array').that.is.not.empty;

      const workspace = response.body.list[0];
      expect(workspace).to.have.property('id');
      expect(workspace).to.have.property('title');
    });

    it('Create Workspace v3', async () => {
      const response = await request(context.app)
        .post('/api/v3/meta/workspaces')
        .set('xc-auth', context.token)
        .send({ title: 'New Test Workspace' })
        .expect(201);

      const result = response.body;
      expect(result).to.have.property('id');
      expect(result).to.have.property('title', 'New Test Workspace');
    });

    it('Read Workspace v3', async () => {
      const response = await request(context.app)
        .get(`/api/v3/meta/workspaces/${context.fk_workspace_id}`)
        .set('xc-auth', context.token)
        .expect(200);

      const result = response.body;
      expect(result).to.have.property('id', context.fk_workspace_id);
      expect(result).to.have.property('title');
    });

    it('Update Workspace v3', async () => {
      const response = await request(context.app)
        .patch(`/api/v3/meta/workspaces/${context.fk_workspace_id}`)
        .set('xc-auth', context.token)
        .send({ title: 'Updated Workspace Title' })
        .expect(200);

      const result = response.body;
      expect(result).to.have.property('id');
      expect(result).to.have.property('title', 'Updated Workspace Title');
    });

    it('Delete Workspace v3', async () => {
      // The init workspace has an active subscription from overrideFeature,
      // so workspace delete is blocked by the subscription check.
      // We verify the endpoint routes correctly by confirming it reaches
      // the service logic (400 with subscription error, not 404).
      const delResp = await request(context.app)
        .delete(`/api/v3/meta/workspaces/${context.fk_workspace_id}`)
        .set('xc-auth', context.token);

      expect(delResp.status).to.equal(400);
      expect(delResp.body).to.have.property('msg');
      expect(delResp.body.msg).to.include('active subscription');
    });
  });
}
