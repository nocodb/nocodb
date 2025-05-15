import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { UITypes } from 'nocodb-sdk';
import { Api } from 'nocodb-sdk';
import { rowMixedValue } from '../../../setup/xcdb-records';
import dayjs from 'dayjs';
import { createDemoTable } from '../../../setup/demoTable';
import { enableQuickRun } from '../../../setup/db';

let dashboard: DashboardPage, toolbar: ToolbarPage;
let context: any;
let api: Api<any>;
let records: Record<string, any>;

const skipList = {
  Number: ['is null', 'is not null'],
  Year: ['is null', 'is not null'],
  Decimal: ['is null', 'is not null'],
  Percent: ['is null', 'is not null'],
  Currency: ['is null', 'is not null'],
  Rating: ['is null', 'is not null', 'is blank', 'is not blank'],
  Duration: ['is null', 'is not null'],
  Time: ['is null', 'is not null'],
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

async function verifyFilter_withFixedModal(param: {
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

  await toolbar.filter.add({
    title: param.column,
    operation: param.opType,
    subOperation: param.opSubType,
    value: param.value,
    locallySaved: false,
    dataType: param?.dataType,
    openModal: true,
  });

  // verify filtered rows
  await validateRowArray({
    rowCount: param.result.rowCount,
  });
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

  await toolbar.filter.add({
    title: param.column,
    operation: param.opType,
    subOperation: param.opSubType,
    value: param.value,
    locallySaved: false,
    dataType: param?.dataType,
    openModal: true,
    skipWaitingResponse: true,
  });

  // verify filtered rows
  await validateRowArray({
    rowCount: param.result.rowCount,
  });
}

// Number based filters
//

test.describe('Filter Tests: Numerical', () => {
  if (enableQuickRun()) test.skip();
  async function numBasedFilterTest(dataType, eqString, isLikeString) {
    await dashboard.treeView.openTable({ title: 'numberBased' });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
    await dashboard.treeView.openTable({ title: 'numberBased' });

    let eqStringDerived = eqString;
    let isLikeStringDerived = isLikeString;
    if (dataType === 'Duration') {
      // convert from hh:mm to seconds
      eqStringDerived = parseInt(eqString.split(':')[0]) * 3600 + parseInt(eqString.split(':')[1]) * 60;
      isLikeStringDerived = parseInt(isLikeString.split(':')[0]) * 3600 + parseInt(isLikeString.split(':')[1]) * 60;
    }

    // convert r[Time] in format 2021-01-01 00:00:00+05.30 to 00:00:00
    if (dataType === 'Time') {
      records.list.forEach(r => {
        if (r[dataType]?.length > 8) r[dataType] = r[dataType]?.split(' ')[1]?.split(/[+-]/)[0];
      });
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
        rowCount: records.list.filter(r => r[dataType] === null || r[dataType] === undefined).length,
      },
      {
        op: 'is not blank',
        value: '',
        rowCount: records.list.filter(r => r[dataType] !== null && r[dataType] !== undefined).length,
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

    await toolbar.clickFilter();
    await toolbar.filter.clickAddFilter();
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
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const table = await createDemoTable({ context, type: 'numberBased', recordCnt: 400 });
    records = await api.dbTableRow.list('noco', context.base.id, table.id, { limit: 400 });
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
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

  test('Filter: Year', async () => {
    await numBasedFilterTest('Year', '2023', '2024');
  });

  test('Filter: Time', async () => {
    const getTime = date => {
      let hours = date.getHours();
      let minutes = date.getMinutes();
      let seconds = date.getSeconds();
      // let ap = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      hours = hours.toString().padStart(2, '0');
      minutes = minutes.toString().padStart(2, '0');
      seconds = seconds.toString().padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    };

    // compute timezone offset
    const offset = new Date().getTimezoneOffset();
    const timezoneOffset =
      (offset <= 0 ? '+' : '-') +
      String(Math.abs(Math.round(offset / 60))).padStart(2, '0') +
      ':' +
      String(Math.abs(offset % 60)).padStart(2, '0');

    const date1 = new Date(`1999-01-01 02:02:00${timezoneOffset}`);
    const date2 = new Date(`1999-01-01 04:04:00${timezoneOffset}`);

    await numBasedFilterTest('Time', getTime(date1), getTime(date2));
  });
});

// Text based filters
//

test.describe('Filter Tests: Text based', () => {
  if (enableQuickRun()) test.skip();
  async function textBasedFilterTest(dataType, eqString, isLikeString) {
    await dashboard.treeView.openTable({ title: 'textBased' });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
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

    await toolbar.clickFilter();
    await toolbar.filter.clickAddFilter();
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
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const table = await createDemoTable({ context, type: 'textBased', recordCnt: 400 });
    records = await api.dbTableRow.list('noco', context.base.id, table.id, { limit: 400 });
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
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
  if (enableQuickRun()) test.skip();
  async function selectBasedFilterTest(dataType, is, anyof, allof) {
    await dashboard.treeView.openTable({ title: 'selectBased' });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
    await dashboard.treeView.openTable({ title: 'selectBased' });

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

    await toolbar.clickFilter();
    await toolbar.filter.clickAddFilter();
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
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const table = await createDemoTable({ context, type: 'selectBased', recordCnt: 400 });
    records = await api.dbTableRow.list('noco', context.base.id, table.id, { limit: 400 });

    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Filter: Single Select', async () => {
    // hack. jan inserted twice as in filter, toggling operation is not clearing value
    await selectBasedFilterTest('SingleSelect', 'jan', 'jan,jan,feb,mar', '');
  });

  test('Filter: Multi Select', async () => {
    await selectBasedFilterTest('MultiSelect', '', 'jan,jan,feb,mar', 'jan,feb,mar');
  });
});

// Date & Time related
//

function getUTCEpochTime(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0);
}

test.describe('Filter Tests: Date based', () => {
  if (enableQuickRun()) test.skip();
  const today = getUTCEpochTime(new Date());
  const tomorrow = getUTCEpochTime(new Date(new Date().setDate(new Date().getDate() + 1)));
  const yesterday = getUTCEpochTime(new Date(new Date().setDate(new Date().getDate() - 1)));
  const oneWeekAgo = getUTCEpochTime(new Date(new Date().setDate(new Date().getDate() - 7)));
  const oneWeekFromNow = getUTCEpochTime(new Date(new Date().setDate(new Date().getDate() + 7)));
  const oneMonthAgo = getUTCEpochTime(dayjs().subtract(1, 'month').toDate());
  const oneMonthFromNow = getUTCEpochTime(dayjs().add(1, 'month').toDate());
  const daysAgo45 = getUTCEpochTime(new Date(new Date().setDate(new Date().getDate() - 45)));
  const daysFromNow45 = getUTCEpochTime(new Date(new Date().setDate(new Date().getDate() + 45)));
  const thisMonth15 = getUTCEpochTime(new Date(new Date().setDate(15)));
  const oneYearAgo = getUTCEpochTime(new Date(new Date().setFullYear(new Date().getFullYear() - 1)));
  const oneYearFromNow = getUTCEpochTime(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));

  async function dateTimeBasedFilterTest(dataType, setCount) {
    await dashboard.treeView.openTable({ title: 'dateTimeBased' });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
    await dashboard.treeView.openTable({ title: 'dateTimeBased' });

    // records array with time set to 00:00:00; store time in unix epoch
    const recordsTimeSetToZero = records.list.map(r => {
      const date = new Date(r[dataType]);
      return getUTCEpochTime(date);
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

    await toolbar.clickFilter();
    await toolbar.filter.clickAddFilter();

    if (setCount === 0) {
      // "is" filter list
      for (let i = 0; i < isFilterList.length; i++) {
        await verifyFilter_withFixedModal({
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
        await verifyFilter_withFixedModal({
          column: dataType,
          opType: 'is not',
          opSubType: isFilterList[i].opSub,
          value: isFilterList[i]?.value?.toString() || '',
          result: { rowCount: 800 - isFilterList[i].rowCount },
          dataType: dataType,
        });
      }

      // "is before" filter list
      for (let i = 0; i < isAfterFilterList.length; i++) {
        await verifyFilter_withFixedModal({
          column: dataType,
          opType: 'is before',
          opSubType: isAfterFilterList[i].opSub,
          value: isAfterFilterList[i]?.value?.toString() || '',
          result: { rowCount: 800 - isAfterFilterList[i].rowCount - 1 },
          dataType: dataType,
        });
      }
    } else {
      // "is on or before" filter list
      for (let i = 0; i < isAfterFilterList.length; i++) {
        await verifyFilter_withFixedModal({
          column: dataType,
          opType: 'is on or before',
          opSubType: isAfterFilterList[i].opSub,
          value: isAfterFilterList[i]?.value?.toString() || '',
          result: { rowCount: 800 - isAfterFilterList[i].rowCount },
          dataType: dataType,
        });
      }

      // "is after" filter list
      for (let i = 0; i < isAfterFilterList.length; i++) {
        await verifyFilter_withFixedModal({
          column: dataType,
          opType: 'is after',
          opSubType: isAfterFilterList[i].opSub,
          value: isAfterFilterList[i]?.value?.toString() || '',
          result: { rowCount: isAfterFilterList[i].rowCount },
          dataType: dataType,
        });
      }

      // "is on or after" filter list
      for (let i = 0; i < isAfterFilterList.length; i++) {
        await verifyFilter_withFixedModal({
          column: dataType,
          opType: 'is on or after',
          opSubType: isAfterFilterList[i].opSub,
          value: isAfterFilterList[i]?.value?.toString() || '',
          result: { rowCount: 1 + isAfterFilterList[i].rowCount },
          dataType: dataType,
        });
      }

      // "is within" filter list
      // if today is Feb 29, then past year will have 1 more record and next year will have 1 less record
      const dateToday = new Date();
      if (dateToday.getMonth() === 1 && dateToday.getDate() === 29) {
        // past year
        isWithinFilterList[2].rowCount += 1;
        // next year
        isWithinFilterList[5].rowCount -= 1;
      }

      for (let i = 0; i < isWithinFilterList.length; i++) {
        await verifyFilter_withFixedModal({
          column: dataType,
          opType: 'is within',
          opSubType: isWithinFilterList[i].opSub,
          value: isWithinFilterList[i]?.value?.toString() || '',
          result: { rowCount: isWithinFilterList[i].rowCount },
          dataType: dataType,
        });
      }

      // "is blank" and "is not blank" filter list
      for (let i = 0; i < filterList.length; i++) {
        await verifyFilter_withFixedModal({
          column: dataType,
          opType: filterList[i].opType,
          opSubType: null,
          value: null,
          result: { rowCount: filterList[i].rowCount },
          dataType: dataType,
        });
      }
    }
  }

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const table = await createDemoTable({ context, type: 'dateTimeBased', recordCnt: 800 });
    records = await api.dbTableRow.list('noco', context.base.id, table.id, { limit: 800 });

    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Date : filters-1', async () => {
    await dateTimeBasedFilterTest('Date', 0);
  });

  test('Date : filters-2', async () => {
    await dateTimeBasedFilterTest('Date', 1);
  });
});

// Misc : Checkbox
//

test.describe('Filter Tests: AddOn', () => {
  if (enableQuickRun()) test.skip();
  async function addOnFilterTest(dataType) {
    await dashboard.treeView.openTable({ title: 'addOnTypes', networkResponse: false });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
    await dashboard.treeView.openTable({ title: 'addOnTypes', networkResponse: false });

    const filterList = [
      {
        op: 'is checked',
        value: null,
        rowCount: records.list.filter(r => {
          return r[dataType];
        }).length,
      },
      {
        op: 'is not checked',
        value: null,
        rowCount: records.list.filter(r => {
          return r[dataType];
        }).length,
      },
    ];

    await toolbar.clickFilter();
    await toolbar.filter.clickAddFilter();
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
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
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
      const base = await api.base.read(context.base.id);
      const table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
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

      await api.dbTableRow.bulkCreate('noco', context.base.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', context.base.id, table.id, { limit: 400 });
    } catch (e) {
      console.error(e);
    }
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Filter: Checkbox', async () => {
    await addOnFilterTest('Checkbox');
  });
});

// Virtual columns
//

test.describe('Filter Tests: Link to another record, Lookup, Rollup', () => {
  if (enableQuickRun()) test.skip();
  async function linkToAnotherRecordFilterTest() {
    await dashboard.treeView.openTable({ title: 'Country', networkResponse: false });
    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
    await dashboard.treeView.openTable({ title: 'Country', networkResponse: false });

    // add filter for CityList column
    const filterList = [
      { op: '=', value: '5', rowCount: 5 },
      { op: '!=', value: '5', rowCount: 104 },
      { op: '>', value: '5', rowCount: 25 },
      { op: '<', value: '5', rowCount: 79 },
      { op: '>=', value: '5', rowCount: 30 },
      { op: '<=', value: '5', rowCount: 84 },
    ];

    await toolbar.clickFilter();
    await toolbar.filter.clickAddFilter();
    for (let i = 0; i < filterList.length; i++) {
      await verifyFilter({
        column: 'Cities',
        opType: filterList[i].op,
        value: filterList[i].value,
        result: { rowCount: filterList[i].rowCount },
        dataType: 'Links',
      });
    }
  }

  async function lookupFilterTest() {
    await dashboard.treeView.openTable({ title: 'City', networkResponse: false });
    // Create LookUp column
    await dashboard.grid.column.create({
      title: 'Lookup',
      type: 'Lookup',
      childTable: 'Country',
      childColumn: 'Country',
    });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
    await dashboard.treeView.openTable({ title: 'City', networkResponse: false });

    // add filter for CityList column
    const filterList = [
      { op: 'is equal', value: 'Spain', rowCount: 5 },
      { op: 'is not equal', value: 'Spain', rowCount: 595 },
      { op: 'is like', value: 'ca', rowCount: 28 },
      { op: 'is not like', value: 'ca', rowCount: 572 },
      { op: 'is blank', value: null, rowCount: 0 },
      { op: 'is not blank', value: null, rowCount: 600 },
    ];

    await toolbar.clickFilter();
    await toolbar.filter.clickAddFilter();
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
    await dashboard.treeView.openTable({ title: 'City', networkResponse: false });
    // Create LookUp column
    await dashboard.grid.column.create({
      title: 'Rollup',
      type: 'Rollup',
      childTable: 'Addresses',
      childColumn: 'PostalCode',
      rollupType: 'Sum',
    });

    // Enable NULL & EMPTY filters
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
    await dashboard.treeView.openTable({ title: 'City', networkResponse: false });

    // add filter for CityList column
    const filterList = [
      { op: 'is equal', value: '4166', rowCount: 1 },
      { op: 'is not equal', value: '4166', rowCount: 599 },
      { op: 'is like', value: '41', rowCount: 19 },
      { op: 'is not like', value: '41', rowCount: 581 },
      { op: 'is empty', value: '41', rowCount: 581 },
      { op: 'is not empty', value: '41', rowCount: 581 },
      { op: 'is blank', value: null, rowCount: 2 },
      { op: 'is not blank', value: null, rowCount: 598 },
    ];

    await toolbar.clickFilter();
    await toolbar.filter.clickAddFilter();
    for (let i = 0; i < filterList.length; i++) {
      await verifyFilter({
        column: 'Rollup',
        opType: filterList[i].op,
        value: filterList[i].value,
        result: { rowCount: filterList[i].rowCount },
        dataType: 'Rollup',
      });
    }
  }

  test.beforeEach(async ({ page }) => {
    // todo: confirm with @dstala
    // context = await setup({ page, isEmptyProject: true });
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
  });

  test.afterEach(async () => {
    await unsetup(context);
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
  if (enableQuickRun()) test.skip();
  /**
   *  Steps
   *
   * 1. Open table
   * 2. Verify filter options : should not include NULL & EMPTY options
   * 3. Enable `Show NULL & EMPTY in Filter` in Base Settings
   * 4. Verify filter options : should include NULL & EMPTY options
   * 5. Add NULL & EMPTY filters
   * 6. Disable `Show NULL & EMPTY in Filter` in Base Settings : should not be allowed
   * 7. Remove the NULL & EMPTY filters
   * 8. Disable `Show NULL & EMPTY in Filter` in Base Settings again : should be allowed
   *
   */

  test.beforeEach(async ({ page }) => {
    // todo: confirm with @dstala
    // context = await setup({ page, isEmptyProject: true });
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Filter: Toggle NULL & EMPTY button', async () => {
    await dashboard.treeView.openTable({ title: 'Country', networkResponse: false });

    // Verify filter options
    await verifyFilterOperatorList({
      column: 'Country',
      opType: ['is equal', 'is not equal', 'is like', 'is not like', 'is blank', 'is not blank'],
    });

    // Enable NULL & EMPTY button
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
    await dashboard.treeView.openTable({ title: 'Country', networkResponse: false });

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
      title: 'Country',
      operation: 'is null',
      value: null,
      locallySaved: false,
      dataType: 'SingleLineText',
    });
    await toolbar.clickFilter({ networkValidation: false });

    // Disable NULL & EMPTY button
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
    await dashboard.treeView.openTable({ title: 'Country', networkResponse: false });
    // wait for toast message
    await dashboard.verifyToast({ message: 'Null / Empty filters exist. Please remove them first.' });

    // remove filter
    await toolbar.filter.reset({ networkValidation: false });

    // Disable NULL & EMPTY button
    await dashboard.gotoSettings();
    await dashboard.settings.toggleNullEmptyFilters();
    await dashboard.treeView.openTable({ title: 'Country', networkResponse: false });
  });
});

test.describe('Filter Tests: Filter groups', () => {
  if (enableQuickRun()) test.skip();
  /**
   *  Steps
   *
   * 1. Open table
   * 2. Verify filter options : should not include NULL & EMPTY options
   * 3. Enable `Show NULL & EMPTY in Filter` in Base Settings
   * 4. Verify filter options : should include NULL & EMPTY options
   * 5. Add NULL & EMPTY filters
   * 6. Disable `Show NULL & EMPTY in Filter` in Base Settings : should not be allowed
   * 7. Remove the NULL & EMPTY filters
   * 8. Disable `Show NULL & EMPTY in Filter` in Base Settings again : should be allowed
   *
   */

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Filter: Empty filters', async () => {
    await dashboard.treeView.openTable({ title: 'Country', networkResponse: false });

    await toolbar.clickFilter({ networkValidation: false });
    await toolbar.filter.addFilterGroup({
      title: 'Country',
      operation: 'is equal',
      value: 'Argentina',
    });
    await toolbar.clickFilter({ networkValidation: false });

    await toolbar.clickFilter({ networkValidation: false });
    await toolbar.filter.addFilterGroup({
      title: 'Country',
      operation: 'is equal',
      value: 'Indonesia',
      filterGroupIndex: 1,
      filterLogicalOperator: 'OR',
    });
    await toolbar.clickFilter({ networkValidation: false });

    await validateRowArray({
      rowCount: 2,
    });
  });
});
