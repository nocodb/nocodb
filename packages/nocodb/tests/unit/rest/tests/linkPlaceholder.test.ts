import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { createLtarColumn, createLtarColumn2 } from '../../factory/column';
import { createRow } from '../../factory/row';
import Column from '~/models/Column';

type Context = Awaited<ReturnType<typeof init>>;

const PLACEHOLDER_PREFIXES = ['_nc_trash_ph_', '_nc_ph_'];

function hasPlaceholderPrefix(columnName?: string | null) {
  if (!columnName) return false;
  return PLACEHOLDER_PREFIXES.some((p) => columnName.startsWith(p));
}

function isLtarCol(c: any) {
  return (
    c.uidt === UITypes.LinkToAnotherRecord || c.uidt === UITypes.Links
  );
}

function linkPlaceholderTests() {
  describe('Link placeholder on hard-delete (CE path)', () => {
    let context: Context;
    let base: any;
    let ctx: { workspace_id: string; base_id: string };

    beforeEach(async () => {
      context = await init();
      base = await createProject(context);
      ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
    });

    async function deleteTable(tableId: string) {
      const res = await request(context.app)
        .delete(`/api/v1/db/meta/tables/${tableId}`)
        .set('xc-auth', context.token);
      expect(res.status).to.be.lt(400);
      return res;
    }

    async function deleteColumn(columnId: string) {
      const res = await request(context.app)
        .delete(`/api/v2/meta/columns/${columnId}`)
        .set('xc-auth', context.token);
      expect(res.status).to.be.lt(400);
      return res;
    }

    async function getRows(tableId: string) {
      const res = await request(context.app)
        .get(`/api/v1/db/data/noco/${base.id}/${tableId}`)
        .set('xc-auth', context.token)
        .expect(200);
      return res.body.list as any[];
    }

    async function linkRecords(
      srcTableId: string,
      linkColId: string,
      srcRowId: any,
      targetIds: any[],
    ) {
      await request(context.app)
        .post(
          `/api/v2/tables/${srcTableId}/links/${linkColId}/records/${srcRowId}`,
        )
        .set('xc-auth', context.token)
        .send(targetIds.map((id) => ({ Id: id })))
        .expect(201);
    }

    async function findPlaceholder(tableId: string) {
      const cols = await Column.list(ctx, { fk_model_id: tableId });
      return cols.find((c) => hasPlaceholderPrefix(c.column_name));
    }

    async function assertPlaceholderPopulated(
      tableId: string,
      placeholderTitle: string,
      expectedMatches: string[],
    ) {
      const rows = await getRows(tableId);
      const values = rows
        .map((r) => r[placeholderTitle])
        .filter((v) => v != null && v !== '');
      expect(
        values.length,
        `placeholder ${placeholderTitle} should be populated on at least one row`,
      ).to.be.gte(1);
      for (const expected of expectedMatches) {
        expect(
          values.some((v: string) => v.includes(expected)),
          `placeholder should include "${expected}" (got: ${JSON.stringify(values)})`,
        ).to.eq(true);
      }
    }

    // ── Table delete ──────────────────────────────────────────

    describe('Table delete', () => {
      it('HM parent table deleted → placeholder on child populated with parent PV', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'PhHmParent',
          title: 'PhHmParent',
        });
        const childTable = await createTable(context, base, {
          table_name: 'PhHmChild',
          title: 'PhHmChild',
        });

        const ltarCol = await createLtarColumn(context, {
          title: 'PhHmLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        await createRow(context, { base, table: childTable, index: 0 });
        await createRow(context, { base, table: childTable, index: 1 });
        await createRow(context, { base, table: parentTable, index: 0 });

        const [parentRow] = await getRows(parentTable.id);
        const childRows = await getRows(childTable.id);

        await linkRecords(
          parentTable.id,
          ltarCol.id,
          parentRow.Id,
          childRows.map((r) => r.Id),
        );

        await deleteTable(parentTable.id);

        const placeholder = await findPlaceholder(childTable.id);
        expect(placeholder, 'placeholder should exist on child table').to.not.be
          .undefined;
        expect(placeholder!.uidt).to.eq(UITypes.SingleLineText);

        // Parent row title is "PhHmParent" (first row gets the default seed value)
        await assertPlaceholderPopulated(childTable.id, placeholder!.title, [
          parentRow.Title,
        ]);
      });
    });

    // ── V1 Links — column delete ──────────────────────────────

    describe('V1 Links — column delete', () => {
      it('HM: placeholder on child populated with parent PV', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'V1HmP',
          title: 'V1HmP',
        });
        const childTable = await createTable(context, base, {
          table_name: 'V1HmC',
          title: 'V1HmC',
        });

        const hmCol = await createLtarColumn(context, {
          title: 'V1HmLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        await createRow(context, { base, table: childTable, index: 0 });
        await createRow(context, { base, table: childTable, index: 1 });
        await createRow(context, { base, table: parentTable, index: 0 });

        const [parentRow] = await getRows(parentTable.id);
        const childRows = await getRows(childTable.id);
        await linkRecords(
          parentTable.id,
          hmCol.id,
          parentRow.Id,
          childRows.map((r) => r.Id),
        );

        await deleteColumn(hmCol.id);

        const childCols = await Column.list(ctx, {
          fk_model_id: childTable.id,
        });
        expect(
          childCols.find((c) => isLtarCol(c) && !c.system),
          'reverse BT should be cascade-deleted',
        ).to.be.undefined;

        const placeholder = childCols.find((c) =>
          hasPlaceholderPrefix(c.column_name),
        );
        expect(placeholder, 'placeholder should exist on child').to.not.be
          .undefined;

        await assertPlaceholderPopulated(childTable.id, placeholder!.title, [
          parentRow.Title,
        ]);
      });

      it('BT: placeholder on parent populated with aggregated child PVs', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'V1BtP',
          title: 'V1BtP',
        });
        const childTable = await createTable(context, base, {
          table_name: 'V1BtC',
          title: 'V1BtC',
        });

        const hmCol = await createLtarColumn(context, {
          title: 'V1BtLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        const childColsBefore = await Column.list(ctx, {
          fk_model_id: childTable.id,
        });
        const btCol = childColsBefore.find(
          (c) => isLtarCol(c) && !c.system,
        );
        expect(btCol, 'auto BT column should exist on child').to.not.be
          .undefined;

        await createRow(context, { base, table: childTable, index: 0 });
        await createRow(context, { base, table: childTable, index: 1 });
        await createRow(context, { base, table: parentTable, index: 0 });

        const [parentRow] = await getRows(parentTable.id);
        const childRows = await getRows(childTable.id);
        await linkRecords(
          parentTable.id,
          hmCol.id,
          parentRow.Id,
          childRows.map((r) => r.Id),
        );

        await deleteColumn(btCol!.id);

        const parentCols = await Column.list(ctx, {
          fk_model_id: parentTable.id,
        });
        expect(
          parentCols.find((c) => isLtarCol(c) && !c.system),
          'reverse HM should be cascade-deleted',
        ).to.be.undefined;

        const placeholder = parentCols.find((c) =>
          hasPlaceholderPrefix(c.column_name),
        );
        expect(placeholder, 'placeholder should exist on parent').to.not.be
          .undefined;

        await assertPlaceholderPopulated(
          parentTable.id,
          placeholder!.title,
          childRows.map((r) => r.Title),
        );
      });

      it('OO: placeholder on other side populated with linked PV', async () => {
        const tableA = await createTable(context, base, {
          table_name: 'V1OoA',
          title: 'V1OoA',
        });
        const tableB = await createTable(context, base, {
          table_name: 'V1OoB',
          title: 'V1OoB',
        });

        const ooCol = await createLtarColumn(context, {
          title: 'V1OoLink',
          parentTable: tableA,
          childTable: tableB,
          type: 'oo',
        });

        await createRow(context, { base, table: tableA, index: 0 });
        await createRow(context, { base, table: tableB, index: 0 });

        const [rowA] = await getRows(tableA.id);
        const [rowB] = await getRows(tableB.id);
        await linkRecords(tableA.id, ooCol.id, rowA.Id, [rowB.Id]);

        await deleteColumn(ooCol.id);

        const bCols = await Column.list(ctx, { fk_model_id: tableB.id });
        expect(
          bCols.find((c) => isLtarCol(c) && !c.system),
          'reverse OO should be cascade-deleted',
        ).to.be.undefined;

        const placeholder = bCols.find((c) =>
          hasPlaceholderPrefix(c.column_name),
        );
        expect(placeholder, 'placeholder should exist on tableB').to.not.be
          .undefined;

        await assertPlaceholderPopulated(tableB.id, placeholder!.title, [
          rowA.Title,
        ]);
      });

      it('self-HM: placeholder in same table populated with parent PV on linked child row', async () => {
        const selfTable = await createTable(context, base, {
          table_name: 'V1SelfHm',
          title: 'V1SelfHm',
        });

        const selfLink = await createLtarColumn(context, {
          title: 'V1SelfLink',
          parentTable: selfTable,
          childTable: selfTable,
          type: 'hm',
        });

        const colsBefore = await Column.list(ctx, {
          fk_model_id: selfTable.id,
        });
        const reverseBt = colsBefore.find(
          (c) => isLtarCol(c) && c.id !== selfLink.id,
        );
        expect(reverseBt, 'reverse BT should exist before delete').to.not.be
          .undefined;
        const reverseTitle = reverseBt!.title;

        await createRow(context, { base, table: selfTable, index: 0 });
        await createRow(context, { base, table: selfTable, index: 1 });

        const [parentRow, childRow] = await getRows(selfTable.id);
        await linkRecords(selfTable.id, selfLink.id, parentRow.Id, [
          childRow.Id,
        ]);

        await deleteColumn(selfLink.id);

        const colsAfter = await Column.list(ctx, {
          fk_model_id: selfTable.id,
        });
        expect(
          colsAfter.find((c) => c.id === selfLink.id),
          'HM link should be gone',
        ).to.be.undefined;
        expect(
          colsAfter.find((c) => c.id === reverseBt!.id),
          'reverse BT should also be gone',
        ).to.be.undefined;

        const placeholder = colsAfter.find((c) =>
          hasPlaceholderPrefix(c.column_name),
        );
        expect(placeholder, 'placeholder should exist in same table').to.not.be
          .undefined;
        expect(placeholder!.title).to.eq(reverseTitle);

        await assertPlaceholderPopulated(selfTable.id, placeholder!.title, [
          parentRow.Title,
        ]);
      });
    });

    // ── V2 LTAR — column delete ───────────────────────────────

    describe('V2 LTAR — column delete', () => {
      it('MM: placeholder on other side populated with aggregated PVs', async () => {
        const tableA = await createTable(context, base, {
          table_name: 'V2MmA',
          title: 'V2MmA',
        });
        const tableB = await createTable(context, base, {
          table_name: 'V2MmB',
          title: 'V2MmB',
        });

        const mmCol = await createLtarColumn2(context, {
          title: 'V2MmLink',
          parentTable: tableA,
          childTable: tableB,
          type: 'mm',
        });

        await createRow(context, { base, table: tableA, index: 0 });
        await createRow(context, { base, table: tableB, index: 0 });
        await createRow(context, { base, table: tableB, index: 1 });

        const [rowA] = await getRows(tableA.id);
        const bRows = await getRows(tableB.id);
        await linkRecords(
          tableA.id,
          mmCol.id,
          rowA.Id,
          bRows.map((r) => r.Id),
        );

        await deleteColumn(mmCol.id);

        const bCols = await Column.list(ctx, { fk_model_id: tableB.id });
        expect(
          bCols.find((c) => isLtarCol(c) && !c.system),
          'reverse MM should be cascade-deleted',
        ).to.be.undefined;

        const placeholder = bCols.find((c) =>
          hasPlaceholderPrefix(c.column_name),
        );
        expect(placeholder, 'placeholder should exist on tableB').to.not.be
          .undefined;

        await assertPlaceholderPopulated(tableB.id, placeholder!.title, [
          rowA.Title,
        ]);
      });

      it('OO (junction-based): placeholder on other side populated with linked PV', async () => {
        const tableA = await createTable(context, base, {
          table_name: 'V2OoA',
          title: 'V2OoA',
        });
        const tableB = await createTable(context, base, {
          table_name: 'V2OoB',
          title: 'V2OoB',
        });

        const ooCol = await createLtarColumn2(context, {
          title: 'V2OoLink',
          parentTable: tableA,
          childTable: tableB,
          type: 'oo',
        });

        await createRow(context, { base, table: tableA, index: 0 });
        await createRow(context, { base, table: tableB, index: 0 });

        const [rowA] = await getRows(tableA.id);
        const [rowB] = await getRows(tableB.id);
        await linkRecords(tableA.id, ooCol.id, rowA.Id, [rowB.Id]);

        await deleteColumn(ooCol.id);

        const bCols = await Column.list(ctx, { fk_model_id: tableB.id });
        expect(
          bCols.find((c) => isLtarCol(c) && !c.system),
          'reverse OO should be cascade-deleted',
        ).to.be.undefined;

        const placeholder = bCols.find((c) =>
          hasPlaceholderPrefix(c.column_name),
        );
        expect(placeholder, 'placeholder should exist on tableB').to.not.be
          .undefined;

        await assertPlaceholderPopulated(tableB.id, placeholder!.title, [
          rowA.Title,
        ]);
      });

      it('OM: placeholder on MO side populated with parent PV', async () => {
        const tableA = await createTable(context, base, {
          table_name: 'V2OmA',
          title: 'V2OmA',
        });
        const tableB = await createTable(context, base, {
          table_name: 'V2OmB',
          title: 'V2OmB',
        });

        const omCol = await createLtarColumn2(context, {
          title: 'V2OmLink',
          parentTable: tableA,
          childTable: tableB,
          type: 'om',
        });

        await createRow(context, { base, table: tableA, index: 0 });
        await createRow(context, { base, table: tableB, index: 0 });
        await createRow(context, { base, table: tableB, index: 1 });

        const [rowA] = await getRows(tableA.id);
        const bRows = await getRows(tableB.id);
        await linkRecords(
          tableA.id,
          omCol.id,
          rowA.Id,
          bRows.map((r) => r.Id),
        );

        await deleteColumn(omCol.id);

        const bCols = await Column.list(ctx, { fk_model_id: tableB.id });
        expect(
          bCols.find((c) => isLtarCol(c) && !c.system),
          'reverse MO should be cascade-deleted',
        ).to.be.undefined;

        const placeholder = bCols.find((c) =>
          hasPlaceholderPrefix(c.column_name),
        );
        expect(placeholder, 'placeholder should exist on tableB').to.not.be
          .undefined;

        await assertPlaceholderPopulated(tableB.id, placeholder!.title, [
          rowA.Title,
        ]);
      });

      it('MO: placeholder on OM side populated with aggregated child PVs', async () => {
        const tableA = await createTable(context, base, {
          table_name: 'V2MoA',
          title: 'V2MoA',
        });
        const tableB = await createTable(context, base, {
          table_name: 'V2MoB',
          title: 'V2MoB',
        });

        const omCol = await createLtarColumn2(context, {
          title: 'V2MoLink',
          parentTable: tableA,
          childTable: tableB,
          type: 'om',
        });

        const bColsBefore = await Column.list(ctx, { fk_model_id: tableB.id });
        const moCol = bColsBefore.find(
          (c) => isLtarCol(c) && !c.system,
        );
        expect(moCol, 'auto MO column should exist on tableB').to.not.be
          .undefined;

        await createRow(context, { base, table: tableA, index: 0 });
        await createRow(context, { base, table: tableB, index: 0 });
        await createRow(context, { base, table: tableB, index: 1 });

        const [rowA] = await getRows(tableA.id);
        const bRows = await getRows(tableB.id);
        await linkRecords(
          tableA.id,
          omCol.id,
          rowA.Id,
          bRows.map((r) => r.Id),
        );

        await deleteColumn(moCol!.id);

        const aCols = await Column.list(ctx, { fk_model_id: tableA.id });
        expect(
          aCols.find((c) => isLtarCol(c) && !c.system),
          'reverse OM should be cascade-deleted',
        ).to.be.undefined;

        const placeholder = aCols.find((c) =>
          hasPlaceholderPrefix(c.column_name),
        );
        expect(placeholder, 'placeholder should exist on tableA').to.not.be
          .undefined;

        await assertPlaceholderPopulated(
          tableA.id,
          placeholder!.title,
          bRows.map((r) => r.Title),
        );
      });
    });
  });
}

export default linkPlaceholderTests;
