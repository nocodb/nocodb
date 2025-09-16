/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import { type Column, type Model } from '../../../../../src/models';
import {
  beforeEachTextBased,
  beforeEach as dataApiV3BeforeEach,
} from './beforeEach';
import { ncAxios } from './ncAxios';
import type { ITestContext } from '../../../init';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';

describe('dataApiV3', () => {
  describe('audit-log', () => {
    let testContext: ITestContext;
    let testAxios: INcAxios;
    let urlPrefix: string;
    let urlAuditLogApi: string;

    let ncAxiosGet: INcAxios['ncAxiosGet'];
    let ncAxiosPost: INcAxios['ncAxiosPost'];
    let ncAxiosPatch: INcAxios['ncAxiosPatch'];
    let ncAxiosDelete: INcAxios['ncAxiosDelete'];
    let ncAxiosLinkGet: INcAxios['ncAxiosLinkGet'];
    let ncAxiosLinkAdd: INcAxios['ncAxiosLinkAdd'];
    let ncAxiosLinkRemove: INcAxios['ncAxiosLinkRemove'];

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      testAxios = ncAxios(testContext);
      urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      urlAuditLogApi = `/api/v2/internal/${testContext.ctx.workspace_id}/${testContext.base.id}`;

      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
      ncAxiosPatch = testAxios.ncAxiosPatch;
      ncAxiosDelete = testAxios.ncAxiosDelete;
      ncAxiosLinkGet = testAxios.ncAxiosLinkGet;
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;
      ncAxiosLinkRemove = testAxios.ncAxiosLinkRemove;
    });

    describe('text-based', () => {
      let table: Model;
      let columns: Column[];
      let insertedRecords: any[];

      beforeEach(async function () {
        const initResult = await beforeEachTextBased(testContext);
        table = initResult.table;
        columns = initResult.columns;
        insertedRecords = initResult.insertedRecords;
      });

      const newRecord = {
        fields: {
          SingleLineText: 'abc',
          MultiLineText: 'abc abc \n abc \r abc \t abc 1234!@#$%^&*()_+',
          Email: 'a@b.com',
          Url: 'https://www.abc.com',
          Phone: '1-234-567-8910',
        },
      };

      it('audit log', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: newRecord,
        });

        const expectedId = 401;
        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0]).to.have.property('id', expectedId);
        expect(rsp.body.records[0]).to.have.property('fields');

        const rsp2 = await ncAxiosGet({
          url: urlAuditLogApi,
          query: {
            operation: 'recordAuditList',
            fk_model_id: table.id,
            row_id: expectedId,
          },
        });
        expect(rsp2.body.list.length).to.greaterThan(0);
        await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}/records`,
          body: [
            {
              id: expectedId,
              fields: {
                SingleLineText: 'AAADC',
              },
            },
          ],
        });

        const rsp3 = await ncAxiosGet({
          url: urlAuditLogApi,
          query: {
            operation: 'recordAuditList',
            fk_model_id: table.id,
            row_id: expectedId,
          },
        });
        expect(rsp3.body.list.length).to.greaterThan(rsp2.body.list.length);
      });

      it('audit log bulk', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${table.id}/records`,
          body: [newRecord, newRecord],
        });

        const expectedId = 401;
        expect(rsp.body.records).to.have.length(2);
        expect(rsp.body.records[0]).to.have.property('id', expectedId);
        expect(rsp.body.records[0]).to.have.property('fields');

        const rsp2 = await ncAxiosGet({
          url: urlAuditLogApi,
          query: {
            operation: 'recordAuditList',
            fk_model_id: table.id,
            row_id: expectedId,
          },
        });
        expect(rsp2.body.list.length).to.greaterThan(0);
        await ncAxiosPatch({
          url: `${urlPrefix}/${table.id}/records`,
          body: [
            {
              id: expectedId,
              fields: {
                SingleLineText: 'AAADC',
              },
            },
          ],
        });

        const rsp3 = await ncAxiosGet({
          url: urlAuditLogApi,
          query: {
            operation: 'recordAuditList',
            fk_model_id: table.id,
            row_id: expectedId,
          },
        });
        expect(rsp3.body.list.length).to.greaterThan(rsp2.body.list.length);
      });
    });
  });
});
