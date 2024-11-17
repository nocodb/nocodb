import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { createBulkRows, rowMixedValue } from '../../factory/row';
import { updateColumn } from '../../factory/column';
import type Model from '../../../../src/models/Model';
import type Base from '../../../../src/models/Base';
import type Column from '../../../../src/models/Column';

const TEST_TYPES = [
  UITypes.LongText,
  UITypes.Attachment,
  UITypes.Checkbox,
  UITypes.MultiSelect,
  UITypes.SingleSelect,
  UITypes.Date,
  UITypes.Year,
  UITypes.Time,
  UITypes.PhoneNumber,
  UITypes.GeoData,
  UITypes.Email,
  UITypes.URL,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Duration,
  UITypes.Rating,
  UITypes.Count,
  UITypes.DateTime,
  UITypes.Geometry,
  UITypes.JSON,
  UITypes.User,
];

async function setup(context, base: Base, type: UITypes) {
  const table = await createTable(context, base, {
    table_name: 'sampleTable',
    title: 'sampleTable',
    columns: [
      {
        column_name: 'Test',
        title: 'Test',
        uidt: type,
      },
    ],
  });

  const column = (
    await table.getColumns({
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    })
  )[0];

  const rowAttributes = [];
  for (let i = 0; i < 100; i++) {
    const row = {
      Title: rowMixedValue(column, i),
    };
    rowAttributes.push(row);
  }

  await createBulkRows(context, {
    base,
    table,
    values: rowAttributes,
  });

  return { table, column };
}

function typeCastTests() {
  let context;
  let base: Base;

  beforeEach(async function () {
    context = await init();
    base = await createProject(context);
  });

  describe('Single Line Text to ', () => {
    let table: Model;
    let column: Column;

    beforeEach(async function () {
      const data = await setup(context, base, UITypes.SingleLineText);
      table = data.table;
      column = data.column;
    });

    for (const type of TEST_TYPES)
      it(type, async () => {
        if (context.dbConfig.client !== 'pg') return;

        const updatedColumn = await updateColumn(context, {
          table,
          column: column,
          attr: {
            ...column,
            uidt: type,
          },
        });

        expect(updatedColumn.uidt).to.equal(type);
      });
  });

  describe('Convert to Single Line Text from ', () => {
    for (const type of TEST_TYPES)
      it(type, async () => {
        if (context.dbConfig.client !== 'pg') return;

        const data = await setup(context, base, type);

        const updatedColumn = await updateColumn(context, {
          table: data.table,
          column: data.column,
          attr: {
            ...data.column,
            uidt: UITypes.SingleLineText,
          },
        });

        expect(updatedColumn.uidt).to.equal(UITypes.SingleLineText);
      });
  });
}

export default function () {
  describe('Field type conversion ', typeCastTests);
}
