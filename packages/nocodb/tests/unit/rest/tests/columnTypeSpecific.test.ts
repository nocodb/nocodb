import 'mocha';
import { title } from 'process';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import init from '../../init';
import { createProject, createSakilaProject } from '../../factory/base';
import { createColumn, createQrCodeColumn } from '../../factory/column';
import { getTable } from '../../factory/table';
import type Model from '../../../../src/models/Model';
import type Base from '~/models/Base';
import type Column from '../../../../src/models/Column';

// Test case list
// 1. Qr Code Column
// a. adding a QR code column which references another column
//   - delivers the same cell values as the referenced column
//   - gets deleted if the referenced column gets deleted

function columnTypeSpecificTests() {
  let context;
  let base: Base;
  let sakilaProject: Base;
  let customerTable: Model;
  let qrValueReferenceColumn: Column;

  const qrValueReferenceColumnTitle = 'Qr Value Column';
  const qrCodeReferenceColumnTitle = 'Qr Code Column';

  beforeEach(async function () {
    console.time('#### columnTypeSpecificTests');
    context = await init(true);

    sakilaProject = await createSakilaProject(context);
    base = await createProject(context);

    customerTable = await getTable({
      base: sakilaProject,
      name: 'customer',
    });

    qrValueReferenceColumn = await createColumn(context, customerTable, {
      title: qrValueReferenceColumnTitle,
      uidt: UITypes.SingleLineText,
      table_name: customerTable.table_name,
      column_name: qrValueReferenceColumnTitle,
    });

    await createQrCodeColumn(context, {
      title: qrCodeReferenceColumnTitle,
      table: customerTable,
      referencedQrValueTableColumnTitle: qrValueReferenceColumnTitle,
    });
    console.timeEnd('#### columnTypeSpecificTests');
  });

  describe('Qr Code Column', () => {
    it('delivers the same cell values as the referenced column', async () => {
      const resp = await request(context.app)
        .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
        .set('xc-auth', context.token)
        .expect(200);
      expect(resp.body.list[0][qrValueReferenceColumnTitle]).to.eql(
        resp.body.list[0][qrCodeReferenceColumnTitle],
      );
      expect(
        resp.body.list.map((row) => row[qrValueReferenceColumnTitle]),
      ).to.eql(resp.body.list.map((row) => row[qrCodeReferenceColumnTitle]));
    });

    it('gets deleted if the referenced column gets deleted', async () => {
      // delete referenced value column
      const columnsBeforeReferencedColumnDeleted =
        await customerTable.getColumns();

      expect(
        columnsBeforeReferencedColumnDeleted.some(
          (col) => col['title'] === qrCodeReferenceColumnTitle,
        ),
      ).to.eq(true);

      const response = await request(context.app)
        .delete(`/api/v1/db/meta/columns/${qrValueReferenceColumn.id}`)
        .set('xc-auth', context.token)
        .send({});

      const columnsAfterReferencedColumnDeleted =
        await customerTable.getColumns();
      expect(
        columnsAfterReferencedColumnDeleted.some(
          (col) => col['title'] === qrCodeReferenceColumnTitle,
        ),
      ).to.eq(false);
    });
  });
}

export default function () {
  describe('Column types specific behavior', columnTypeSpecificTests);
}
