import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../../init';
import { createUser } from '../../../../factory/user';

export default function () {
  describe(`error-handling: Base v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;

    beforeEach(async () => {
      context = await init();
    });

    describe('base create', () => {
      const API_PREFIX = '/api/v3/meta/workspaces';
      it('will handle workspace not found', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/NOT_EXISTS_WS/bases`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyBase',
          })
          .expect(404);

        expect(result.body.error).to.eq('WORKSPACE_NOT_FOUND');
        expect(result.body.message).to.eq(
          `Workspace 'NOT_EXISTS_WS' not found`,
        );
      });

      it('will handle user has no access', async () => {
        const workspaceId = context.fk_workspace_id;
        const { token } = await createUser(
          { app: context.app },
          {
            email: 'test2@example.com',
            password: 'A1234abh2@dsad',
            roles: 'editor',
          },
        );

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
            title: 'MyBase',
          })
          .expect(403);

        expect(result.body.error).to.eq('FORBIDDEN');
        expect(
          result.body.message.startsWith(
            'Forbidden - You do not have permission to perform the action "baseCreate" ',
          ),
        ).to.eq(true);
      });

      it('will handle base title empty', async () => {
        const workspaceId = context.fk_workspace_id;
        const result = await request(context.app)
          .post(`${API_PREFIX}/${workspaceId}/bases`)
          .set('xc-token', context.xc_token)
          .send({
            title: '',
          })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.eq(`Invalid request body`);
      });
    });

    describe('base get', () => {
      it('will get non existed base', async () => {
        const result = await request(context.app)
          .get(`/api/v3/meta/bases/NOT_FOUND_BASE`)
          .set('xc-token', context.xc_token)
          .expect(422);
        expect(result.body.error).to.eq('BASE_NOT_FOUND');
        expect(result.body.message).to.eq(`Base 'NOT_FOUND_BASE' not found`);
      });
    });

    describe('base update', () => {
      let API_PREFIX = '/api/v3/meta/workspaces';
      let initBase: any;
      beforeEach(async () => {
        const workspaceId = context.fk_workspace_id;
        const baseResult = await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyBase',
          })
          .expect(200);
        initBase = baseResult.body;
        API_PREFIX = `/api/v3/meta/bases/${initBase.id}`;
      });

      it('will update not existed base', async () => {
        const result = await request(context.app)
          .patch(`/api/v3/meta/bases/NOT_FOUND_BASE`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'HELLO',
          })
          .expect(422);
        expect(result.body.error).to.eq('BASE_NOT_FOUND');
        expect(result.body.message).to.eq(`Base 'NOT_FOUND_BASE' not found`);
      });

      it('will update empty title', async () => {
        const result = await request(context.app)
          .patch(`${API_PREFIX}`)
          .set('xc-token', context.xc_token)
          .send({
            title: '',
          })
          .expect(400);
        expect(result.body.error).to.eq('INVALID_REQUEST_BODY');
        expect(result.body.message).to.eq(`Invalid request body`);
      });
    });

    describe('base delete', () => {
      let initBase: any;
      beforeEach(async () => {
        const workspaceId = context.fk_workspace_id;
        const baseResult = await request(context.app)
          .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'MyBase',
          })
          .expect(200);
        initBase = baseResult.body;
      });

      it('will delete not existed base', async () => {
        const result = await request(context.app)
          .delete(`/api/v3/meta/bases/NOT_FOUND_BASE`)
          .set('xc-token', context.xc_token)
          .expect(422);
        expect(result.body.error).to.eq('BASE_NOT_FOUND');
        expect(result.body.message).to.eq(`Base 'NOT_FOUND_BASE' not found`);
      });
    });
  });
}
