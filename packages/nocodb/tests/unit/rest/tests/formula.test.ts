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
let ctx: {
  workspace_id: string;
  base_id: string;
};
let base: Base;
let table: Model;
let columns: any[];
let unfilteredRecords: any[] = [];

function formulaRegExpBased() {
  // prepare data for test cases
  beforeEach(async function () {
    context = await init();
    base = await createProject(context);

    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

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

    columns = await table.getColumns(ctx);

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
    // if not pg or mysql, skip regex test since it is not implemented for other databases
    if (!['pg', 'mysql2', 'mysql'].includes(base.sources[0].type)) {
      return;
    }

    const formulaList = [
      `REGEX_MATCH("123-45-6789", "\\d{3}-\\d{2}-\\d{4}")`,
      'REGEX_MATCH("123-45-6789", "\\d{3}-\\d{2}-\\d{4}")',
      'REGEX_MATCH("123-45-6789", "\\d{3}-\\d{2}-\\d{4}")',
      'REGEX_MATCH("ABC-45-6789", "\\w{3}-\\d{2}-\\d{4}")',
      'REGEX_MATCH("123-XY-6789", "\\d{3}-\\D{2}-\\d{4}")',
      'REGEX_MATCH("123-45-$#@!", "123-45-[\\s\\S]{4}")',
      'REGEX_MATCH("123456789", "1?2?3?-?4?5-?6?7?8?9?")',
      'REGEX_MATCH("123-456789", "\\d{3}-?\\d{2}-?\\d{4}")',
      'REGEX_MATCH("123-45-6789", "123-\\d{2}-6789")',
      'REGEX_MATCH("abc123", "[a-z]{3}\\d{3}")',
      'REGEX_MATCH("A1B2C3", "[A-Z]\\d[A-Z]\\d[A-Z]\\d")',
      'REGEX_MATCH("hello123world", "\\w{5}\\d{3}\\w{5}")',
      'REGEX_MATCH("email@example.com", "[a-zA-Z]+@[a-zA-Z]+\\.[a-zA-Z]+")',
      'REGEX_MATCH("2023-12-14", "\\d{4}-\\d{2}-\\d{2}")',
      'REGEX_MATCH("USD 100.50", "USD \\d+\\.\\d{2}")',
      'REGEX_MATCH("http://www.example.com", "https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}")',
      'REGEX_MATCH("555-1234", "\\d{3}-\\d{4}")',
      'REGEX_MATCH("username123", "[a-zA-Z]+\\d{3}")',
      'REGEX_MATCH("apple, orange, banana", "\\w+, \\w+, \\w+")',
      'REGEX_MATCH("aaaabbcc", "(\\w{2})\\1")',
      'REGEX_MATCH("1234567890", "\\d{10}")',
      'REGEX_MATCH("12.34", "\\d+\\.\\d{2}")',
      'REGEX_MATCH("123 Main St, City", "\\d+ [a-zA-Z]+ St, [a-zA-Z]+")',
      'REGEX_MATCH("X1Y2Z3", "[A-Z]\\d[A-Z]\\d[A-Z]\\d")',
      'REGEX_MATCH("555-555-5555", "\\d{3}-\\d{3}-\\d{4}")',
      'REGEX_MATCH("password123", "^(?=.*\\d)(?=.*[a-zA-Z]).{8,}$")',
      'REGEX_MATCH("12345", "^[0-9]{5}$")',
      'REGEX_MATCH("abc123!@#", "[a-zA-Z0-9!@#]+")',
      'REGEX_MATCH("12-December-2023", "\\d{2}-[a-zA-Z]+-\\d{4}")',
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

      unfilteredRecords = await listRow({ base, table });
      expect(unfilteredRecords[0].formula).to.equal(1);
    }
  });
}

export default function () {
  describe('Formula: REGEXP based', formulaRegExpBased);
}
