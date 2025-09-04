import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { createBulkRows, listRow, rowMixedValue } from '../../factory/row';
import { updateColumn } from '../../factory/column';
import {
  beforeEachAttachment,
  beforeEachCheckbox,
  beforeEachLinkBased,
  beforeEachTextBased,
  beforeEachUserBased,
  beforeEach as dataApiV3BeforeEach,
} from './dataApiV3/beforeEach';
import { type INcAxios, ncAxios } from './dataApiV3/ncAxios';
import type { Column } from '../../../../src/models';
import type Model from '../../../../src/models/Model';
import type Base from '~/models/Base';
import type { ITestContext } from './dataApiV3/helpers';

function bulkV1Tests() {
  describe('delete all', () => {
    let testContext: ITestContext;
    let testAxios: INcAxios;
    let ncAxiosGet: INcAxios['ncAxiosGet'];
    let ncAxiosPost: INcAxios['ncAxiosPost'];
    let ncAxiosPatch: INcAxios['ncAxiosPatch'];
    let ncAxiosDelete: INcAxios['ncAxiosDelete'];
    let ncAxiosLinkGet: INcAxios['ncAxiosLinkGet'];
    let ncAxiosLinkAdd: INcAxios['ncAxiosLinkAdd'];
    let ncAxiosLinkRemove: INcAxios['ncAxiosLinkRemove'];
    let table: Model;
    let columns: Column[];
    let insertedRecords: any[];

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      testAxios = ncAxios(testContext);

      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
      ncAxiosPatch = testAxios.ncAxiosPatch;
      ncAxiosDelete = testAxios.ncAxiosDelete;
      ncAxiosLinkGet = testAxios.ncAxiosLinkGet;
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;
      ncAxiosLinkRemove = testAxios.ncAxiosLinkRemove;
      const initResult = await beforeEachTextBased(testContext);
      table = initResult.table;
      columns = initResult.columns;
      insertedRecords = initResult.insertedRecords;
    });
    it(`will delete all and leave no records`, async () => {
      const getRsp1 = await ncAxiosGet({
        url: `/api/v3/data/${testContext.base.id}/${table.id}/records`,
      });
      expect(getRsp1.body.records.length).to.greaterThan(0);
      await ncAxiosDelete({
        url: `/api/v1/db/data/bulk/${testContext.ctx.workspace_id}/${testContext.ctx.base_id}/${table.id}/all`,
      });

      const getRsp2 = await ncAxiosGet({
        url: `/api/v3/data/${testContext.base.id}/${table.id}/records`,
      });
      expect(getRsp2.body.records.length).to.eq(0);
    });
  });
}

export default function () {
  describe('Bulk V1', bulkV1Tests);
}
