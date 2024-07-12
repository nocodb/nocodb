import 'mocha';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import type Model from '../../../../src/models/Model';
import type Base from '~/models/Base';

// Test case list
// 1. Advanced link creation
function columnTests() {
  let context;
  let base: Base;

  const qrValueReferenceColumnTitle = 'Qr Value Column';
  const qrCodeReferenceColumnTitle = 'Qr Code Column';

  const defaultTableColumns = [
    {
      title: 'Id',
      uidt: UITypes.ID,
      system: false,
    },
    {
      title: 'DateField',
      uidt: UITypes.Date,
      system: false,
    },
    {
      title: 'CreatedAt',
      uidt: UITypes.CreatedTime,
      system: true,
    },
    {
      title: 'UpdatedAt',
      uidt: UITypes.LastModifiedTime,
      system: true,
    },
    {
      title: 'nc_created_by',
      uidt: UITypes.CreatedBy,
      system: true,
    },
    {
      title: 'nc_updated_by',
      uidt: UITypes.LastModifiedBy,
      system: true,
    },
  ];

  describe('Advance Column', () => {
    beforeEach(async function () {
      console.time('#### columnTypeSpecificTests');
      context = await init(true);

      // sakilaProject = await createSakilaProject(context);
      base = await createProject(context);

      console.timeEnd('#### columnTypeSpecificTests');
    });

    it('Create HM relation', async () => {
      const country = await createTable(context, base.id, {
        title: 'Country',
        columns: defaultTableColumns,
      });
      const city = await createTable(context, base.id, {
        title: 'City',
        columns: [
          ...defaultTableColumns,
          {
            title: 'CountryId',
            uidt: UITypes.Number,
          },
        ],
      });

      const pkColumn = (await country.getColumns()).find((column) => column.pk);
      const fkColumn = (await city.getColumns()).find(
        (column) => column.title === 'CountryId',
      );

      const response = await request(context.app)
        .post(`/api/v1/db/meta/projects/${base.id}/columns`)
        .set('xc-auth', context.token)
        .send({
          title: 'Country',
          uidt: UITypes.Links,
          custom: {
            base_id: base.id,
            column_id: pkColumn?.id,
            ref_model_id: city.id,
            ref_column_id: fkColumn?.id,
          },
        });

      console.log(response.body);
    });
    it('Create MM relation', async () => {
      const film = await createTable(context, base.id, {
        title: 'Film',
        columns: defaultTableColumns,
      });
      const actor = await createTable(context, base.id, {
        title: 'Actor',
        columns: [
          ...defaultTableColumns,
          {
            title: 'Table1Id',
            uidt: UITypes.Number,
          },
        ],
      });

      const filmActor = await createTable(context, base.id, {
        title: 'FilmActor',
        columns: [
          {
            title: 'ActorId',
            uidt: UITypes.Number,
          },
          {
            title: 'FilmId',
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
        .post(`/api/v1/db/meta/projects/${base.id}/columns`)
        .set('xc-auth', context.token)
        .send({
          title: 'Actor',
          uidt: UITypes.Links,
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

      console.log(response.body);
    });
  });
}

export default function () {
  describe('Column', columnTests);
}
