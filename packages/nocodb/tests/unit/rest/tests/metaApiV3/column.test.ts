import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import init from '../../../init';

export default function () {
  describe('Column v3', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let API_PREFIX: string;
    let table: any;

    beforeEach(async () => {
      context = await init();
      const workspaceId = context.fk_workspace_id;
      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({ title: 'MyBase' })
        .expect(200);
      initBase = baseResult.body;
      API_PREFIX = `/api/v3/meta/bases/${initBase.id}`;
      // create a table for column tests
      const tableResult = await request(context.app)
        .post(`${API_PREFIX}/tables`)
        .set('xc-token', context.xc_token)
        .send({ title: 'MyTable' })
        .expect(200);
      table = tableResult.body;
    });

    describe('column create', () => {
      it('will handle SingleLineText field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FSingleLineText', type: 'SingleLineText' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FSingleLineText');
      });

      it('will handle LongText field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FLongText', type: 'LongText' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FLongText');
      });

      it('will handle PhoneNumber field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FPhoneNumber', type: 'PhoneNumber' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FPhoneNumber');
      });

      it('will handle URL field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FURL', type: 'URL' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FURL');
      });

      it('will handle Email field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FEmail', type: 'Email' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FEmail');
      });

      it('will handle Number field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FNumber', type: 'Number' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FNumber');
      });

      it('will handle Decimal field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FDecimal', type: 'Decimal' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FDecimal');
      });

      it('will handle Currency field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FCurrency', type: 'Currency' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FCurrency');
      });

      it('will handle Percent field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FPercent', type: 'Percent' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FPercent');
      });

      it('will handle Duration field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FDuration', type: 'Duration' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FDuration');
      });

      it('will handle Date field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FDate', type: 'Date' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FDate');
      });

      it('will handle DateTime field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FDateTime', type: 'DateTime' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FDateTime');
      });

      it('will handle Time field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FTime', type: 'Time' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FTime');
      });

      it('will handle SingleSelect field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'FSingleSelect',
            type: 'SingleSelect',
            options: {
              choices: [
                { title: 'Option1', color: '#ff0000' },
                { title: 'Option2', color: '#00ff00' },
              ],
            },
          })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FSingleSelect');
      });

      it('will handle MultiSelect field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({
            title: 'FMultiSelect',
            type: 'MultiSelect',
            options: {
              choices: [
                { title: 'Option1', color: '#ff0000' },
                { title: 'Option2', color: '#00ff00' },
              ],
            },
          })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FMultiSelect');
      });

      it('will handle Rating field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FRating', type: 'Rating' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FRating');
      });

      it('will handle Checkbox field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FCheckbox', type: 'Checkbox' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FCheckbox');
      });

      it('will handle Geometry field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FGeometry', type: 'Geometry' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FGeometry');
      });

      it('will handle Year field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FYear', type: 'Year' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FYear');
      });

      it('will handle User field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FUser', type: 'User' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FUser');
      });

      it('will handle JSON field', async () => {
        const result = await request(context.app)
          .post(`${API_PREFIX}/tables/${table.id}/fields`)
          .set('xc-token', context.xc_token)
          .send({ title: 'FJSON', type: 'JSON' })
          .expect(200);
        expect(result.body.id).to.not.empty;

        const getResult = await request(context.app)
          .get(`${API_PREFIX}/fields/${result.body.id}`)
          .set('xc-token', context.xc_token)
          .expect(200);
        expect(getResult.body.id).to.eq(result.body.id);
        expect(getResult.body.title).to.eq('FJSON');
      });
    });
  });
}
