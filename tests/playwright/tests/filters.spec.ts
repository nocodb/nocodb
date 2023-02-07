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

async function verifyFilter(param: { column: string; opType: string; value?: string; result: { rowCount: number } }) {
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
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });
    const dataType = 'Number';

    const filterList = [
      {
        op: '=',
        value: '33',
        rowCount: records.list.filter(r => r[dataType] === 33).length,
      },
      {
        op: '!=',
        value: '33',
        rowCount: records.list.filter(r => r[dataType] !== 33).length,
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
        value: '44',
        rowCount: records.list.filter(r => r[dataType] > 44 && r[dataType] != null).length,
      },
      {
        op: '>=',
        value: '44',
        rowCount: records.list.filter(r => r[dataType] >= 44 && r[dataType] != null).length,
      },
      {
        op: '<',
        value: '44',
        rowCount: records.list.filter(r => r[dataType] < 44 && r[dataType] != null).length,
      },
      {
        op: '<=',
        value: '44',
        rowCount: records.list.filter(r => r[dataType] <= 44 && r[dataType] != null).length,
      },
    ];

    for (let i = 0; i < filterList.length; i++) {
      await verifyFilter({
        column: dataType,
        opType: filterList[i].op,
        value: filterList[i].value,
        result: { rowCount: filterList[i].rowCount },
      });
    }
  });

  test('Filter: Decimal', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });
    const dataType = 'Decimal';

    const filterList = [
      {
        op: '=',
        value: '33.3',
        rowCount: records.list.filter(r => r[dataType] === 33.3).length,
      },
      {
        op: '!=',
        value: '33.3',
        rowCount: records.list.filter(r => r[dataType] !== 33.3).length,
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
        value: '44.26',
        rowCount: records.list.filter(r => r[dataType] > 44.26 && r[dataType] != null).length,
      },
      {
        op: '>=',
        value: '44.26',
        rowCount: records.list.filter(r => r[dataType] >= 44.26 && r[dataType] != null).length,
      },
      {
        op: '<',
        value: '44.26',
        rowCount: records.list.filter(r => r[dataType] < 44.26 && r[dataType] != null).length,
      },
      {
        op: '<=',
        value: '44.26',
        rowCount: records.list.filter(r => r[dataType] <= 44.26 && r[dataType] != null).length,
      },
    ];

    for (let i = 0; i < filterList.length; i++) {
      await verifyFilter({
        column: dataType,
        opType: filterList[i].op,
        value: filterList[i].value,
        result: { rowCount: filterList[i].rowCount },
      });
    }
  });

  test('Filter: Percent', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });
    const dataType = 'Percent';

    const filterList = [
      {
        op: '=',
        value: '33',
        rowCount: records.list.filter(r => r[dataType] === 33).length,
      },
      {
        op: '!=',
        value: '33',
        rowCount: records.list.filter(r => r[dataType] !== 33).length,
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
        value: '44',
        rowCount: records.list.filter(r => r[dataType] > 44 && r[dataType] != null).length,
      },
      {
        op: '>=',
        value: '44',
        rowCount: records.list.filter(r => r[dataType] >= 44 && r[dataType] != null).length,
      },
      {
        op: '<',
        value: '44',
        rowCount: records.list.filter(r => r[dataType] < 44 && r[dataType] != null).length,
      },
      {
        op: '<=',
        value: '44',
        rowCount: records.list.filter(r => r[dataType] <= 44 && r[dataType] != null).length,
      },
    ];

    for (let i = 0; i < filterList.length; i++) {
      await verifyFilter({
        column: dataType,
        opType: filterList[i].op,
        value: filterList[i].value,
        result: { rowCount: filterList[i].rowCount },
      });
    }
  });

  test('Filter: Currency', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });
    const dataType = 'Currency';

    const filterList = [
      {
        op: '=',
        value: '33.3',
        rowCount: records.list.filter(r => r[dataType] === 33.3).length,
      },
      {
        op: '!=',
        value: '33.3',
        rowCount: records.list.filter(r => r[dataType] !== 33.3).length,
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
        value: '44.26',
        rowCount: records.list.filter(r => r[dataType] > 44.26 && r[dataType] != null).length,
      },
      {
        op: '>=',
        value: '44.26',
        rowCount: records.list.filter(r => r[dataType] >= 44.26 && r[dataType] != null).length,
      },
      {
        op: '<',
        value: '44.26',
        rowCount: records.list.filter(r => r[dataType] < 44.26 && r[dataType] != null).length,
      },
      {
        op: '<=',
        value: '44.26',
        rowCount: records.list.filter(r => r[dataType] <= 44.26 && r[dataType] != null).length,
      },
    ];

    for (let i = 0; i < filterList.length; i++) {
      await verifyFilter({
        column: dataType,
        opType: filterList[i].op,
        value: filterList[i].value,
        result: { rowCount: filterList[i].rowCount },
      });
    }
  });
});
