import 'mocha';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { createBulkRows, createChildRow, listRow } from '../../factory/row';
import type Base from '~/models/Base';

// Test case list
// 1. Advanced link creation
function columnTests() {
  let context;
  let base: Base;

  const defaultTableColumns = [
    {
      title: 'Id',
      column_name: 'Id',
      uidt: UITypes.ID,
      system: false,
    },
  ];

  describe('Advance Column', () => {
    beforeEach(async function () {
      console.time('#### columnTypeSpecificTests');
      context = await init(true);

      base = await createProject(context);

      console.timeEnd('#### columnTypeSpecificTests');
    });

    it('Create HM relation', async () => {
      let country = await createTable(context, base, {
        title: 'Country',
        table_name: 'Country',
        columns: defaultTableColumns,
      });
      const city = await createTable(context, base, {
        title: 'City',
        table_name: 'City',
        columns: [
          ...defaultTableColumns,
          {
            title: 'CountryId',
            column_name: 'CountryId',
            uidt: UITypes.Number,
          },
        ],
      });

      const pkColumn = (await country.getColumns()).find((column) => column.pk);
      const fkColumn = (await city.getColumns()).find(
        (column) => column.title === 'CountryId',
      );

      const response = await request(context.app)
        .post(`/api/v1/db/meta/tables/${country.id}/columns`)
        .set('xc-auth', context.token)
        .send({
          title: 'Cities',
          uidt: UITypes.Links,
          column_name: 'Cities',
          type: 'hm',
          childId: city.id,
          parentId: country.id,
          is_custom_link: true,
          custom: {
            base_id: base.id,
            column_id: pkColumn?.id,
            ref_model_id: city.id,
            ref_column_id: fkColumn?.id,
          },
        });

      country = response.body;
      const hmColumn = country.columns.find(
        (column) => column.title === 'Cities',
      );

      // add rows to tables
      await createBulkRows(context, {
        base,
        table: country,
        values: [
          {
            Title: 'Country1',
          },
          {
            Title: 'Country2',
          },
          {
            Title: 'Country3',
          },
        ],
      });

      // add rows to tables
      await createBulkRows(context, {
        base,
        table: city,
        values: [
          {
            Title: 'City1',
            CountryId: 1,
          },
          {
            Title: 'City2',
            CountryId: 1,
          },
          {
            Title: 'City3',
            CountryId: 2,
          },
          {
            Title: 'City3',
          },
        ],
      });

      // link rows
      await createChildRow(context, {
        base,
        table: country,
        childTable: city,
        column: hmColumn,
        rowId: '3',
        childRowId: '4',
        type: 'hm',
      });

      const rows = await listRow({
        base,
        table: country,
      });

      const rows1 = await listRow({
        base,
        table: city,
      });

      expect(rows[0].Cities).to.be.eq(2);
      expect(rows[1].Cities).to.be.eq(1);
      expect(rows[2].Cities).to.be.eq(1);
    });
    it('Create MM relation', async () => {
      const film = await createTable(context, base, {
        title: 'Film',
        table_name: 'Film',
        columns: defaultTableColumns,
      });
      let actor = await createTable(context, base, {
        title: 'Actor',
        table_name: 'Actor',
        columns: defaultTableColumns,
      });

      const filmActor = await createTable(context, base, {
        title: 'FilmActor',
        table_name: 'FilmActor',
        columns: [
          {
            title: 'ActorId',
            column_name: 'ActorId',
            uidt: UITypes.Number,
          },
          {
            title: 'FilmId',
            column_name: 'FilmId',
            uidt: UITypes.Number,
          },
        ],
      });

      const pkColumn = (await actor.getColumns()).find((column) => column.pk);
      const refPkColumn = (await film.getColumns()).find((column) => column.pk);
      const junColId = (await filmActor.getColumns()).find(
        (column) => column.title === 'ActorId',
      );
      const juRefColId = (await filmActor.getColumns()).find(
        (column) => column.title === 'FilmId',
      );

      const response = await request(context.app)
        .post(`/api/v1/db/meta/tables/${actor.id}/columns`)
        .set('xc-auth', context.token)
        .send({
          title: 'Films',
          uidt: UITypes.Links,
          childId: film.id,
          parentId: actor.id,
          column_name: 'Films',
          type: 'mm',
          is_custom_link: true,
          custom: {
            base_id: base.id,
            junc_base_id: base.id,
            column_id: pkColumn?.id,
            junc_model_id: filmActor.id,
            junc_column_id: junColId?.id,
            junc_ref_column_id: juRefColId?.id,
            ref_model_id: film.id,
            ref_column_id: refPkColumn?.id,
          },
        });

      actor = response.body;
      const mmColumn = actor.columns.find((column) => column.title === 'Films');

      // add rows to tables
      await createBulkRows(context, {
        base,
        table: actor,
        values: [
          {
            Title: 'Actor1',
          },
          {
            Title: 'Actor2',
          },
          {
            Title: 'Actor3',
          },
        ],
      });

      // add rows to tables
      await createBulkRows(context, {
        base,
        table: film,
        values: [
          {
            Title: 'Film1',
          },
          {
            Title: 'Film2',
          },
          {
            Title: 'Film3',
          },
        ],
      });

      // link rows
      await createChildRow(context, {
        base,
        table: actor,
        childTable: film,
        column: mmColumn,
        rowId: '1',
        childRowId: '1',
        type: 'mm',
      });
      await createChildRow(context, {
        base,
        table: actor,
        childTable: film,
        column: mmColumn,
        rowId: '1',
        childRowId: '2',
        type: 'mm',
      });

      const rows = await listRow({
        base,
        table: actor,
      });

      expect(rows[0].Films).to.be.eq(2);
    });
  });
}

export default function () {
  describe('Column', columnTests);
}
