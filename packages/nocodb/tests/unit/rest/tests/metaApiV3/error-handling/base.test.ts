import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { createUser } from '../../../../factory/user';

export default function () {
  describe(`Base v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;

    beforeEach(async () => {
      context = await init();
    });

    describe.only('create base', () => {
      const API_PREFIX = '/api/v3/meta/workspaces'
      it('will handle workspace not found', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/NOT_EXISTS_WS/bases`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyBase'
          })
          .expect(404);

        expect(result.body.error).to.eq('WORKSPACE_NOT_FOUND')
        expect(result.body.message).to.eq(`Workspace 'NOT_EXISTS_WS' not found`)
      })

      it('will handle user has no access', async () => {
        const workspaceId = context.fk_workspace_id;
        const { token, user } = await createUser({ app: context.app }, {
          email: 'test2@example.com',
          password: 'A1234abh2@dsad',
          roles: 'editor'
        });

        const xc_token = (
          await request(context.app)
            .post('/api/v1/tokens/')
            .set('xc-auth', token)
            .expect(200)
        ).body.token;

        const result = await request(context.app)
          .post(`${API_PREFIX}/${workspaceId}/bases`)
          .set('xc-token', xc_token)
          .send({
            title: 'MyBase'
          })
          .expect(403);

        expect(result.body.error).to.eq('FORBIDDEN')
        expect(result.body.message.startsWith('Forbidden - You do not have permission to perform the action "baseCreate" ')).to.eq(true)
      })

      it.only('will base title empty', async () => {
        const workspaceId = context.fk_workspace_id;
        const result = await request(context.app)
          .post(`${API_PREFIX}/${workspaceId}/bases`)
          .set('xc-token', context.xc_token)
          .send({
            title: ''
          })
          .expect(400);
        console.log(result.body)
        expect(result.body.error).to.eq('WORKSPACE_NOT_FOUND')
        expect(result.body.message).to.eq(`Invalid request body`)
      })
    })
  });
}
