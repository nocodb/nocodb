import { expect } from 'chai';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';
import { customColumns } from '../../../factory/column';
import { createBulkRows } from '../../../factory/row';
import { createTable } from '../../../factory/table';
import type { ITestContext } from '../../../init';
import type { ColumnType } from 'nocodb-sdk';
import type { Model } from '../../../../../src/models';

/**
 * Tests for the per-LTAR `fk_display_value_column_id` override.
 *
 * Feature contract:
 * - When a custom display value column is set on an LTAR column, that column's
 *   value is surfaced in the nested LTAR payload alongside the PV.
 * - The override must reference a real, supported column in the related table.
 * - When the override column is deleted, the LTAR's
 *   fk_display_value_column_id is nulled out.
 */
describe('dataApiV3', () => {
  describe('ltar-custom-display-value', () => {
    let testContext: ITestContext;
    let tblAuthors: Model;
    let tblBooks: Model;
    let columnsAuthors: ColumnType[];
    let columnsBooks: ColumnType[];

    const getToken = () => testContext.context.token;
    const getApp = () => testContext.context.app;

    const createLtarWithDisplay = async (
      parentTable: Model,
      childTable: Model,
      title: string,
      type: 'hm' | 'bt' | 'mm',
      fk_display_value_column_id?: string | null,
      expectStatus = 200,
    ) => {
      const res = await request(getApp())
        .post(`/api/v1/db/meta/tables/${parentTable.id}/columns`)
        .set('xc-auth', getToken())
        .send({
          title,
          column_name: title,
          uidt: UITypes.LinkToAnotherRecord,
          parentId: parentTable.id,
          childId: childTable.id,
          type,
          ...(fk_display_value_column_id !== undefined
            ? { fk_display_value_column_id }
            : {}),
        });
      expect(res.status).to.equal(expectStatus);
      if (expectStatus !== 200) return res;

      const ctx = {
        workspace_id: parentTable.fk_workspace_id,
        base_id: parentTable.base_id,
      };
      return (await parentTable.getColumns(ctx)).find(
        (c) => c.title === title,
      );
    };

    const patchColumn = async (
      columnId: string,
      body: Record<string, any>,
      expectStatus = 200,
    ) => {
      const res = await request(getApp())
        .patch(`/api/v2/meta/columns/${columnId}`)
        .set('xc-auth', getToken())
        .send(body);
      expect(res.status).to.equal(expectStatus);
      return res;
    };

    const getColumn = async (columnId: string) => {
      const res = await request(getApp())
        .get(`/api/v2/meta/columns/${columnId}`)
        .set('xc-auth', getToken());
      expect(res.status).to.equal(200);
      return res.body;
    };

    const listRows = async (tableId: string) => {
      const res = await request(getApp())
        .get(`/api/v1/db/data/noco/${testContext.base.id}/${tableId}`)
        .set('xc-auth', getToken())
        .query({ limit: 100 });
      expect(res.status).to.equal(200);
      return res.body.list as any[];
    };

    const linkV3 = async (
      tableId: string,
      linkColumnId: string,
      rowId: string,
      linkId: string,
    ) => {
      const res = await request(getApp())
        .post(
          `/api/v3/data/${testContext.base.id}/${tableId}/links/${linkColumnId}/${rowId}`,
        )
        .set('xc-auth', getToken())
        .send({ id: linkId });
      expect(res.status).to.be.oneOf([200, 201]);
    };

    const findCol = (cols: ColumnType[], title: string) =>
      cols.find((c) => c.title === title) as ColumnType;

    beforeEach(async () => {
      testContext = (await dataApiV3BeforeEach()) as unknown as ITestContext;

      tblAuthors = await createTable(testContext.context, testContext.base, {
        title: 'Authors',
        table_name: 'Authors',
        columns: customColumns('custom', [
          {
            title: 'Title',
            column_name: 'Title',
            uidt: UITypes.SingleLineText,
            pv: true,
          },
          {
            title: 'Description',
            column_name: 'Description',
            uidt: UITypes.SingleLineText,
          },
        ]),
      });
      tblBooks = await createTable(testContext.context, testContext.base, {
        title: 'Books',
        table_name: 'Books',
        columns: customColumns('custom', [
          {
            title: 'Title',
            column_name: 'Title',
            uidt: UITypes.SingleLineText,
            pv: true,
          },
          {
            title: 'Notes',
            column_name: 'Notes',
            uidt: UITypes.SingleLineText,
          },
        ]),
      });

      await createBulkRows(testContext.context, {
        base: testContext.base,
        table: tblAuthors,
        values: [
          { Title: 'AuthorA', Description: 'Alpha' },
          { Title: 'AuthorB', Description: 'Beta' },
          { Title: 'AuthorC', Description: 'Charlie' },
        ],
      });
      await createBulkRows(testContext.context, {
        base: testContext.base,
        table: tblBooks,
        values: [
          { Title: 'Book1', Notes: 'N1' },
          { Title: 'Book2', Notes: 'N2' },
        ],
      });

      const ctx = {
        workspace_id: testContext.base.fk_workspace_id,
        base_id: testContext.base.id,
      };
      columnsAuthors = await tblAuthors.getColumns(ctx);
      columnsBooks = await tblBooks.getColumns(ctx);
    });

    it('persists fk_display_value_column_id on BT column', async () => {
      const desc = findCol(columnsAuthors, 'Description');
      const col = await createLtarWithDisplay(
        tblBooks,
        tblAuthors,
        'AuthorBT',
        'bt',
        desc.id,
      );
      expect((col as any)?.colOptions?.fk_display_value_column_id).to.equal(
        desc.id,
      );
    });

    it('persists fk_display_value_column_id on HM column', async () => {
      const notes = findCol(columnsBooks, 'Notes');
      const col = await createLtarWithDisplay(
        tblAuthors,
        tblBooks,
        'BooksHM',
        'hm',
        notes.id,
      );
      expect((col as any)?.colOptions?.fk_display_value_column_id).to.equal(
        notes.id,
      );
    });

    it('persists fk_display_value_column_id on MM column', async () => {
      const desc = findCol(columnsAuthors, 'Description');
      const col = await createLtarWithDisplay(
        tblBooks,
        tblAuthors,
        'AuthorsMM',
        'mm',
        desc.id,
      );
      expect((col as any)?.colOptions?.fk_display_value_column_id).to.equal(
        desc.id,
      );
    });

    it('rejects a non-existent display value column id', async () => {
      const res: any = await createLtarWithDisplay(
        tblBooks,
        tblAuthors,
        'BadBT',
        'bt',
        'does_not_exist_12345',
        400,
      );
      expect(res.body.message || res.body.msg).to.match(/not found/i);
    });

    it('clears override when set to null via PATCH', async () => {
      const desc = findCol(columnsAuthors, 'Description');
      const col = await createLtarWithDisplay(
        tblBooks,
        tblAuthors,
        'AuthorBTClear',
        'bt',
        desc.id,
      );

      await patchColumn((col as any).id, {
        fk_display_value_column_id: null,
      });
      const fetched = await getColumn((col as any).id);
      expect(fetched.colOptions.fk_display_value_column_id).to.be.null;
    });

    it('includes override column in list response nested LTAR payload', async () => {
      const desc = findCol(columnsAuthors, 'Description');
      const btCol = await createLtarWithDisplay(
        tblBooks,
        tblAuthors,
        'AuthorBTList',
        'bt',
        desc.id,
      );

      const authors = await listRows(tblAuthors.id);
      const books = await listRows(tblBooks.id);
      const authorA = authors.find((r) => r.Title === 'AuthorA');
      const book1 = books.find((r) => r.Title === 'Book1');
      const authorAId = String(authorA.Id ?? authorA.id);
      const book1Id = String(book1.Id ?? book1.id);

      await linkV3(tblBooks.id, (btCol as any).id, book1Id, authorAId);

      const booksAfter = await listRows(tblBooks.id);
      const book1After = booksAfter.find((r) => r.Title === 'Book1');
      const nested = book1After.AuthorBTList;
      const linked = Array.isArray(nested) ? nested[0] : nested;
      expect(linked, 'linked payload must exist').to.exist;
      expect(linked.Title).to.equal('AuthorA');
      expect(linked.Description).to.equal('Alpha');
    });

    it('nulls fk_display_value_column_id when the target column is deleted', async () => {
      const desc = findCol(columnsAuthors, 'Description');
      const btCol = await createLtarWithDisplay(
        tblBooks,
        tblAuthors,
        'AuthorBTDel',
        'bt',
        desc.id,
      );

      const delRes = await request(getApp())
        .delete(`/api/v2/meta/columns/${desc.id}`)
        .set('xc-auth', getToken());
      expect(delRes.status).to.equal(200);

      const fetched = await getColumn((btCol as any).id);
      expect(fetched.colOptions.fk_display_value_column_id).to.be.null;
    });
  });
});
