import 'mocha';
import init from '../../init';
import { createProject } from '../../factory/project';
import Project from '../../../../src/lib/models/Project';
import { createTable } from '../../factory/table';
import { isSqlite } from '../../init/db';
import { UITypes } from 'nocodb-sdk';
import {
  createBulkRows,
  generateDefaultRowAttributes,
  generateMixedRowAttributes,
  rowMixedValue,
  listRow,
} from '../../factory/row';
import Model from '../../../../src/lib/models/Model';
import { expect } from 'chai';

// Test case list

function filterTests() {
  let context;
  let project: Project;
  let table: Model;
  let unfilteredRecords: any[] = [];

  // prepare data for test cases
  beforeEach(async function () {
    context = await init();
    project = await createProject(context);
    table = await createTable(context, project, {
      table_name: 'textBased',
      title: 'TextBased',
      columns: [
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
          column_name: 'Phone',
          title: 'Phone',
          uidt: UITypes.PhoneNumber,
        },
        {
          column_name: 'Url',
          title: 'Url',
          uidt: UITypes.URL,
        },
      ],
    });

    const columns = await table.getColumns();

    let rowAttributes = [];
    for (let i = 0; i < 400; i++) {
      let row = {
        SingleLineText: rowMixedValue(columns[1], i),
        MultiLineText: rowMixedValue(columns[2], i),
        Email: rowMixedValue(columns[3], i),
        Phone: rowMixedValue(columns[4], i),
        Url: rowMixedValue(columns[5], i),
      };
      rowAttributes.push(row);
    }

    await createBulkRows(context, {
      project,
      table,
      values: rowAttributes,
    });
    unfilteredRecords = await listRow({ project, table });

    // verify length of unfiltered records to be 400
    expect(unfilteredRecords.length).to.equal(400);
  });

  it('Type: Single Line Text', async () => {});
}

export default function () {
  describe('Filters', filterTests);
}
