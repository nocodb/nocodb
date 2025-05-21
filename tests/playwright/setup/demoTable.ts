import { Api, UITypes } from 'nocodb-sdk';
import { rowMixedValue } from './xcdb-records';

let api: Api<any>;

const columns = {
  selectBased: [
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
  ],

  dateTimeBased: [
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
  ],

  textBased: [
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
  ],

  numberBased: [
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
    {
      column_name: 'Year',
      title: 'Year',
      uidt: UITypes.Year,
    },
    {
      column_name: 'Time',
      title: 'Time',
      uidt: UITypes.Time,
    },
  ],
  groupBased: [
    {
      column_name: 'Id',
      title: 'Id',
      uidt: UITypes.ID,
    },
    {
      column_name: 'Category',
      title: 'Category',
      uidt: UITypes.SingleLineText,
    },
    {
      column_name: 'Sub_Group',
      title: 'Sub_Group',
      uidt: UITypes.SingleLineText,
    },
    {
      column_name: 'Sub_Category',
      title: 'Sub_Category',
      uidt: UITypes.SingleLineText,
    },
    {
      column_name: 'Item',
      title: 'Item',
      uidt: UITypes.SingleLineText,
    },
  ],
  miscellaneous: [
    {
      column_name: 'Id',
      title: 'Id',
      uidt: UITypes.ID,
    },
    {
      column_name: 'Checkbox',
      title: 'Checkbox',
      uidt: UITypes.Checkbox,
    },
    {
      column_name: 'Attachment',
      title: 'Attachment',
      uidt: UITypes.Attachment,
    },
  ],
};

async function createDemoTable({
  context: context,
  recordCnt: recordCnt,
  type: type,
}: {
  context: any;
  recordCnt: number;
  type: string;
}) {
  api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-token': context.apiToken,
    },
  });

  const base = await api.base.read(context.base.id);
  const table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
    table_name: type,
    title: type,
    columns: columns[type],
  });

  if (recordCnt === 0) return table;

  const rowAttributes = [];

  switch (type) {
    case 'selectBased':
      try {
        for (let i = 0; i < recordCnt; i++) {
          const row = {
            SingleSelect: rowMixedValue(columns.selectBased[1], i),
            MultiSelect: rowMixedValue(columns.selectBased[2], i),
          };
          rowAttributes.push(row);
        }
      } catch (e) {
        console.error(e);
      }
      break;
    case 'textBased':
      for (let i = 0; i < recordCnt; i++) {
        const row = {
          SingleLineText: rowMixedValue(columns.textBased[1], i),
          MultiLineText: rowMixedValue(columns.textBased[2], i),
          Email: rowMixedValue(columns.textBased[3], i),
          PhoneNumber: rowMixedValue(columns.textBased[4], i),
          URL: rowMixedValue(columns.textBased[5], i),
        };
        rowAttributes.push(row);
      }
      break;
    case 'numberBased':
      for (let i = 0; i < 400; i++) {
        const row = {
          Number: rowMixedValue(columns.numberBased[1], i),
          Decimal: rowMixedValue(columns.numberBased[2], i),
          Currency: rowMixedValue(columns.numberBased[3], i),
          Percent: rowMixedValue(columns.numberBased[4], i),
          Duration: rowMixedValue(columns.numberBased[5], i),
          Rating: rowMixedValue(columns.numberBased[6], i),
          Year: rowMixedValue(columns.numberBased[7], i),
          Time: rowMixedValue(columns.numberBased[8], i, context.dbType),
        };
        rowAttributes.push(row);
      }
      break;
    case 'groupBased':
      for (let i = 0; i < recordCnt; i++) {
        const row = {
          Category: rowMixedValue(columns.groupBased[1], i + 8),
          Sub_Group: rowMixedValue(columns.groupBased[2], i + 4),
          Sub_Category: rowMixedValue(columns.groupBased[3], i),
          Item: rowMixedValue(columns.groupBased[4], i + 6),
        };
        rowAttributes.push(row);
      }
      break;
    case 'dateTimeBased':
      try {
        for (let i = 0; i < recordCnt; i++) {
          const row = {
            Date: rowMixedValue(columns.dateTimeBased[1], i),
          };
          rowAttributes.push(row);
        }
      } catch (e) {
        console.error(e);
      }
      break;
    case 'miscellaneous':
      try {
        for (let i = 0; i < recordCnt; i++) {
          const row = {
            Checkbox: rowMixedValue(columns.miscellaneous[1], i),
          };
          rowAttributes.push(row);
        }
      } catch (e) {
        console.error(e);
      }
      break;
  }

  await api.dbTableRow.bulkCreate('noco', context.base.id, table.id, rowAttributes);
  return table;
}

export { createDemoTable };
