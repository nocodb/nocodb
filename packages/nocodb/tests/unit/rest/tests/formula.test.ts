import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { createBulkRows, listRow, rowMixedValue } from '../../factory/row';
import { updateColumn } from '../../factory/column';
import type Model from '../../../../src/models/Model';
import type Base from '~/models/Base';

let context;
let base: Base;
let table: Model;
let columns: any[];
let unfilteredRecords: any[] = [];

function formulaRegExpBased() {
  // prepare data for test cases
  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
    table = await createTable(context, base, {
      table_name: 'sampleTable',
      title: 'sampleTable',
      columns: [
        {
          column_name: 'Id',
          title: 'Id',
          uidt: UITypes.ID,
        },
        {
          column_name: 'Title',
          title: 'Title',
          uidt: UITypes.SingleLineText,
        },
        {
          column_name: 'formula',
          title: 'formula',
          uidt: UITypes.Formula,
          formula: '20',
        },
      ],
    });

    columns = await table.getColumns();

    const rowAttributes = [];
    for (let i = 0; i < 100; i++) {
      const row = {
        Title: rowMixedValue(columns[1], i),
      };
      rowAttributes.push(row);
    }

    await createBulkRows(context, {
      base,
      table,
      values: rowAttributes,
    });
    unfilteredRecords = await listRow({ base, table });

    // verify length of unfiltered records to be 800
    expect(unfilteredRecords.length).to.equal(100);
  });

  it('Type: REGEX_MATCH ', async () => {
    const formulaList = [
      `REGEX_MATCH("123-45-6789", "\\d{3}-\\d{2}-\\d{4}")`,
      'REGEX_MATCH("123-45-6789", "\\d{3}-\\d{2}-\\d{4}")',
      'REGEX_MATCH("123-45-6789", "\\d{3}-\\d{2}-\\d{4}")',
      'REGEX_MATCH("ABC-45-6789", "\\w{3}-\\d{2}-\\d{4}")',
      'REGEX_MATCH("123-XY-6789", "\\d{3}-\\w{2}-\\d{4}")',
      'REGEX_MATCH("123-45-$#@!", "123-45-[\\s\\S]{4}")',
      'REGEX_MATCH("123456789", "1?2?3?-?4?5-?6?7?8?9?")',
      'REGEX_MATCH("123-456789", "\\d{3}-?\\d{2}-?\\d{4}")',
      'REGEX_MATCH("123-45-6789", "123-\\d{2}-6789")',
    ];

    for (let i = 0; i < formulaList.length; i++) {
      await updateColumn(context, {
        table,
        column: columns[2],
        attr: {
          formula: formulaList[i],
          formula_raw: formulaList[i],
          title: 'formula',
          uidt: UITypes.Formula,
        },
      });

      console.log(formulaList[i]);
      unfilteredRecords = await listRow({ base, table });
      expect(unfilteredRecords[0].formula).to.equal(1);
    }
  });
}

export default function () {
  describe('Formula: REGEXP based', formulaRegExpBased);
}
