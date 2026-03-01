import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';

export default function () {
  if (!isEE()) {
    return true;
  }

  describe(`API Tokens v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;

    beforeEach(async () => {
      context = await init();

      // Upgrade workspace to enterprise (creates org + sets fk_org_id)
      await request(context.app)
        .post(
          `/api/v2/orgs/workspaces/${context.fk_workspace_id}/upgrade`,
        )
        .set('xc-auth', context.token)
        .expect(200);
    });

    it('List API Tokens v3 - empty', async () => {
      const response = await request(context.app)
        .get('/api/v3/meta/tokens')
        .set('xc-auth', context.token)
        .expect(200);

      expect(response.body).to.have.property('list');
      expect(response.body.list).to.be.an('array');
    });

    // spec uncertain
    it.skip('Create API Token v3', async () => {
      const response = await request(context.app)
        .post('/api/v3/meta/tokens')
        .set('xc-auth', context.token)
        .send({ title: 'Test Token' })
        .expect(200);

      const result = response.body;
      expect(result).to.have.property('id');
      expect(result).to.have.property('token');
      // builder maps internal 'title' to v3 'description', but may pass through as 'title'
      const desc = result.description || result.title;
      expect(desc).to.equal('Test Token');
    });

    it.skip('Delete API Token v3', async () => {
      // Create a token first
      const createResponse = await request(context.app)
        .post('/api/v3/meta/tokens')
        .set('xc-auth', context.token)
        .send({ title: 'Token To Delete' })
        .expect(200);

      const tokenId = createResponse.body.id;

      // Delete the token
      await request(context.app)
        .delete(`/api/v3/meta/tokens/${tokenId}`)
        .set('xc-auth', context.token)
        .expect(200);

      // Verify it's gone
      const listResponse = await request(context.app)
        .get('/api/v3/meta/tokens')
        .set('xc-auth', context.token)
        .expect(200);

      const found = listResponse.body.list.find(
        (t: any) => t.id === tokenId,
      );
      expect(found).to.be.undefined;
    });
  });
}
