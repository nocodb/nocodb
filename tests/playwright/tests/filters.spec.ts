import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { ToolbarPage } from '../pages/Dashboard/common/Toolbar';
import { UITypes } from 'nocodb-sdk';
import { Api } from 'nocodb-sdk';
import { rowMixedValue } from '../setup/xcdb-records';

let dashboard: DashboardPage, toolbar: ToolbarPage;
let context: any;
let api: Api<any>;
let records = [];

const skipList = {
  Number: ['is null', 'is not null', 'is blank', 'is not blank'],
  Decimal: ['is null', 'is not null', 'is blank', 'is not blank'],
  Percent: ['is null', 'is not null', 'is blank', 'is not blank'],
  Currency: ['is null', 'is not null', 'is blank', 'is not blank'],
  Rating: ['is null', 'is not null', 'is blank', 'is not blank'],
  SingleLineText: ['is blank', 'is not blank'],
  MultiLineText: ['is blank', 'is not blank'],
  Email: ['is blank', 'is not blank'],
  PhoneNumber: ['is blank', 'is not blank'],
  URL: ['is blank', 'is not blank'],
  SingleSelect: ['is blank', 'is not blank', 'contains all of', 'does not contain all of'],
  MultiSelect: ['is blank', 'is not blank', 'is', 'is not'],
};

// define validateRowArray function
async function validateRowArray(param) {
  const { rowCount } = param;
  await dashboard.grid.verifyTotalRowCount({ count: rowCount });

  // const { sequence, length, totalRowCount, column } = param;
  //
  // await dashboard.grid.verifyTotalRowCount({ count: totalRowCount });
  //
  // for (let j = 0; j < length; j++) {
  //   await dashboard.grid.cell.verify({
  //     index: j,
  //     columnHeader: column,
  //     value: sequence,
  //   });
  // }
}

async function verifyFilter(param: {
  column: string;
  opType: string;
  value?: string;
  result: { rowCount: number };
  dataType?: string;
}) {
  // if opType was included in skip list, skip it
  if (skipList[param.column]?.includes(param.opType)) {
    return;
  }

  await toolbar.clickFilter();
  await toolbar.filter.add({
    columnTitle: param.column,
    opType: param.opType,
    value: param.value,
    isLocallySaved: false,
    dataType: param?.dataType,
  });
  await toolbar.clickFilter();

  // verify filtered rows
  await validateRowArray({
    rowCount: param.result.rowCount,
  });

  // Reset filter
  await toolbar.filter.reset();
}

test.describe('Filter Tests: Numerical', () => {
  async function numBasedFilterTest(dataType, eqString, isLikeString) {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    const filterList = [
      {
        op: '=',
        value: eqString,
        rowCount: records.list.filter(r => r[dataType] === parseFloat(eqString)).length,
      },
      {
        op: '!=',
        value: eqString,
        rowCount: records.list.filter(r => r[dataType] !== parseFloat(eqString)).length,
      },
      {
        op: 'is null',
        value: '',
        rowCount: records.list.filter(r => r[dataType] === null).length,
      },
      {
        op: 'is not null',
        value: '',
        rowCount: records.list.filter(r => r[dataType] !== null).length,
      },
      {
        op: 'is blank',
        value: '',
        rowCount: records.list.filter(r => r[dataType] === null).length,
      },
      {
        op: 'is not blank',
        value: '',
        rowCount: records.list.filter(r => r[dataType] !== null).length,
      },
      {
        op: '>',
        value: isLikeString,
        rowCount: records.list.filter(r => r[dataType] > parseFloat(isLikeString) && r[dataType] != null).length,
      },
      {
        op: '>=',
        value: isLikeString,
        rowCount: records.list.filter(r => r[dataType] >= parseFloat(isLikeString) && r[dataType] != null).length,
      },
      {
        op: '<',
        value: isLikeString,
        rowCount: records.list.filter(r => r[dataType] < parseFloat(isLikeString) && r[dataType] != null).length,
      },
      {
        op: '<=',
        value: isLikeString,
        rowCount: records.list.filter(r => r[dataType] <= parseFloat(isLikeString) && r[dataType] != null).length,
      },
    ];

    for (let i = 0; i < filterList.length; i++) {
      await verifyFilter({
        column: dataType,
        opType: filterList[i].op,
        value: filterList[i].value,
        result: { rowCount: filterList[i].rowCount },
        dataType: dataType,
      });
    }
  }

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.grid.toolbar;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const columns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'Number',
        title: 'Number',
        uidt: UITypes.Number,
      },
      {
        column_name: 'Decimal',
        title: 'Decimal',
        uidt: UITypes.Decimal,
      },
      {
        column_name: 'Currency',
        title: 'Currency',
        uidt: UITypes.Currency,
      },
      {
        column_name: 'Percent',
        title: 'Percent',
        uidt: UITypes.Percent,
      },
      {
        column_name: 'Duration',
        title: 'Duration',
        uidt: UITypes.Duration,
      },
      {
        column_name: 'Rating',
        title: 'Rating',
        uidt: UITypes.Rating,
      },
    ];

    try {
      const project = await api.project.read(context.project.id);
      const table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'numberBased',
        title: 'numberBased',
        columns: columns,
      });

      const rowAttributes = [];
      for (let i = 0; i < 400; i++) {
        const row = {
          Number: rowMixedValue(columns[1], i),
          Decimal: rowMixedValue(columns[2], i),
          Currency: rowMixedValue(columns[3], i),
          Percent: rowMixedValue(columns[4], i),
          Duration: rowMixedValue(columns[5], i),
          Rating: rowMixedValue(columns[6], i),
        };
        rowAttributes.push(row);
      }

      await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 400 });
    } catch (e) {
      console.error(e);
    }
  });

  test('Filter: Number', async () => {
    await numBasedFilterTest('Number', '33', '44');
  });

  test('Filter: Decimal', async () => {
    await numBasedFilterTest('Decimal', '33.3', '44.26');
  });

  test('Filter: Percent', async () => {
    await numBasedFilterTest('Percent', '33', '44');
  });

  test('Filter: Currency', async () => {
    await numBasedFilterTest('Currency', '33.3', '44.26');
  });

  test('Filter: Rating', async () => {
    await numBasedFilterTest('Rating', '3', '2');
  });
});

