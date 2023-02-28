import { expect, test } from '@playwright/test';
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
  Number: ['is null', 'is not null'],
  Decimal: ['is null', 'is not null'],
  Percent: ['is null', 'is not null'],
  Currency: ['is null', 'is not null'],
  Rating: ['is null', 'is not null', 'is blank', 'is not blank'],
  Duration: ['is null', 'is not null'],
  SingleLineText: [],
  MultiLineText: [],
  Email: [],
  PhoneNumber: [],
  URL: [],
  SingleSelect: ['contains all of', 'does not contain all of'],
  MultiSelect: ['is', 'is not'],
};

async function verifyFilterOperatorList(param: { column: string; opType: string[] }) {
  await toolbar.clickFilter({ networkValidation: false });
  const opList = await toolbar.filter.columnOperatorList({
    columnTitle: param.column,
  });
  await toolbar.clickFilter({ networkValidation: false });
  await toolbar.filter.reset({ networkValidation: false });

  expect(opList).toEqual(param.opType);
}

// define validateRowArray function
async function validateRowArray(param) {
  const { rowCount } = param;
  await dashboard.grid.verifyTotalRowCount({ count: rowCount });
}

async function verifyFilter(param: {
  column: string;
  opType: string;
  opSubType?: string;
  value?: string;
  result: { rowCount: number };
  dataType?: string;
}) {
  // if opType was included in skip list, skip it
  if (skipList[param.column]?.includes(param.opType)) {
    return;
  }

  console.log(`Verifying filter: ${param.opType} ${param.opSubType}`);

  await toolbar.clickFilter();
  await toolbar.filter.add({
    columnTitle: param.column,
    opType: param.opType,
    opSubType: param.opSubType,
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

// Number based filters
//

test.describe('Filter Tests: Numerical', () => {
  async function numBasedFilterTest(dataType, eqString, isLikeString) {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();

    let eqStringDerived = eqString;
    let isLikeStringDerived = isLikeString;
    if (dataType === 'Duration') {
      // convert from hh:mm to seconds
      eqStringDerived = parseInt(eqString.split(':')[0]) * 3600 + parseInt(eqString.split(':')[1]) * 60;
      isLikeStringDerived = parseInt(isLikeString.split(':')[0]) * 3600 + parseInt(isLikeString.split(':')[1]) * 60;
    }

    const filterList = [
      {
        op: '=',
        value: eqString,
        rowCount: records.list.filter(r => parseFloat(r[dataType]) === parseFloat(eqStringDerived)).length,
      },
      {
        op: '!=',
        value: eqString,
        rowCount: records.list.filter(r => parseFloat(r[dataType]) !== parseFloat(eqStringDerived)).length,
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
        rowCount: records.list.filter(
          r => parseFloat(r[dataType]) > parseFloat(isLikeStringDerived) && r[dataType] != null
        ).length,
      },
      {
        op: '>=',
        value: isLikeString,
        rowCount: records.list.filter(
          r => parseFloat(r[dataType]) >= parseFloat(isLikeStringDerived) && r[dataType] != null
        ).length,
      },
      {
        op: '<',
        value: isLikeString,
        rowCount:
          dataType === 'Rating'
            ? records.list.filter(
                r => parseFloat(r[dataType]) < parseFloat(isLikeStringDerived) || r[dataType] === null
              ).length
            : records.list.filter(r => parseFloat(r[dataType]) < parseFloat(isLikeStringDerived) && r[dataType] != null)
                .length,
      },
      {
        op: '<=',
        value: isLikeString,
        rowCount:
          dataType === 'Rating'
            ? records.list.filter(
                r => parseFloat(r[dataType]) <= parseFloat(isLikeStringDerived) || r[dataType] === null
              ).length
            : records.list.filter(
                r => parseFloat(r[dataType]) <= parseFloat(isLikeStringDerived) && r[dataType] != null
              ).length,
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

  test('Filter: Duration', async () => {
    await numBasedFilterTest('Duration', '00:01', '01:03');
  });
});

// Text based filters
//

test.describe('Filter Tests: Text based', () => {
  async function textBasedFilterTest(dataType, eqString, isLikeString) {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'textBased' });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();

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

// Select Based
//

test.describe('Filter Tests: Select based', () => {
  async function selectBasedFilterTest(dataType, is, anyof, allof) {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'selectBased' });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();

    const filterList = [
      {
        op: 'is',
        value: is,
        rowCount: records.list.filter(r => r[dataType] === is).length,
      },
      {
        op: 'is not',
        value: is,
        rowCount: records.list.filter(r => r[dataType] !== is).length,
      },
      {
        op: 'contains any of',
        value: anyof,
        rowCount: records.list.filter(r => {
          const values = anyof.split(',');
          const recordValue = r[dataType]?.split(',');
          return values.some(value => recordValue?.includes(value));
        }).length,
      },
      {
        op: 'contains all of',
        value: allof,
        rowCount: records.list.filter(r => {
          const values = allof.split(',');
          return values.every(value => r[dataType]?.includes(value));
        }).length,
      },
      {
        op: 'does not contain any of',
        value: anyof,
        rowCount: records.list.filter(r => {
          const values = anyof.split(',');
          const recordValue = r[dataType]?.split(',');
          return !values.some(value => recordValue?.includes(value));
        }).length,
      },
      {
        op: 'does not contain all of',
        value: allof,
        rowCount: records.list.filter(r => {
          const values = allof.split(',');
          return !values.every(value => r[dataType]?.includes(value));
        }).length,
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
        column_name: 'SingleSelect',
        title: 'SingleSelect',
        uidt: UITypes.SingleSelect,
        dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
      },
      {
        column_name: 'MultiSelect',
        title: 'MultiSelect',
        uidt: UITypes.MultiSelect,
        dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
      },
    ];

    try {
      const project = await api.project.read(context.project.id);
      const table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'selectBased',
        title: 'selectBased',
        columns: columns,
      });

      const rowAttributes = [];
      for (let i = 0; i < 400; i++) {
        const row = {
          SingleSelect: rowMixedValue(columns[1], i),
          MultiSelect: rowMixedValue(columns[2], i),
        };
        rowAttributes.push(row);
      }

      await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 400 });
    } catch (e) {
      console.error(e);
    }
  });

  test('Filter: Single Select', async () => {
    await selectBasedFilterTest('SingleSelect', 'jan', 'jan,feb,mar', '');
  });

  test('Filter: Multi Select', async () => {
    await selectBasedFilterTest('MultiSelect', '', 'jan,feb,mar', 'jan,feb,mar');
  });
});

