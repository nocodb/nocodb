import { expect } from 'chai';
import { NcApiVersion, UITypes } from 'nocodb-sdk';
import { createProject, createSakilaProject } from '../../../factory/base';
import { createLtarColumn, customColumns } from '../../../factory/column';
import { createBulkRows, listRow, rowMixedValue } from '../../../factory/row';
import { createTable, getTable } from '../../../factory/table';
import init from '../../../init';
import { addUsers, getUsers, prepareRecords } from './helpers';
import type { ITestContext } from './helpers';
import type { ColumnType } from 'nocodb-sdk';
import type { Model } from '../../../../../src/models';

export const beforeEach = async () => {
  const context = await init();

  const sakilaProject = await createSakilaProject(context);
  const base = await createProject(context);

  const ctx = {
    workspace_id: base.fk_workspace_id!,
    base_id: base.id,
  };

  const countryTable = await getTable({
    base: sakilaProject,
    name: 'country',
  });

  const cityTable = await getTable({
    base: sakilaProject,
    name: 'city',
  });

  return {
    context,
    ctx,
    sakilaProject,
    base,
    countryTable,
    cityTable,
  } as ITestContext;
};

export const beforeEachTextBased = async (testContext: ITestContext) => {
  const createColumns = customColumns('textBased', undefined, {
    Email: {
      func: ['isEmail'],
      args: [''],
      msg: ['Validation failed : isEmail'],
      validate: true,
    },
  });
  const table = await createTable(testContext.context, testContext.base, {
    table_name: 'textBased',
    title: 'TextBased',
    columns: createColumns,
  });

  // retrieve column meta
  const columns = await table.getColumns(testContext.ctx);
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
  const insertedRecords = await listRow({ base: testContext.base, table });

  // verify length of unfiltered records to be 400
  expect(insertedRecords.length).to.equal(400);

  return {
    table,
    columns,
    insertedRecords,
  };
};

export const beforeEachNumberBased = async (testContext: ITestContext) => {
  const table = await createTable(testContext.context, testContext.base, {
    table_name: 'numberBased',
    title: 'numberBased',
    columns: customColumns('numberBased'),
  });

  // retrieve column meta
  const columns = await table.getColumns(testContext.ctx);

  // build records
  const rowAttributes: {
    Number: string | number | string[] | null;
    Decimal: string | number | string[] | null;
    Currency: string | number | string[] | null;
    Percent: string | number | string[] | null;
    Duration: string | number | string[] | null;
    Rating: string | number | string[] | null;
  }[] = [];
  for (let i = 0; i < 400; i++) {
    const row = {
      Number: rowMixedValue(columns[6], i),
      Decimal: rowMixedValue(columns[7], i),
      Currency: rowMixedValue(columns[8], i),
      Percent: rowMixedValue(columns[9], i),
      Duration: rowMixedValue(columns[10], i),
      Rating: rowMixedValue(columns[11], i),
      Year: rowMixedValue(columns[12], i),
    };
    rowAttributes.push(row);
  }

  // insert records
  await createBulkRows(testContext.context, {
    base: testContext.base,
    table,
    values: rowAttributes,
  });

  // retrieve inserted records
  const insertedRecords = await listRow({ base: testContext.base, table });

  // verify length of unfiltered records to be 400
  expect(insertedRecords.length).to.equal(400);
  return {
    table,
    columns,
    insertedRecords,
  };
};

export const beforeEachSelectBased = async (testContext: ITestContext) => {
  const table = await createTable(testContext.context, testContext.base, {
    table_name: 'selectBased',
    title: 'selectBased',
    columns: customColumns('selectBased'),
  });

  // retrieve column meta
  const columns = await table.getColumns(testContext.ctx);

  // build records
  const rowAttributes: {
    SingleSelect: string | number | null | string[];
    MultiSelect: string | number | null | string[];
  }[] = [];
  for (let i = 0; i < 400; i++) {
    const row = {
      SingleSelect: rowMixedValue(columns[6], i),
      MultiSelect: rowMixedValue(columns[7], i, true),
    };
    rowAttributes.push(row);
  }

  // insert records
  await createBulkRows(testContext.context, {
    base: testContext.base,
    table,
    values: rowAttributes,
  });

  // retrieve inserted records
  const insertedRecords = await listRow({ base: testContext.base, table });

  // verify length of unfiltered records to be 400
  expect(insertedRecords.length).to.equal(400);

  return {
    table,
    columns,
    insertedRecords,
  };
};

export const beforeEachDateBased = async (testContext: ITestContext) => {
  const table = await createTable(testContext.context, testContext.base, {
    table_name: 'dateBased',
    title: 'dateBased',
    columns: customColumns('dateBased'),
  });

  // retrieve column meta
  const columns = await table.getColumns(testContext.ctx);

  // build records
  // 800: one year before to one year after
  const rowAttributes: {
    Date: string | string[] | number | null;
    DateTime: string | string[] | number | null;
  }[] = [];
  for (let i = 0; i < 800; i++) {
    const row = {
      Date: rowMixedValue(columns[6], i),
      DateTime: rowMixedValue(columns[7], i),
    };
    rowAttributes.push(row);
  }

  // insert records
  await createBulkRows(testContext.context, {
    base: testContext.base,
    table,
    values: rowAttributes,
  });

  // retrieve inserted records
  const insertedRecords = await listRow({
    base: testContext.base,
    table,
    options: { apiVersion: NcApiVersion.V3, limit: 800 },
  });

  // verify length of unfiltered records to be 800
  expect(insertedRecords.length).to.equal(800);

  return {
    table,
    columns,
    insertedRecords,
  };
};

