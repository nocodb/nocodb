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

    // Regression for #12704 — `is null` / `isnot null` must work for field
    // types routed through the FieldHandler architecture (Number, DateTime),
    // not just the legacy types (text).
    const buildNullableTable = async () => {
      const table = await createTable(testContext.context, testContext.base, {
        table_name: 'nullableFilterTest',
        title: 'NullableFilterTest',
        columns: [
          { column_name: 'id', title: 'Id', uidt: UITypes.ID },
          { column_name: 'Number', title: 'Number', uidt: UITypes.Number },
          { column_name: 'DateTime', title: 'DateTime', uidt: UITypes.DateTime },
        ],
      });

      await ncAxiosPost({
        url: `${urlPrefix}/${table.id}/records`,
        body: [
          { fields: { Number: 100, DateTime: '2026-01-15 10:00:00' } },
          { fields: { Number: 200, DateTime: '2026-01-16 10:00:00' } },
          { fields: { Number: null, DateTime: null } },
        ],
      });

      return table;
    };

    const listWithFilter = async (
      table: Awaited<ReturnType<typeof buildNullableTable>>,
      filter: Record<string, any>,
    ) => {
      const gridView = await createView(testContext.context, {
        title: `NullableFilterView_${filter.comparison_op}_${filter.value}`,
        table,
        type: ViewTypes.GRID,
      });

      await updateView(testContext.context, {
        table,
        view: gridView,
        filter: [{ logical_op: 'and', ...filter }],
      });

      const res = await ncAxiosGet({
        url: `${urlPrefix}/${table.id}/records`,
        query: { viewId: gridView.id },
      });

      return res.body.records as Array<{ fields: Record<string, any> }>;
    };

    it('should filter Number field by `is null` / `isnot null`', async function () {
      const table = await buildNullableTable();
      const columns = await table.getColumns(testContext.ctx);
      const numberColumn = columns.find((c) => c.title === 'Number');

      const isNull = await listWithFilter(table, {
        comparison_op: 'is',
        value: 'null',
        fk_column_id: numberColumn.id,
      });
      expect(isNull.length).to.eq(1);
      expect(isNull[0].fields.Number).to.eq(null);

      const isNotNull = await listWithFilter(table, {
        comparison_op: 'isnot',
        value: 'null',
        fk_column_id: numberColumn.id,
      });
      expect(isNotNull.length).to.eq(2);
      expect(isNotNull.every((r) => r.fields.Number !== null)).to.eq(true);
    });

    it('should filter DateTime field by `is null` / `isnot null`', async function () {
      const table = await buildNullableTable();
      const columns = await table.getColumns(testContext.ctx);
      const dateTimeColumn = columns.find((c) => c.title === 'DateTime');

      const isNull = await listWithFilter(table, {
        comparison_op: 'is',
        value: 'null',
        fk_column_id: dateTimeColumn.id,
      });
      expect(isNull.length).to.eq(1);
      expect(isNull[0].fields.DateTime).to.eq(null);

      // Guards the silent-all-rows regression: `isnot null` must not return
      // every row by dropping the clause.
      const isNotNull = await listWithFilter(table, {
        comparison_op: 'isnot',
        value: 'null',
        fk_column_id: dateTimeColumn.id,
      });
      expect(isNotNull.length).to.eq(2);
      expect(isNotNull.every((r) => r.fields.DateTime !== null)).to.eq(true);
    });
  });
});