// Date & Time related
//

test.describe('Filter Tests: Date based', () => {
  const today = new Date().setHours(0, 0, 0, 0);
  const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).setHours(0, 0, 0, 0);
  const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).setHours(0, 0, 0, 0);
  const oneWeekAgo = new Date(new Date().setDate(new Date().getDate() - 7)).setHours(0, 0, 0, 0);
  const oneWeekFromNow = new Date(new Date().setDate(new Date().getDate() + 7)).setHours(0, 0, 0, 0);
  const oneMonthAgo = new Date(new Date().setMonth(new Date().getMonth() - 1)).setHours(0, 0, 0, 0);
  const oneMonthFromNow = new Date(new Date().setMonth(new Date().getMonth() + 1)).setHours(0, 0, 0, 0);
  const daysAgo45 = new Date(new Date().setDate(new Date().getDate() - 45)).setHours(0, 0, 0, 0);
  const daysFromNow45 = new Date(new Date().setDate(new Date().getDate() + 45)).setHours(0, 0, 0, 0);
  const thisMonth15 = new Date(new Date().setDate(15)).setHours(0, 0, 0, 0);
  const oneYearAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).setHours(0, 0, 0, 0);
  const oneYearFromNow = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).setHours(0, 0, 0, 0);

  async function dateTimeBasedFilterTest(dataType, suiteName) {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'dateTimeBased' });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();

    // records array with time set to 00:00:00; store time in unix epoch
    const recordsTimeSetToZero = records.list.map(r => {
      const date = new Date(r[dataType]);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    });

    const isFilterList = [
      {
        opSub: 'today',
        rowCount: recordsTimeSetToZero.filter(r => r === today).length,
      },
      {
        opSub: 'tomorrow',
        rowCount: recordsTimeSetToZero.filter(r => r === tomorrow).length,
      },
      {
        opSub: 'yesterday',
        rowCount: recordsTimeSetToZero.filter(r => r === yesterday).length,
      },
      {
        opSub: 'one week ago',
        rowCount: recordsTimeSetToZero.filter(r => r === oneWeekAgo).length,
      },
      {
        opSub: 'one week from now',
        rowCount: recordsTimeSetToZero.filter(r => r === oneWeekFromNow).length,
      },
      {
        opSub: 'one month ago',
        rowCount: recordsTimeSetToZero.filter(r => r === oneMonthAgo).length,
      },
      {
        opSub: 'one month from now',
        rowCount: recordsTimeSetToZero.filter(r => r === oneMonthFromNow).length,
      },
      {
        opSub: 'number of days ago',
        value: 45,
        rowCount: recordsTimeSetToZero.filter(r => r === daysAgo45).length,
      },
      {
        opSub: 'number of days from now',
        value: 45,
        rowCount: recordsTimeSetToZero.filter(r => r === daysFromNow45).length,
      },
      {
        opSub: 'exact date',
        value: 15,
        rowCount: recordsTimeSetToZero.filter(r => r === thisMonth15).length,
      },
    ];

    // "is after" filter list
    const isAfterFilterList = [
      {
        opSub: 'today',
        rowCount: recordsTimeSetToZero.filter(r => r > today).length,
      },
      {
        opSub: 'tomorrow',
        rowCount: recordsTimeSetToZero.filter(r => r > tomorrow).length,
      },
      {
        opSub: 'yesterday',
        rowCount: recordsTimeSetToZero.filter(r => r > yesterday).length,
      },
      {
        opSub: 'one week ago',
        rowCount: recordsTimeSetToZero.filter(r => r > oneWeekAgo).length,
      },
      {
        opSub: 'one week from now',
        rowCount: recordsTimeSetToZero.filter(r => r > oneWeekFromNow).length,
      },
      {
        opSub: 'one month ago',
        rowCount: recordsTimeSetToZero.filter(r => r > oneMonthAgo).length,
      },
      {
        opSub: 'one month from now',
        rowCount: recordsTimeSetToZero.filter(r => r > oneMonthFromNow).length,
      },
      {
        opSub: 'number of days ago',
        value: 45,
        rowCount: recordsTimeSetToZero.filter(r => r > daysAgo45).length,
      },
      {
        opSub: 'number of days from now',
        value: 45,
        rowCount: recordsTimeSetToZero.filter(r => r > daysFromNow45).length,
      },
      {
        opSub: 'exact date',
        value: 15,
        rowCount: recordsTimeSetToZero.filter(r => r > thisMonth15).length,
      },
    ];

    // "is within" filter list
    const isWithinFilterList = [
      {
        opSub: 'the past week',
        rowCount: recordsTimeSetToZero.filter(r => r >= oneWeekAgo && r <= today).length,
      },
      {
        opSub: 'the past month',
        rowCount: recordsTimeSetToZero.filter(r => r >= oneMonthAgo && r <= today).length,
      },
      {
        opSub: 'the past year',
        rowCount: recordsTimeSetToZero.filter(r => r >= oneYearAgo && r <= today).length,
      },
      {
        opSub: 'the next week',
        rowCount: recordsTimeSetToZero.filter(r => r >= today && r <= oneWeekFromNow).length,
      },
      {
        opSub: 'the next month',
        rowCount: recordsTimeSetToZero.filter(r => r >= today && r <= oneMonthFromNow).length,
      },
      {
        opSub: 'the next year',
        rowCount: recordsTimeSetToZero.filter(r => r >= today && r <= oneYearFromNow).length,
      },
      {
        opSub: 'the next number of days',
        value: 45,
        rowCount: recordsTimeSetToZero.filter(r => r >= today && r <= daysFromNow45).length,
      },
      {
        opSub: 'the past number of days',
        value: 45,
        rowCount: recordsTimeSetToZero.filter(r => r >= daysAgo45 && r <= today).length,
      },
    ];

    // rest of the filters (without subop type)
    const filterList = [
      {
        opType: 'is blank',
        rowCount: records.list.filter(r => r[dataType] === null || r[dataType] === '').length,
      },
      {
        opType: 'is not blank',
        rowCount: records.list.filter(r => r[dataType] !== null && r[dataType] !== '').length,
      },
    ];

    switch (suiteName) {
      case 'is_is_not':
        for (let i = 0; i < isFilterList.length; i++) {
          await verifyFilter({
            column: dataType,
            opType: 'is',
            opSubType: isFilterList[i].opSub,
            value: isFilterList[i]?.value?.toString() || '',
            result: { rowCount: isFilterList[i].rowCount },
            dataType: dataType,
          });
        }

        // mutually exclusive of "is" filter list
        for (let i = 0; i < isFilterList.length; i++) {
          await verifyFilter({
            column: dataType,
            opType: 'is not',
            opSubType: isFilterList[i].opSub,
            value: isFilterList[i]?.value?.toString() || '',
            result: { rowCount: 800 - isFilterList[i].rowCount },
            dataType: dataType,
          });
        }
        break;

      case 'is_before_is_on_or_before':
        for (let i = 0; i < isAfterFilterList.length; i++) {
          await verifyFilter({
            column: dataType,
            opType: 'is before',
            opSubType: isAfterFilterList[i].opSub,
            value: isAfterFilterList[i]?.value?.toString() || '',
            result: { rowCount: 800 - isAfterFilterList[i].rowCount - 1 },
            dataType: dataType,
          });
        }

        for (let i = 0; i < isAfterFilterList.length; i++) {
          await verifyFilter({
            column: dataType,
            opType: 'is on or before',
            opSubType: isAfterFilterList[i].opSub,
            value: isAfterFilterList[i]?.value?.toString() || '',
            result: { rowCount: 800 - isAfterFilterList[i].rowCount },
            dataType: dataType,
          });
        }
        break;

      case 'is_after_is_on_or_after':
        for (let i = 0; i < isAfterFilterList.length; i++) {
          await verifyFilter({
            column: dataType,
            opType: 'is after',
            opSubType: isAfterFilterList[i].opSub,
            value: isAfterFilterList[i]?.value?.toString() || '',
            result: { rowCount: isAfterFilterList[i].rowCount },
            dataType: dataType,
          });
        }

        for (let i = 0; i < isAfterFilterList.length; i++) {
          await verifyFilter({
            column: dataType,
            opType: 'is on or after',
            opSubType: isAfterFilterList[i].opSub,
            value: isAfterFilterList[i]?.value?.toString() || '',
            result: { rowCount: 1 + isAfterFilterList[i].rowCount },
            dataType: dataType,
          });
        }
        break;

      case 'is_within_is_blank':
        for (let i = 0; i < isWithinFilterList.length; i++) {
          await verifyFilter({
            column: dataType,
            opType: 'is within',
            opSubType: isWithinFilterList[i].opSub,
            value: isWithinFilterList[i]?.value?.toString() || '',
            result: { rowCount: isWithinFilterList[i].rowCount },
            dataType: dataType,
          });
        }

        for (let i = 0; i < filterList.length; i++) {
          await verifyFilter({
            column: dataType,
            opType: filterList[i].opType,
            opSubType: null,
            value: null,
            result: { rowCount: filterList[i].rowCount },
            dataType: dataType,
          });
        }
        break;

      default:
        break;
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
        column_name: 'Date',
        title: 'Date',
        uidt: UITypes.Date,
      },
    ];

    try {
      const project = await api.project.read(context.project.id);
      const table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'dateTimeBased',
        title: 'dateTimeBased',
        columns: columns,
      });

      const rowAttributes = [];
      for (let i = 0; i < 800; i++) {
        const row = {
          Date: rowMixedValue(columns[1], i),
        };
        rowAttributes.push(row);
      }

      await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 800 });
    } catch (e) {
      console.error(e);
    }
  });

  test('Date : is, is not', async () => {
    await dateTimeBasedFilterTest('Date', 'is_is_not');
  });

  test('Date : is before, is on or before', async () => {
    await dateTimeBasedFilterTest('Date', 'is_before_is_on_or_before');
  });

  test('Date : is after, is on or after', async () => {
    await dateTimeBasedFilterTest('Date', 'is_after_is_on_or_after');
  });

  test('Date : is within, is blank', async () => {
    await dateTimeBasedFilterTest('Date', 'is_within_is_blank');
  });
});

