import 'mocha';
import request from 'supertest';
import { expect } from 'chai';
import { createSakilaProject } from '../../../factory/base';
import init from '../../../init';
import { getTable } from '../../../factory/table';
import { getView } from '../../../factory/view';
import type { Base, Column, Model, View } from '../../../../../src/models';

function bulkAggregationTestsEE() {
  let context;
  let ctx: {
    workspace_id: string;
    base_id: string;
  };
  let sakilaProject: Base;
  let customerTable: Model;
  let customerColumns: Array<Column>;
  let customerView: View;

  beforeEach(async function () {
    console.time('#### bulkAggregationTests');

    context = await init();

    sakilaProject = await createSakilaProject(context);

    ctx = {
      workspace_id: sakilaProject.fk_workspace_id,
      base_id: sakilaProject.id,
    };

    customerTable = await getTable({
      base: sakilaProject,
      name: 'customer',
    });

    customerView = await getView(context, {
      name: 'Customer',
      table: customerTable,
    });

    customerColumns = await customerTable.getColumns(ctx);
  });

  it('Check bulk Aggregation without root filters', async () => {
    const fnColumn = customerColumns.find(
      (c) => c.column_name === 'first_name',
    );

    const lnColumn = customerColumns.find((c) => c.column_name === 'last_name');

    const email = customerColumns.find((c) => c.column_name === 'email');

    const aggregate = JSON.stringify([
      {
        field: fnColumn.id,
        type: 'count_filled',
      },
      {
        field: lnColumn.id,
        type: 'percent_filled',
      },
      {
        field: email.id,
        type: 'count_filled',
      },
    ]);

    const aggFilter = [
      {
        where: '(Payments,gb_eq,12)',
        alias: '12',
      },
      {
        where: '(Payments,gb_eq,14)',
        alias: '14',
      },
      {
        where: '(Payments,gb_eq,15)',
        alias: '15',
      },
    ];

    const bulkAggregate = await request(context.app)
      .post(`/api/v2/tables/${customerTable.id}/bulk/aggregate`)
      .set('xc-auth', context.token)
      .query({
        viewId: customerView.id,
        aggregation: aggregate,
      })
      .send(aggFilter);

    expect(bulkAggregate.body).to.deep.equal({
      12: {
        FirstName: 1,
        LastName: 100,
        Email: 1,
      },
      14: {
        FirstName: 3,
        LastName: 100,
        Email: 3,
      },
      15: {
        FirstName: 2,
        LastName: 100,
        Email: 2,
      },
    });
  });
}

export default function () {
  if (process.env.EE) {
    describe('Bulk Aggregation', bulkAggregationTestsEE);
  }
}