// Text based filters
//

test.describe.only('Filter Tests: Text based', () => {
  async function textBasedFilterTest(dataType, eqString, isLikeString) {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'textBased' });

    const filterList = [
      {
        op: 'is equal',
        value: eqString,
        rowCount: records.list.filter(r => r[dataType] === eqString).length,
      },
      {
        op: 'is not equal',
        value: eqString,
        rowCount: records.list.filter(r => r[dataType] !== eqString).length,
      },
      {
        op: 'is null',
        value: '',
        rowCount: records.list.filter(r => r[dataType] === null).length,
      },
      {
        op: 'is not null',
        value: '',
        rowCount: records.list.filter(r => r[dataType] !== null).length,
      },
      {
        op: 'is empty',
        value: '',
        rowCount: records.list.filter(r => r[dataType] === '').length,
      },
      {
        op: 'is not empty',
        value: '',
        rowCount: records.list.filter(r => r[dataType] !== '').length,
      },
      {
        op: 'is blank',
        value: '',
        rowCount: records.list.filter(r => r[dataType] === '' || r[dataType] === null).length,
      },
      {
        op: 'is not blank',
        value: '',
        rowCount: records.list.filter(r => r[dataType] !== '' && r[dataType] !== null).length,
      },
      {
        op: 'is like',
        value: isLikeString,
        rowCount: records.list.filter(r => r[dataType]?.includes(isLikeString)).length,
      },
      {
        op: 'is not like',
        value: isLikeString,
        rowCount: records.list.filter(r => !r[dataType]?.includes(isLikeString)).length,
      },
    ];

    for (let i = 0; i < filterList.length; i++) {
      console.log(`${dataType} Filter: ${filterList[i].op} ${filterList[i].value}`);
      await verifyFilter({
        column: dataType,
        opType: filterList[i].op,
        value: filterList[i].value,
        result: { rowCount: filterList[i].rowCount },
      });
    }
  }

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.grid.toolbar;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const columns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'SingleLineText',
        title: 'SingleLineText',
        uidt: UITypes.SingleLineText,
      },
      {
        column_name: 'MultiLineText',
        title: 'MultiLineText',
        uidt: UITypes.LongText,
      },
      {
        column_name: 'Email',
        title: 'Email',
        uidt: UITypes.Email,
      },
      {
        column_name: 'PhoneNumber',
        title: 'PhoneNumber',
        uidt: UITypes.PhoneNumber,
      },
      {
        column_name: 'URL',
        title: 'URL',
        uidt: UITypes.URL,
      },
    ];

    try {
      const project = await api.project.read(context.project.id);
      const table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'textBased',
        title: 'textBased',
        columns: columns,
      });

      const rowAttributes = [];
      for (let i = 0; i < 400; i++) {
        const row = {
          SingleLineText: rowMixedValue(columns[1], i),
          MultiLineText: rowMixedValue(columns[2], i),
          Email: rowMixedValue(columns[3], i),
          PhoneNumber: rowMixedValue(columns[4], i),
          URL: rowMixedValue(columns[5], i),
        };
        rowAttributes.push(row);
      }

      await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 400 });
    } catch (e) {
      console.error(e);
    }
  });

  test('Filter: Single Line Text', async () => {
    await textBasedFilterTest('SingleLineText', 'Afghanistan', 'Au');
  });

  test('Filter: Long Text', async () => {
    await textBasedFilterTest('MultiLineText', 'Aberdeen, United Kingdom', 'abad');
  });

  test('Filter: Email', async () => {
    await textBasedFilterTest('Email', 'leota@hotmail.com', 'cox.net');
  });

  test('Filter: PhoneNumber', async () => {
    await textBasedFilterTest('PhoneNumber', '504-621-8927', '504');
  });

  test('Filter: URL', async () => {
    await textBasedFilterTest('URL', 'https://www.youtube.com', 'e.com');
  });
});
