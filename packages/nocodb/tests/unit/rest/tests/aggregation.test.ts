import { beforeEach } from 'mocha';
import request from 'supertest';
import { ViewTypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { customColumns, updateGridViewColumn } from '../../factory/column';
import { createView } from '../../factory/view';
import type {
  Base,
  Column,
  GridViewColumn,
  Model,
  View,
} from '../../../../src/models';

const data = [
  {
    Id: 1,
    Title: 'Sample Title',
    LongText: 'This is a sample long text',
    Number: 42,
    Decimal: 3.14,
    Checkbox: true,
    MultiSelect: 'jan',
    SingleSelect: 'jan',
    Date: '2024-01-01',
    DateTime: '2024-01-01T10:00:00Z',
    Year: 2024,
    Time: '10:00:00',
    PhoneNumber: '+1234567890',
    Email: 'example@example.com',
    Url: 'https://example.com',
    Currency: 100.0,
    Percent: 50,
    Duration: 1309,
    Rating: 4,
    JSON: { key: 'value' },
  },
  {
    Id: 2,
    Title: 'Another Title',
    LongText: 'This is another long text',
    Number: 100,
    Decimal: 2.718,
    Checkbox: false,
    MultiSelect: 'mar',
    SingleSelect: 'feb',
    Date: '2024-02-02',
    DateTime: '2024-02-02T12:00:00Z',
    Year: 2025,
    Time: '12:00:00',
    PhoneNumber: '+0987654321',
    Email: 'another@example.com',
    Url: 'https://anotherexample.com',
    Currency: 200.5,
    Percent: 75,
    Duration: 2000,
    Rating: 5,
    JSON: { another_key: 'another_value' },
  },
];

const verificationData = {
  Title: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
  LongText: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
  Number: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
    sum: 142,
    min: 42,
    max: 100,
    avg: 71,
    median: 71,
    std_dev: 29,
    range: 58,
  },
  Decimal: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
    sum: {
      sqlite3: 5.8580000000000005,
      pg: 5.858,
    },
    min: 2.718,
    max: 3.14,
    avg: {
      sqlite3: 2.9290000000000003,
      pg: 2.929,
    },
    median: 2.9290000000000003,
    std_dev: {
      sqlite3: 0.21100000000000008,
      pg: 0.211,
    },
    range: {
      sqlite3: 0.42200000000000015,
      pg: 0.422,
    },
  },
  Checkbox: {
    checked: 1,
    unchecked: 1,
    percent_checked: 50,
    percent_unchecked: 50,
  },
  MultiSelect: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
  SingleSelect: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
  Date: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
    earliest_date: '2024-01-01',
    latest_date: '2024-02-02',
    date_range: 32,
    month_range: 1,
  },
  DateTime: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
    earliest_date: '2024-01-01 10:00:00+00:00',
    latest_date: '2024-02-02 12:00:00+00:00',
    date_range: 32,
    month_range: 1,
  },
  Year: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
  Time: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
  PhoneNumber: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
  Email: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
  Url: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
  Currency: {
    sum: 300.5,
    min: 100,
    max: 200.5,
    avg: 150.25,
    median: 150.25,
    std_dev: 50.25,
    range: 100.5,
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
  Percent: {
    sum: 125,
    min: 50,
    max: 75,
    avg: 62.5,
    median: 62.5,
    std_dev: 12.5,
    range: 25,
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
  Duration: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
    sum: 3309,
    min: 1309,
    max: 2000,
    avg: 1654.5,
    median: 1654.5,
    std_dev: 345.5,
    range: 691,
  },

  Rating: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
    sum: 9,
    min: 4,
    max: 5,
    avg: 4.5,
    median: 4.5,
    std_dev: 0.5,
    range: 1,
  },

  JSON: {
    count_unique: 2,
    count_empty: 0,
    count_filled: 2,
    percent_unique: 100,
    percent_filled: 100,
    percent_empty: 0,
  },
};

function aggregationTests() {
  let context;
  let ctx: {
    workspace_id: string;
    base_id: string;
  };

  let base: Base;
  let table: Model;
  let columns: Array<Column>;
  let gridView: View;

  let gridViewColumns: Array<GridViewColumn>;

  beforeEach(async function () {
    console.time('#### aggregationTests');

    context = await init();

    base = await createProject(context);

    ctx = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    table = await createTable(context, base, {
      columns: customColumns('aggregationBased'),
    });

    gridView = await createView(context, {
      table,
      type: ViewTypes.GRID,
      title: 'Aggregation View',
    });

    columns = await table.getColumns(ctx);

    gridViewColumns = (
      await request(context.app)
        .get(`/api/v1/db/meta/views/${gridView.id}/columns`)
        .set('xc-auth', context.token)
        .expect(200)
    ).body.list;

    await request(context.app)
      .post(`/api/v2/tables/${table.id}/records`)
      .set('xc-auth', context.token)
      .send(data)
      .expect(200);
  });

  it('should get aggregation data, async function', async () => {
    const db = context.dbConfig.client;

    const aggregate = (
      await request(context.app)
        .get(`/api/v2/tables/${table.id}/aggregate`)
        .query({
          viewId: gridView.id,
        })
        .set('xc-auth', context.token)
        .expect(200)
    ).body;

    expect(aggregate).to.deep.equal({});

    for (const x of Object.entries(verificationData)) {
      const colName = x[0];

      const col = columns.find((c) => c.title === colName);

      for (const y of Object.entries(x[1])) {
        const x = await updateGridViewColumn(context, {
          view: gridView,
          column: gridViewColumns.find((c) => c.fk_column_id === col.id),
          attr: {
            aggregation: y[0],
          },
        });

        const aggregate = (
          await request(context.app)
            .get(`/api/v2/tables/${table.id}/aggregate`)
            .query({
              viewId: gridView.id,
            })
            .set('xc-auth', context.token)
            .expect(200)
        ).body;

        expect(aggregate[colName]).to.equal(
          y[1] instanceof Object ? y[1][db] : y[1],
          `Failed for ${colName} ${y[0]}`,
        );
      }
    }
  });
}

export default function () {
  describe('Aggregation, aggregationTests', aggregationTests);
}
