import { expect } from 'chai';
import { createProject, createSakilaProject } from '../../../factory/base';
import { customColumns } from '../../../factory/column';
import { createBulkRows, listRow, rowMixedValue } from '../../../factory/row';
import { createTable, getTable } from '../../../factory/table';
import init from '../../../init';
import type { Base, Model } from '../../../../../src/models';

export interface ITestContext {
  context: Awaited<ReturnType<typeof init>>;
  ctx: {
    workspace_id: any;
    base_id: any;
  };
  sakilaProject: Base;
  base: Base;
  countryTable: Model;
  cityTable: Model;
}

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
  const table = await createTable(testContext.context, testContext.base, {
    table_name: 'textBased',
    title: 'TextBased',
    columns: customColumns('textBased'),
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
