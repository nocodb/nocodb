import { UITypes } from 'nocodb-sdk';
import request from 'supertest';
import { assert, expect } from 'chai';
import { createColumn, createLookupColumn } from '../../factory/column';
import { createProject, createSakilaProject } from '../../factory/base';
import { listRow } from '../../factory/row';
import { getTable } from '../../factory/table';
import { getView, updateView } from '../../factory/view';
import init from '../../init';
import type { Column, Model, Base, View } from '../../../../src/models';
import 'mocha';

function groupByTests() {
  let context;
  let sakilaProject: Base;
  let filmTable: Model;
  let filmColumns: Array<Column>;
  let filmView: View;
  let gridViewColumns;

  before(async function () {
    console.time('GroupBy Tests');
    context = await init();

    sakilaProject = await createSakilaProject(context);
    await createProject(context);

    filmTable = await getTable({
      base: sakilaProject,
      name: 'film',
    });
    filmView = await getView(context, { table: filmTable, name: 'Film' });
    filmColumns = await filmTable.getColumns();

    const columns = (
      await request(context.app)
        .get(`/api/v1/db/meta/views/${filmView.id}/columns`)
        .set('xc-auth', context.token)
        .expect(200)
    ).body.list;

    gridViewColumns = columns;
  });

  it('Check One GroupBy Column Ascending', async function () {
    const lengthColumn = filmColumns.find((c) => c.column_name === 'length');
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: lengthColumn.column_name,
        sort: lengthColumn.title,
      })
      .expect(200);
    if (
      response.body.list[4]['length'] !== '50' &&
      parseInt(response.body.list[4]['count']) !== 9
    )
      throw new Error('Invalid Ascending One GroupBy Test');
  });

  it('Check Two GroupBy Column Ascending', async function () {
    const rentalDurationColumn = filmColumns.find(
      (c) => c.column_name === 'rental_duration',
    );
    const filterCondition = '(Length,eq,46)';
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: rentalDurationColumn.column_name,
        where: filterCondition,
        sort: rentalDurationColumn.title,
      })
      .expect(200);
    if (
      response.body.list[1]['length'] !== '5' &&
      parseInt(response.body.list[1]['count']) !== 2
    )
      throw new Error('Invalid Two GroupBy Ascending');
  });

  it('Check Three GroupBy Column Ascending', async function () {
    const titleColumn = filmColumns.find((c) => c.column_name === 'title');
    const filterCondition = '(Length,eq,46)~and(RentalDuration,eq,5)';
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: titleColumn.column_name,
        where: filterCondition,
        sort: titleColumn.title,
      })
      .expect(200);
    if (
      response.body.list[0]['length'] !== 'ALIEN CENTER' &&
      parseInt(response.body.list[0]['count']) !== 1
    )
      throw new Error('Invalid Three GroupBy Ascending');
  });

  it('Check One GroupBy Column With Descending', async function () {
    const lengthColumn = filmColumns.find((c) => c.column_name === 'length');
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: lengthColumn.column_name,
        sort: `-${lengthColumn.title}`,
      })
      .expect(200);
    if (
      response.body.list[0]['length'] !== '185' &&
      parseInt(response.body.list[0]['count']) !== 10
    )
      throw new Error('Invalid Ascending One GroupBy Test');
  });

  it('Check Two GroupBy Column Descending', async function () {
    const rentalDurationColumn = filmColumns.find(
      (c) => c.column_name === 'rental_duration',
    );
    const filterCondition = '(Length,eq,46)';
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: rentalDurationColumn.column_name,
        where: filterCondition,
        sort: `-${rentalDurationColumn.title}`,
      })
      .expect(200);
    if (
      response.body.list[2]['length'] !== '5' &&
      parseInt(response.body.list[2]['count']) !== 2
    )
      throw new Error('Invalid Two GroupBy Descending');
  });

  it('Check Three GroupBy Column Descending', async function () {
    const titleColumn = filmColumns.find((c) => c.column_name === 'title');
    const filterCondition = '(Length,eq,46)~and(RentalDuration,eq,5)';
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: titleColumn.column_name,
        where: filterCondition,
        sort: `-${titleColumn.title}`,
      })
      .expect(200);
    if (
      response.body.list[0]['length'] !== 'KWAI HOMEWARD' &&
      parseInt(response.body.list[0]['count']) !== 1
    )
      throw new Error('Invalid Three GroupBy Descending');
  });

  it('Set GroupBy and Verify Columns', async () => {
    const _lengthColumn = filmColumns.find((c) => c.column_name === 'length');
    const _rentalColumn = filmColumns.find(
      (c) => c.column_name === 'rental_duration',
    );

    const lengthColumn = gridViewColumns.find(
      (f) => f.fk_column_id === _lengthColumn.id,
    );

    const rentalColumn = gridViewColumns.find(
      (f) => f.fk_column_id === _rentalColumn.id,
    );

    // Group By Length Column Ascending Order
    await request(context.app)
      .patch(`/api/v1/db/meta/grid-columns/${lengthColumn.id}`)
      .set('xc-auth', context.token)
      .send({
        group_by: true,
        group_by_sort: 'asc',
        group_by_order: 1,
      })
      .expect(200);
    // Group By RentalDuration Column Descending
    await request(context.app)
      .patch(`/api/v1/db/meta/grid-columns/${rentalColumn.id}`)
      .set('xc-auth', context.token)
      .send({
        group_by: true,
        group_by_sort: 'desc',
        group_by_order: 2,
      })
      .expect(200);
    const columns = (
      await request(context.app)
        .get(`/api/v1/db/meta/views/${filmView.id}/columns`)
        .set('xc-auth', context.token)
        .expect(200)
    ).body.list;

    columns.forEach((c) => {
      if (
        c.fk_column_id === lengthColumn.id ||
        c.fk_column_id === rentalColumn.id
      ) {
        if (!c.group_by) throw new Error('Group By Not Set');
      }
    });
  });

  it('GroupBy Along with Filter', async () => {
    const _lengthColumn = filmColumns.find((c) => c.column_name === 'length');
    const lengthColumn = gridViewColumns.find(
      (f) => f.fk_column_id === _lengthColumn.id,
    );

    await updateView(context, {
      table: filmTable,
      view: filmView,
      filter: [
        {
          comparison_op: 'eq',
          value: 46,
          status: 'create',
          fk_column_id: lengthColumn.fk_column_id,
        },
      ],
    });
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: _lengthColumn.column_name,
      })
      .expect(200);

    if (
      response.body.list[0]['length'] !== '46' &&
      parseInt(response.body.list[0]['count']) !== 5
    )
      throw new Error('Invalid GroupBy With Filters');
  });

  it('Check One GroupBy Column with Links/Rollup', async function () {
    const actorsColumn = filmColumns.find((c) => c.title === 'Actors');
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: actorsColumn.title,
        sort: `-${actorsColumn.title}`,
      })
      .expect(200);
    expect(response.body.list[0]['Actors']).not.equal('0');
    expect(response.body.list[0]['count']).not.equal('10');
    expect(+response.body.list[0]['Actors']).to.be.gte(
      +response.body.list[1]['Actors'],
    );
  });

  it('Check One GroupBy Column with BT Lookup', async function () {
    // get the row list and extract the correct language column name which have the values
    // this is to avoid issue since there is 2 language column
    const rows = await listRow({
      table: filmTable,
      base: sakilaProject,
      options: {
        limit: 1,
        offset: 0,
      },
    });

    const language = await rows[0]['Language']();

    const ltarColumn = filmColumns.find(
      (c) => c.title === (language ? 'Language' : 'Language1'),
    );

    await createLookupColumn(context, {
      base: sakilaProject,
      title: 'LanguageName',
      table: filmTable,
      relatedTableName: 'language',
      relatedTableColumnTitle: 'Name',
      relationColumnId: ltarColumn.id,
    });

    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: 'LanguageName',
        sort: `-LanguageName`,
      })
      .expect(200);
    assert.match(response.body.list[0]['LanguageName'], /^English/);
    expect(+response.body.list[0]['count']).to.gt(0);
    expect(response.body.list.length).to.equal(1);
  });

  it('Check One GroupBy Column with MM Lookup which is not supported', async function () {
    await createLookupColumn(context, {
      base: sakilaProject,
      title: 'ActorNames',
      table: filmTable,
      relatedTableName: 'actor',
      relatedTableColumnTitle: 'FirstName',
    });

    const res = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: 'ActorNames',
      })
      .expect(400);

    assert.match(res.body.msg, /not supported/);
  });

  it('Check One GroupBy Column with Formula and Formula referring another formula', async function () {
    const formulaColumnTitle = 'Formula';
    await createColumn(context, filmTable, {
      uidt: UITypes.Formula,
      title: formulaColumnTitle,
      formula: `ADD({RentalDuration}, 10)`,
    });

    const res = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: formulaColumnTitle,
        sort: `-${formulaColumnTitle}`,
      })
      .expect(200);

    expect(res.body.list[0][formulaColumnTitle]).to.be.gte(
      res.body.list[0][formulaColumnTitle],
    );
    expect(+res.body.list[0].count).to.gte(1);

    // generate a formula column which refers to another formula column
    const nestedFormulaColumnTitle = 'FormulaNested';

    await createColumn(context, filmTable, {
      uidt: UITypes.Formula,
      title: nestedFormulaColumnTitle,
      formula: `ADD(1000,{${formulaColumnTitle}})`,
    });

    const res1 = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${filmTable.id}/groupby`)
      .set('xc-auth', context.token)
      .query({
        column_name: nestedFormulaColumnTitle,
        sort: `-${nestedFormulaColumnTitle}`,
      })
      .expect(200);

    expect(res1.body.list[0][nestedFormulaColumnTitle]).to.be.gte(
      res1.body.list[0][nestedFormulaColumnTitle],
    );
    expect(res1.body.list[0][nestedFormulaColumnTitle]).to.be.gte(1000);
    expect(+res1.body.list[0][nestedFormulaColumnTitle]).to.equal(
      1000 + +res.body.list[0][formulaColumnTitle],
    );
    expect(+res1.body.list[res1.body.list.length - 1].count).to.gte(0);
  });
}

export default function () {
  describe('GroupBy (Static)', groupByTests);
}
