import { expect } from 'chai';
import { customColumns } from '../../../factory/column';
import { createBulkRows, listRow, rowMixedValue } from '../../../factory/row';
import { createTable } from '../../../factory/table';
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';
import { ncAxios } from './ncAxios';
import type init from '../../../init';
import type { INcAxios } from './ncAxios';
import type { Base, Column, Model } from '../../../../../src/models';

const API_VERSION = 'v3';

describe.only('dataApiV3', () => {
  describe('get-record', () => {
    let testContext: {
      context: Awaited<ReturnType<typeof init>>;
      ctx: {
        workspace_id: any;
        base_id: any;
      };
      sakilaProject: Base;
      base: Base;
      countryTable: Model;
      cityTable: Model;
    };
    let testAxios: INcAxios;
    let urlPrefix: string;

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      testAxios = ncAxios(testContext.context);
      urlPrefix = `/api/${API_VERSION}/${testContext.base.id}`;
    });
    describe('text-based', () => {
      let table: Model;
      let columns: Column[];
      let insertedRecords: any[];

      beforeEach(async function () {
        table = await createTable(testContext.context, testContext.base, {
          table_name: 'textBased',
          title: 'TextBased',
          columns: customColumns('textBased'),
        });

        // retrieve column meta
        columns = await table.getColumns(testContext.ctx);

        // build records
        const rowAttributes: {
          SingleLineText: string | string[] | number | null;
          MultiLineText: string | string[] | number | null;
          Email: string | string[] | number | null;
          Phone: string | string[] | number | null;
          Url: string | string[] | number | null;
        }[] = [];
        for (let i = 0; i < 400; i++) {
          const row = {
            SingleLineText: rowMixedValue(columns[6], i),
            MultiLineText: rowMixedValue(columns[7], i),
            Email: rowMixedValue(columns[8], i),
            Phone: rowMixedValue(columns[9], i),
            Url: rowMixedValue(columns[10], i),
          };
          rowAttributes.push(row);
        }

        // insert records
        // creating bulk records using older set of APIs
        await createBulkRows(testContext.context, {
          base: testContext.base,
          table,
          values: rowAttributes,
        });

        // retrieve inserted records
        insertedRecords = await listRow({ base: testContext.base, table });

        // verify length of unfiltered records to be 400
        expect(insertedRecords.length).to.equal(400);
      });

      it('Read: all fields', async function () {
        await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${table.id}/100`,
        });
      });

      it('Read: invalid ID', async function () {
        await testAxios.ncAxiosGet({
          url: `${urlPrefix}/123456789/100`,
          status: 404,
        });

        await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${table.id}/1000`,
          status: 404,
        });
      });
    });
  });
});
