import { expect } from 'chai';
import request from 'supertest';
import { RelationTypes, UITypes } from 'nocodb-sdk';
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';
import { ncAxios } from './ncAxios';
import { prepareRecords } from './helpers';
import { createLtarColumn, customColumns } from '../../../factory/column';
import { createBulkRows } from '../../../factory/row';
import { createTable } from '../../../factory/table';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk';
import type { Model } from '../../../../../src/models';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';

describe('dataApiV3', () => {
  describe('self-referencing BelongsTo blank filter', () => {
    let testContext: {
      context: any;
      ctx: { workspace_id: string; base_id: string };
      base: any;
    };
    let urlPrefix: string;
    let ncAxiosGet: INcAxios['ncAxiosGet'];
    let ncAxiosLinkAdd: INcAxios['ncAxiosLinkAdd'];

    let tblEmployee: Model;
    let btColumnTitle: string;
    let hmColumnId: string;

    async function getColumns(tableId: string): Promise<ColumnType[]> {
      const rsp = await request(testContext.context.app)
        .get(`/api/v1/db/meta/tables/${tableId}`)
        .set('xc-auth', testContext.context.token)
        .expect(200);
      return rsp.body.columns;
    }

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      const testAxios = ncAxios(testContext);
      urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;

      // Create Employee table
      tblEmployee = await createTable(testContext.context, testContext.base, {
        title: 'Employee',
        table_name: 'Employee',
        columns: customColumns('custom', [
          {
            title: 'Name',
            column_name: 'Name',
            uidt: UITypes.SingleLineText,
            pv: true,
          },
        ]),
      });

      await createBulkRows(testContext.context, {
        base: testContext.base,
        table: tblEmployee,
        values: prepareRecords('Name', 5, 1, { ignoreId: true }),
      });

      // Create self-referencing HM link (auto-creates BT on same table)
      await createLtarColumn(testContext.context, {
        title: 'Reports',
        parentTable: tblEmployee,
        childTable: tblEmployee,
        type: 'hm',
      });

      // Find the BT and HM columns via API (includes colOptions)
      const cols = await getColumns(tblEmployee.id);
      const btCol = cols.find(
        (c) =>
          (c.colOptions as LinkToAnotherRecordType)?.type ===
          RelationTypes.BELONGS_TO,
      );
      const hmCol = cols.find(
        (c) =>
          (c.colOptions as LinkToAnotherRecordType)?.type ===
          RelationTypes.HAS_MANY,
      );

      btColumnTitle = btCol!.title!;
      hmColumnId = hmCol!.id!;

      // Employee 1 manages Employees 2 and 3
      // → Employee 2 BT FK = 1, Employee 3 BT FK = 1
      // → Employees 1, 4, 5 BT FK = NULL
      await ncAxiosLinkAdd({
        urlParams: {
          tableId: tblEmployee.id,
          linkId: hmColumnId,
          rowId: '1',
        },
        body: [{ id: 2 }, { id: 3 }],
      });
    });

    it('blank filter matches records with NULL FK', async function () {
      const rsp = await ncAxiosGet({
        url: `${urlPrefix}/${tblEmployee.id}/records`,
        query: { where: `(${btColumnTitle},is_blank,)` },
      });

      expect(rsp.body.records.length).to.equal(3);
      const ids = rsp.body.records.map((r: any) => r.id).sort();
      expect(ids).to.deep.equal([1, 4, 5]);
    });

    it('notblank filter matches records with valid FK', async function () {
      const rsp = await ncAxiosGet({
        url: `${urlPrefix}/${tblEmployee.id}/records`,
        query: { where: `(${btColumnTitle},is_not_blank,)` },
      });

      expect(rsp.body.records.length).to.equal(2);
      const ids = rsp.body.records.map((r: any) => r.id).sort();
      expect(ids).to.deep.equal([2, 3]);
    });

    it('blank filter matches dangling FK after target record deleted', async function () {
      // Delete Employee 1 directly in DB to create dangling FKs
      // Employees 2, 3 still have FK = 1 but the target row is gone
      const sources = await testContext.base.getSources();
      const knex = await NcConnectionMgrv2.get(sources[0]!);

      // Disable FK constraints so we can delete without cascade
      await knex.raw('SET session_replication_role = replica;');
      await knex(tblEmployee.table_name).where('id', 1).delete();
      await knex.raw('SET session_replication_role = DEFAULT;');

      // blank should match 4: Employees 4,5 (NULL FK) + 2,3 (dangling FK)
      const rsp = await ncAxiosGet({
        url: `${urlPrefix}/${tblEmployee.id}/records`,
        query: { where: `(${btColumnTitle},is_blank,)` },
      });

      expect(rsp.body.records.length).to.equal(4);
      const ids = rsp.body.records.map((r: any) => r.id).sort();
      expect(ids).to.deep.equal([2, 3, 4, 5]);
    });

    it('notblank filter excludes dangling FK after target record deleted', async function () {
      const sources = await testContext.base.getSources();
      const knex = await NcConnectionMgrv2.get(sources[0]!);

      await knex.raw('SET session_replication_role = replica;');
      await knex(tblEmployee.table_name).where('id', 1).delete();
      await knex.raw('SET session_replication_role = DEFAULT;');

      // notblank should match 0: no valid FK references remain
      const rsp = await ncAxiosGet({
        url: `${urlPrefix}/${tblEmployee.id}/records`,
        query: { where: `(${btColumnTitle},is_not_blank,)` },
      });

      expect(rsp.body.records.length).to.equal(0);
    });
  });
});
