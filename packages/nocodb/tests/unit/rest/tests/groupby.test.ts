import request from 'supertest';
import { createProject, createSakilaProject } from '../../factory/project';
import { getTable } from '../../factory/table';
import { getView, updateView } from '../../factory/view';
import init from '../../init';
import type { Column, Model, Project, View } from '../../../../src/models';

function groupByTests() {
  let context;
  let sakilaProject: Project;
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
      project: sakilaProject,
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
}

export default function () {
  describe('GroupBy (Static)', groupByTests);
}
