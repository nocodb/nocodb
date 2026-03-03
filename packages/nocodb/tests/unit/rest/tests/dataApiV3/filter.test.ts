import { expect } from 'chai';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import { createTable } from '../../../factory/table';
import { createView, updateView } from '../../../factory/view';
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';
import { ncAxios } from './ncAxios';
import type { ITestContext } from '../../../init';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';

describe('dataApiV3', () => {
  describe('filter', () => {
    let testContext: ITestContext;
    let testAxios: INcAxios;
    let urlPrefix: string;
    let ncAxiosGet: INcAxios['ncAxiosGet'];
    let ncAxiosPost: INcAxios['ncAxiosPost'];
    let systemTz: string = 'Etc/Utc';

    beforeEach(async () => {
      systemTz = process.env.TZ || systemTz;
      process.env.TZ = 'Etc/Utc';
      testContext = await dataApiV3BeforeEach();
      testAxios = ncAxios(testContext);
      urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
    });

    afterEach(() => {
      process.env.TZ = systemTz;
    });

    it('should filter eq by exactDate with IST timezone', async function () {
      // Create table with Date column (IST timezone)
      const table = await createTable(testContext.context, testContext.base, {
        table_name: 'dateFilterTest',
        title: 'DateFilterTest',
        columns: [
          {
            column_name: 'id',
            title: 'Id',
            uidt: UITypes.ID,
          },
          {
            column_name: 'Date',
            title: 'Date',
            uidt: UITypes.Date,
            meta: {
              date_format: 'YYYY/MM/DD',
            },
          },
        ],
      });

      // Get Date column
      const columns = await table.getColumns(testContext.ctx);
      const dateColumn = columns.find((c) => c.title === 'Date');

      // Insert 3 rows with specific dates
      const rowData = [
        { fields: { Date: '2026-01-14' } },
        { fields: { Date: '2026-01-15' } },
        { fields: { Date: '2026-01-16' } },
      ];

      await ncAxiosPost({
        url: `${urlPrefix}/${table.id}/records`,
        body: rowData,
      });

      // Create a grid view
      const gridView = await createView(testContext.context, {
        title: 'DateFilterView',
        table,
        type: ViewTypes.GRID,
      });

      // Add filter to the view: Date exactDate '2026-01-15'
      await updateView(testContext.context, {
        table,
        view: gridView,
        filter: [
          {
            comparison_op: 'eq',
            comparison_sub_op: 'exactDate',
            fk_column_id: dateColumn.id,
            logical_op: 'and',
            value: '2026-01-15',
            meta: {
              timezone: 'Asia/Kolkata',
            },
          },
        ],
      });

      // List records using view ID (filter applied automatically)
      const filterResponse = await ncAxiosGet({
        url: `${urlPrefix}/${table.id}/records`,
        query: {
          viewId: gridView.id,
        },
      });

      // Assertions: exactly 1 row with date 2026-01-15
      expect(filterResponse.body.records.length).to.eq(1);
      expect(filterResponse.body.records[0].fields.Date).to.eq('2026-01-15');
    });

    it('should filter gte by exactDate with IST timezone', async function () {
      // Create table with Date column (IST timezone)
      const table = await createTable(testContext.context, testContext.base, {
        table_name: 'dateFilterTest',
        title: 'DateFilterTest',
        columns: [
          {
            column_name: 'id',
            title: 'Id',
            uidt: UITypes.ID,
          },
          {
            column_name: 'Date',
            title: 'Date',
            uidt: UITypes.Date,
            meta: {
              date_format: 'YYYY/MM/DD',
            },
          },
        ],
      });

      // Get Date column
      const columns = await table.getColumns(testContext.ctx);
      const dateColumn = columns.find((c) => c.title === 'Date');

      // Insert 3 rows with specific dates
      const rowData = [
        { fields: { Date: '2026-01-14' } },
        { fields: { Date: '2026-01-15' } },
        { fields: { Date: '2026-01-16' } },
      ];

      await ncAxiosPost({
        url: `${urlPrefix}/${table.id}/records`,
        body: rowData,
      });

      // Create a grid view
      const gridView = await createView(testContext.context, {
        title: 'DateFilterView',
        table,
        type: ViewTypes.GRID,
      });

      // Add filter to the view: Date exactDate '2026-01-15'
      await updateView(testContext.context, {
        table,
        view: gridView,
        filter: [
          {
            comparison_op: 'gte',
            comparison_sub_op: 'exactDate',
            fk_column_id: dateColumn.id,
            logical_op: 'and',
            value: '2026-01-15',
            meta: {
              timezone: 'Asia/Kolkata',
            },
          },
        ],
      });

      // List records using view ID (filter applied automatically)
      const filterResponse = await ncAxiosGet({
        url: `${urlPrefix}/${table.id}/records`,
        query: {
          viewId: gridView.id,
        },
      });

      // Assertions: exactly 1 row with date 2026-01-15
      expect(filterResponse.body.records.length).to.eq(2);
      expect(filterResponse.body.records[0].fields.Date).to.eq('2026-01-15');
    });
  });
});
