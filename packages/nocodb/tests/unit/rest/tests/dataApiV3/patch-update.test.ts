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

describe('dataApiV3', () => {
  describe('patch-update', () => {
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

      const newRecord = {
        SingleLineText: 'abc',
        MultiLineText: 'abc abc \n abc \r abc \t abc 1234!@#$%^&*()_+',
        Email: 'a@b.com',
        Url: 'https://www.abc.com',
        Phone: '1-234-567-8910',
      };
      it('Update: all fields', async function () {
        const rsp = await testAxios.ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: [
            {
              Id: 1,
              ...newRecord,
            },
          ],
        });
        expect(rsp.body).to.deep.equal([{ Id: 1 }]);
      });

      it('Update: partial', async function () {
        const recordBeforeUpdate = await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${table.id}/1`,
          query: {
            fields: 'Id,SingleLineText,MultiLineText',
          },
        });

        const rsp = await testAxios.ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: [
            {
              Id: 1,
              SingleLineText: 'some text',
              MultiLineText: 'some more text',
            },
          ],
        });
        expect(rsp.body).to.deep.equal([{ Id: 1 }]);

        const recordAfterUpdate = await testAxios.ncAxiosGet({
          url: `${urlPrefix}/${table.id}/1`,
          query: {
            fields: 'Id,SingleLineText,MultiLineText',
          },
        });
        expect(recordAfterUpdate.body).to.deep.equal({
          ...recordBeforeUpdate.body,
          SingleLineText: 'some text',
          MultiLineText: 'some more text',
        });
      });

      it('Update: bulk', async function () {
        const rsp = await testAxios.ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: [
            {
              Id: 1,
              SingleLineText: 'some text',
              MultiLineText: 'some more text',
            },
            {
              Id: 2,
              SingleLineText: 'some text',
              MultiLineText: 'some more text',
            },
          ],
        });
        expect(rsp.body).to.deep.equal([{ Id: 1 }, { Id: 2 }]);
      });

      // Error handling

      it('Update: invalid ID', async function () {
        // Invalid table ID
        await testAxios.ncAxiosPatch({
          url: `${urlPrefix}/123456789`,
          body: { Id: 100, SingleLineText: 'some text' },
          status: 404,
        });
        // Invalid row ID
        await testAxios.ncAxiosPatch({
          url: `${urlPrefix}/${table.id}`,
          body: { Id: 123456789, SingleLineText: 'some text' },
          status: 404,
        });
      });
    });
  });
});