// Misc : Checkbox
//

test.describe('Filter Tests: AddOn', () => {
  async function addOnFilterTest(dataType) {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'addOnTypes', networkResponse: false });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();

    const filterList = [
      {
        op: 'is checked',
        value: null,
        rowCount: records.list.filter(r => {
          return r[dataType] === (context.dbType === 'pg' ? true : 1);
        }).length,
      },
      {
        op: 'is not checked',
        value: null,
        rowCount: records.list.filter(r => {
          return r[dataType] !== (context.dbType === 'pg' ? true : 1);
        }).length,
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
        column_name: 'SingleLineText',
        title: 'SingleLineText',
        uidt: UITypes.SingleLineText,
      },
      {
        column_name: 'Checkbox',
        title: 'Checkbox',
        uidt: UITypes.Checkbox,
      },
    ];

    try {
      const project = await api.project.read(context.project.id);
      const table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'addOnTypes',
        title: 'addOnTypes',
        columns: columns,
      });

      const rowAttributes = [];
      for (let i = 0; i < 400; i++) {
        const row = {
          SingleLineText: rowMixedValue(columns[1], i),
          Checkbox: rowMixedValue(columns[2], i),
        };
        rowAttributes.push(row);
      }

      await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 400 });
    } catch (e) {
      console.error(e);
    }
  });

  test('Filter: Checkbox', async () => {
    await addOnFilterTest('Checkbox');
  });
});

