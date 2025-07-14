import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../init';

export default function () {
  describe(`error-handling: Table v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let API_PREFIX;

    beforeEach(async () => {
      context = await init();
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

    describe('table create', () => {
      it(`will create email column with validation true`, async () => {
        const table = {
          title: 'Table Email',
          description: 'Description',
          fields: [
            {
              title: 'Email',
              type: 'Email',
              default_value: 'user@nocodb.com',
              options: {
                validation: true,
              },
            },
          ],
        };

        const response = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-auth', context.token)
          .send(table)
          .expect(200);

        const emailField = response.body.fields.find(
          (f) => f.title === 'Email',
        );

        expect(emailField.options.validation).to.eq(true);
        expect(emailField.default_value).to.eq('user@nocodb.com');
      });
    });
  });
}
