import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../init';

export default function () {
  describe(`Table v3`, () => {
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
          title: 'Table_Email',
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

      it(`will create number column with default value`, async () => {
        const table = {
          title: 'Table Number',
          description: 'Description',
          fields: [
            {
              title: 'Number',
              type: 'Number',
              default_value: 34,
              options: {
                locale_string: true,
              },
            },
          ],
        };

        const response = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-auth', context.token)
          .send(table)
          .expect(200);

        const numberField = response.body.fields.find(
          (f) => f.title === 'Number',
        );

        expect(numberField.default_value).to.eq('34');
        expect(numberField.options.locale_string).to.eq(true);
      });

      it(`will create checkbox column with default value`, async () => {
        const table = {
          title: 'Table Checkbox',
          description: 'Description',
          fields: [
            {
              title: 'Checkbox',
              type: 'Checkbox',
              default_value: true,
            },
          ],
        };

        const response = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-auth', context.token)
          .send(table)
          .expect(200);

        const checkboxField = response.body.fields.find(
          (f) => f.title === 'Checkbox',
        );

        expect(checkboxField.default_value).to.satisfy((val) => val === 'true' || val === '1' || val === 1);
      });
    });

    describe('table list', () => {
      it(`will list tables in a base`, async () => {
        // Create multiple tables
        await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({ title: 'Table_A' })
          .expect(200);

        await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({ title: 'Table_B' })
          .expect(200);

        await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({ title: 'Table_C' })
          .expect(200);

        const response = await request(context.app)
          .get(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .expect(200);

        const tables = response.body.list;
        expect(tables).to.be.an('array');
        expect(tables).to.have.lengthOf(3);

        // Verify each table has expected properties
        for (const table of tables) {
          expect(table).to.have.property('id');
          expect(table).to.have.property('title');
          expect(table).to.have.property('base_id');
        }

        // Verify the created tables are present
        const titles = tables.map((t) => t.title);
        expect(titles).to.include.members(['Table_A', 'Table_B', 'Table_C']);
      });

      it(`will return empty list for base with no tables`, async () => {
        const response = await request(context.app)
          .get(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .expect(200);

        const tables = response.body.list;
        expect(tables).to.be.an('array').that.is.empty;
      });
    });

    describe('table get', () => {
      it(`will get a table by id`, async () => {
        const createResponse = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'GetTestTable',
            description: 'A test table',
            fields: [
              {
                title: 'Name',
                type: 'SingleLineText',
              },
            ],
          })
          .expect(200);

        const tableId = createResponse.body.id;

        const getResponse = await request(context.app)
          .get(`${API_PREFIX}/tables/${tableId}`)
          .set('xc-token', context.xc_token)
          .expect(200);

        const table = getResponse.body;
        expect(table).to.have.property('id', tableId);
        expect(table).to.have.property('title', 'GetTestTable');
        expect(table).to.have.property('description', 'A test table');
        expect(table).to.have.property('base_id');
        expect(table).to.have.property('source_id');

        // Should include fields
        expect(table).to.have.property('fields');
        expect(table.fields).to.be.an('array').that.is.not.empty;

        // Should include the user-created field
        const nameField = table.fields.find((f) => f.title === 'Name');
        expect(nameField).to.not.be.undefined;
        expect(nameField.type).to.eq('SingleLineText');

        // Should include views
        expect(table).to.have.property('views');
        expect(table.views).to.be.an('array').that.is.not.empty;
      });
    });

    describe('table delete', () => {
      it(`will delete a table`, async () => {
        const createResponse = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({ title: 'DeleteTestTable' })
          .expect(200);

        const tableId = createResponse.body.id;

        // Delete the table
        await request(context.app)
          .delete(`${API_PREFIX}/tables/${tableId}`)
          .set('xc-token', context.xc_token)
          .expect(200);

        // Verify the table is no longer accessible
        await request(context.app)
          .get(`${API_PREFIX}/tables/${tableId}`)
          .set('xc-token', context.xc_token)
          .expect(422);
      });

      it(`will remove deleted table from list`, async () => {
        const createResponse = await request(context.app)
          .post(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .send({ title: 'ToBeDeleted' })
          .expect(200);

        const tableId = createResponse.body.id;

        // Verify it appears in list
        const listBefore = await request(context.app)
          .get(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(listBefore.body.list.some((t) => t.id === tableId)).to.be.true;

        // Delete the table
        await request(context.app)
          .delete(`${API_PREFIX}/tables/${tableId}`)
          .set('xc-token', context.xc_token)
          .expect(200);

        // Verify it no longer appears in list
        const listAfter = await request(context.app)
          .get(`${API_PREFIX}/tables`)
          .set('xc-token', context.xc_token)
          .expect(200);

        expect(listAfter.body.list.some((t) => t.id === tableId)).to.be.false;
      });
    });
  });
}
