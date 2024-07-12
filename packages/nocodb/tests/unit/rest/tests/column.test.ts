import 'mocha';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject, createSakilaProject } from '../../factory/base';
import {
  createColumn,
  createQrCodeColumn,
  deleteColumn,
} from '../../factory/column';
import { createTable, getColumnsByAPI, getTable } from '../../factory/table';
import { createBulkRows, listRow, rowMixedValue } from '../../factory/row';
import type Model from '../../../../src/models/Model';
import type Base from '~/models/Base';
import type Column from '../../../../src/models/Column';

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

    it.only('Create HM relation', async () => {
      let table1: Model;
      let table2: Model;

      table1 = await createTable(context, base.id, {
        title: 'Country',
        columns: defaultTableColumns,
      });
      table2 = await createTable(context, base.id, {
        title: 'City',
        columns: [
          ...defaultTableColumns,
          {
            title: 'Table1Id',
            uidt: UITypes.Number,
          },
        ],
      });

      const response = await request(context.app)
        .post(`/api/v1/db/meta/projects/${base.id}/columns`)
        .set('xc-auth', context.token)
        .send({
          title: 'Country',
          uidt: UITypes.Links,
          custom: {
            base_id: meta.value?.base_id,
            column_id: pkColumn.value?.id,
            junc_base_id: meta.value?.base_id,
          },
        });
    });
    it.only('Create MM relation', async () => {
      let table1: Model;
      let table2: Model;

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
      const response = await request(context.app)
        .post(`/api/v1/db/meta/projects/${base.id}/columns`)
        .set('xc-auth', context.token)
        .send({
          title: 'Actor',
          uidt: UITypes.Links,
          custom: {
            base_id: meta.value?.base_id,
            column_id: pkColumn.value?.id,
            junc_base_id: meta.value?.base_id,
          },
        });
    });
  });
}

export default function () {
  describe('Column', columnTests);
}