// Virtual columns
//

test.describe('Filter Tests: Link to another record, Lookup, Rollup', () => {
  async function linkToAnotherRecordFilterTest() {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country', networkResponse: false });
    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();

    // add filter for CityList column
    const filterList = [
      { op: 'is', value: 'Kabul', rowCount: 1 },
      { op: 'is not', value: 'Kabul', rowCount: 108 },
      { op: 'is like', value: 'bad', rowCount: 2 },
      { op: 'is not like', value: 'bad', rowCount: 107 },
      { op: 'is blank', value: null, rowCount: 0 },
      { op: 'is not blank', value: null, rowCount: 109 },
    ];

    for (let i = 0; i < filterList.length; i++) {
      await verifyFilter({
        column: 'City List',
        opType: filterList[i].op,
        value: filterList[i].value,
        result: { rowCount: filterList[i].rowCount },
        dataType: 'LinkToAnotherRecord',
      });
    }
  }

  async function lookupFilterTest() {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'City', networkResponse: false });
    // Create LookUp column
    await dashboard.grid.column.create({
      title: 'Lookup',
      type: 'Lookup',
      childTable: 'Address List',
      childColumn: 'PostalCode',
    });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();

    // add filter for CityList column
    const filterList = [
      { op: 'is equal', value: '4166', rowCount: 1 },
      { op: 'is not equal', value: '4166', rowCount: 599 },
      { op: 'is like', value: '41', rowCount: 19 },
      { op: 'is not like', value: '41', rowCount: 581 },
      { op: 'is blank', value: null, rowCount: 1 },
      { op: 'is not blank', value: null, rowCount: 599 },
    ];

    for (let i = 0; i < filterList.length; i++) {
      await verifyFilter({
        column: 'Lookup',
        opType: filterList[i].op,
        value: filterList[i].value,
        result: { rowCount: filterList[i].rowCount },
        dataType: 'Lookup',
      });
    }
  }

  async function rollupFilterTest() {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'City', networkResponse: false });
    // Create LookUp column
    await dashboard.grid.column.create({
      title: 'Rollup',
      type: 'Rollup',
      childTable: 'Address List',
      childColumn: 'PostalCode',
      rollupType: 'Sum',
    });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();

    // add filter for CityList column
    const filterList = [
      { op: 'is equal', value: '4166', rowCount: 1 },
      { op: 'is not equal', value: '4166', rowCount: 599 },
      { op: 'is like', value: '41', rowCount: 19 },
      { op: 'is not like', value: '41', rowCount: 581 },
      { op: 'is blank', value: null, rowCount: 2 },
      { op: 'is not blank', value: null, rowCount: 598 },
    ];

    for (let i = 0; i < filterList.length; i++) {
      await verifyFilter({
        column: 'Lookup',
        opType: filterList[i].op,
        value: filterList[i].value,
        result: { rowCount: filterList[i].rowCount },
        dataType: 'Lookup',
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
  });

  test('Filter: LTAR columns', async () => {
    await linkToAnotherRecordFilterTest();
  });

  test('Filter: Lookup columns', async () => {
    await lookupFilterTest();
  });

  test.skip('Filter: Rollup columns', async () => {
    await rollupFilterTest();
  });
});