export const beforeEachLinkBased = async (testContext: ITestContext) => {
  let tblCity: Model;
  let tblCountry: Model;
  let tblActor: Model;
  let tblFilm: Model;

  let columnsFilm: ColumnType[];
  let columnsActor: ColumnType[];
  let columnsCountry: ColumnType[];
  let columnsCity: ColumnType[];
  const columns = [
    {
      title: 'Title',
      column_name: 'Title',
      uidt: UITypes.SingleLineText,
      pv: true,
    },
  ];

  try {
    // Prepare City table
    columns[0].title = 'City';
    columns[0].column_name = 'City';
    tblCity = await createTable(testContext.context, testContext.base, {
      title: 'City',
      table_name: 'City',
      columns: customColumns('custom', columns),
    });
    const cityRecords = prepareRecords('City', 100, 1, { ignoreId: true });

    // insert records
    await createBulkRows(testContext.context, {
      base: testContext.base,
      table: tblCity,
      values: cityRecords,
    });

    const _insertedRecords = await listRow({
      base: testContext.base,
      table: tblCity,
    });

    // Prepare Country table
    columns[0].title = 'Country';
    columns[0].column_name = 'Country';
    tblCountry = await createTable(testContext.context, testContext.base, {
      title: 'Country',
      table_name: 'Country',
      columns: customColumns('custom', columns),
    });
    const countryRecords = prepareRecords('Country', 100, 1, {
      ignoreId: true,
    });
    // insert records
    await createBulkRows(testContext.context, {
      base: testContext.base,
      table: tblCountry,
      values: countryRecords,
    });

    // Prepare Actor table
    columns[0].title = 'Actor';
    columns[0].column_name = 'Actor';
    tblActor = await createTable(testContext.context, testContext.base, {
      title: 'Actor',
      table_name: 'Actor',
      columns: customColumns('custom', columns),
    });
    const actorRecords = prepareRecords('Actor', 100, 1, { ignoreId: true });
    await createBulkRows(testContext.context, {
      base: testContext.base,
      table: tblActor,
      values: actorRecords,
    });

    // Prepare Movie table
    columns[0].title = 'Film';
    columns[0].column_name = 'Film';
    tblFilm = await createTable(testContext.context, testContext.base, {
      title: 'Film',
      table_name: 'Film',
      columns: customColumns('custom', columns),
    });
    const filmRecords = prepareRecords('Film', 100, 1, { ignoreId: true });
    await createBulkRows(testContext.context, {
      base: testContext.base,
      table: tblFilm,
      values: filmRecords,
    });

    // Create links
    // Country <hm> City
    await createLtarColumn(testContext.context, {
      title: 'Cities',
      parentTable: tblCountry,
      childTable: tblCity,
      type: 'hm',
    });
    await createLtarColumn(testContext.context, {
      title: 'Films',
      parentTable: tblActor,
      childTable: tblFilm,
      type: 'mm',
    });

    columnsFilm = await tblFilm.getColumns(testContext.ctx);
    columnsActor = await tblActor.getColumns(testContext.ctx);
    columnsCountry = await tblCountry.getColumns(testContext.ctx);
    columnsCity = await tblCity.getColumns(testContext.ctx);
  } catch (e) {
    console.log(e);
  }
  return {
    tblCity: tblCity!,
    tblCountry: tblCountry!,
    tblActor: tblActor!,
    tblFilm: tblFilm!,
    columnsFilm: columnsFilm!,
    columnsActor: columnsActor!,
    columnsCountry: columnsCountry!,
    columnsCity: columnsCity!,
  };
};

export const beforeEachCheckbox = async (testContext: ITestContext) => {
  const createColumns = [
    {
      column_name: 'id',
      title: 'Id',
      uidt: UITypes.ID,
      description: `id ${UITypes.ID}`,
    },
    {
      uidt: UITypes.Checkbox,
      column_name: 'Checkbox',
      title: 'Checkbox',
    },
  ];
  const table = await createTable(testContext.context, testContext.base, {
    table_name: 'checkboxBased',
    title: 'CheckboxBased',
    columns: createColumns,
  });

  const columns = await table.getColumns(testContext.ctx);

  return {
    table,
    columns,
  };
};

export const beforeEachUserBased = async (testContext: ITestContext) => {
  const table = await createTable(testContext.context, testContext.base, {
    table_name: 'userBased',
    title: 'userBased',
    columns: customColumns('userBased'),
  });

  const columns = await table.getColumns(testContext.ctx);

  // add users to workspace
  const users = [
    ['a@nocodb.com', 'FirstName_a LastName_a'],
    ['b@nocodb.com', 'FirstName_b LastName_b'],
    ['c@nocodb.com', 'FirstName_c LastName_c'],
    ['d@nocodb.com', 'FirstName_d LastName_d'],
    ['e@nocodb.com', 'FirstName_e LastName_e'],
  ];
  for (const user of users) {
    await addUsers(testContext, user[0], user[1]);
  }
  const userList = await getUsers(testContext);

  userList[userList.length] = { email: null, displayName: 'AB' };
  userList[userList.length] = { email: '', displayName: 'CD' };

  // build records
  const rowAttributes: any[] = [];
  for (let i = 0; i < 400; i++) {
    const row = {
      userFieldSingle: [{ email: userList[i % userList.length].email }],
      userFieldMulti: [
        { email: userList[i % userList.length].email },
        { email: userList[(i + 1) % userList.length].email },
      ],
    };
    rowAttributes.push(row);
  }

  // insert records
  await createBulkRows(testContext.context, {
    base: testContext.base,
    table,
    values: rowAttributes,
  });
  return {
    table,
    columns,
  };
};