// Rest of tests
//

test.describe('Filter Tests: Toggle button', () => {
  /**
   *  Steps
   *
   * 1. Open table
   * 2. Verify filter options : should not include NULL & EMPTY options
   * 3. Enable `Show NULL & EMPTY in Filter` in Project Settings
   * 4. Verify filter options : should include NULL & EMPTY options
   * 5. Add NULL & EMPTY filters
   * 6. Disable `Show NULL & EMPTY in Filter` in Project Settings : should not be allowed
   * 7. Remove the NULL & EMPTY filters
   * 8. Disable `Show NULL & EMPTY in Filter` in Project Settings again : should be allowed
   *
   */

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.grid.toolbar;
  });

  test('Filter: Toggle NULL & EMPTY button', async () => {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country', networkResponse: false });

    // Verify filter options
    await verifyFilterOperatorList({
      column: 'Country',
      opType: ['is equal', 'is not equal', 'is like', 'is not like', 'is blank', 'is not blank'],
    });

    // Enable NULL & EMPTY button
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();

    // Verify filter options
    await verifyFilterOperatorList({
      column: 'Country',
      opType: [
        'is equal',
        'is not equal',
        'is like',
        'is not like',
        'is empty',
        'is not empty',
        'is null',
        'is not null',
        'is blank',
        'is not blank',
      ],
    });

    await toolbar.clickFilter({ networkValidation: false });
    await toolbar.filter.add({
      columnTitle: 'Country',
      opType: 'is null',
      value: null,
      isLocallySaved: false,
      dataType: 'SingleLineText',
    });
    await toolbar.clickFilter({ networkValidation: false });

    // Disable NULL & EMPTY button
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
    // wait for toast message
    await dashboard.verifyToast({ message: 'Null / Empty filters exist. Please remove them first.' });

    // remove filter
    await toolbar.filter.reset({ networkValidation: false });

    // Disable NULL & EMPTY button
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
  });
});
