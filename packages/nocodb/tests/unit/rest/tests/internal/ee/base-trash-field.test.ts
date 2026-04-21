import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import init from '../../../../init';
import { createTable } from '../../../../factory/table';
import { createProject } from '../../../../factory/base';
import {
  createColumn,
  createLtarColumn,
  createLtarColumn2,
  createLookupColumn,
  createRollupColumn,
  createQrCodeColumn,
  createBarcodeColumn,
} from '../../../../factory/column';
import { createRow } from '../../../../factory/row';
import Column from '~/models/Column';
import { SelectOption } from '~/models';

type Context = Awaited<ReturnType<typeof init>>;

// ── API Helpers ──────────────────────────────────────────────────

async function internalGet(
  context: Context,
  workspaceId: string,
  baseId: string,
  query: Record<string, string>,
) {
  return request(context.app)
    .get(`/api/v2/internal/${workspaceId}/${baseId}`)
    .query(query)
    .set('xc-token', context.xc_token);
}

async function internalPost(
  context: Context,
  workspaceId: string,
  baseId: string,
  query: Record<string, string>,
  body: Record<string, any> = {},
) {
  return request(context.app)
    .post(`/api/v2/internal/${workspaceId}/${baseId}`)
    .query(query)
    .set('xc-token', context.xc_token)
    .send(body);
}

async function trashField(
  context: Context,
  workspaceId: string,
  baseId: string,
  columnId: string,
) {
  return internalPost(context, workspaceId, baseId, {
    operation: 'columnDelete',
    columnId,
  });
}

async function listTrash(
  context: Context,
  workspaceId: string,
  baseId: string,
  query: Record<string, string> = {},
) {
  return internalGet(context, workspaceId, baseId, {
    operation: 'baseTrashList',
    ...query,
  });
}

async function restoreTrash(
  context: Context,
  workspaceId: string,
  baseId: string,
  trashId: string,
) {
  return internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'baseTrashRestore' },
    { trashId },
  );
}

async function permanentDeleteTrash(
  context: Context,
  workspaceId: string,
  baseId: string,
  trashId: string,
) {
  return internalPost(
    context,
    workspaceId,
    baseId,
    { operation: 'baseTrashPermanentDelete' },
    { trashId },
  );
}

function findTrashEntry(list: any[], resourceId: string) {
  return list.find((t: any) => t.resource_id === resourceId);
}

// ── Tests ────────────────────────────────────────────────────────

export function baseTrashFieldTests() {
  describe('Internal API - Field Trash', () => {
    let context: Context;
    let base: any;
    let ctx: { workspace_id: string; base_id: string };
    let workspaceId: string;
    let baseId: string;

    beforeEach(async () => {
      context = await init();
      base = await createProject(context);
      workspaceId = base.fk_workspace_id;
      baseId = base.id;
      ctx = { workspace_id: workspaceId, base_id: baseId };
    });

    // ── Simple field ───────────────────────────────────────────

    describe('Simple field trash & restore', () => {
      it('should hide field from get/list after trash, show after restore', async () => {
        const table = await createTable(context, base);

        const col = await createColumn(context, table, {
          title: 'TrashField',
          column_name: 'TrashField',
          uidt: UITypes.SingleLineText,
        });

        const delRes = await trashField(context, workspaceId, baseId, col.id);
        expect(delRes.status).to.eq(200);

        // get returns null
        const c = await Column.get(ctx, { colId: col.id });
        expect(c).to.be.null;

        // list excludes it
        const cols = await Column.list(ctx, { fk_model_id: table.id });
        expect(cols.find((cl) => cl.id === col.id)).to.be.undefined;

        // Trash entry exists
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, col.id);
        expect(entry).to.not.be.undefined;
        expect(entry.resource_type).to.eq('field');
        expect(entry.parent_type).to.eq('table');
        expect(entry.parent_id).to.eq(table.id);
        expect(entry.meta?.uidt).to.eq(UITypes.SingleLineText);

        // Restore
        const restoreRes = await restoreTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(restoreRes.status).to.eq(200);

        // get returns it again
        const cRestored = await Column.get(ctx, { colId: col.id });
        expect(cRestored).to.not.be.null;

        // list includes it again
        const colsRestored = await Column.list(ctx, {
          fk_model_id: table.id,
        });
        expect(
          colsRestored.find((cl) => cl.id === col.id),
        ).to.not.be.undefined;
      });

      it('should preserve row data after field trash and restore', async () => {
        const table = await createTable(context, base);

        const col = await createColumn(context, table, {
          title: 'DataField',
          column_name: 'DataField',
          uidt: UITypes.SingleLineText,
        });

        await request(context.app)
          .post(`/api/v1/db/data/noco/${baseId}/${table.id}`)
          .set('xc-auth', context.token)
          .send({ DataField: 'hello' })
          .expect(200);

        await trashField(context, workspaceId, baseId, col.id);

        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, col.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        const dataRes = await request(context.app)
          .get(`/api/v1/db/data/noco/${baseId}/${table.id}`)
          .set('xc-auth', context.token)
          .expect(200);
        expect(dataRes.body.list[0].DataField).to.eq('hello');
      });
    });

    // ── V1 Links: HM ──────────────────────────────────────────

    describe('V1 Links — HM trash & restore', () => {
      it('should cascade reverse BT column and create placeholder', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'HmParent',
          title: 'HmParent',
        });
        const childTable = await createTable(context, base, {
          table_name: 'HmChild',
          title: 'HmChild',
        });

        const ltarCol = await createLtarColumn(context, {
          title: 'HmLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        await trashField(context, workspaceId, baseId, ltarCol.id);

        // Reverse BT column in child should be hidden
        const childCols = await Column.list(ctx, {
          fk_model_id: childTable.id,
        });
        const reverseCol = childCols.find(
          (c) =>
            (c.uidt === UITypes.LinkToAnotherRecord ||
              c.uidt === UITypes.Links) &&
            !c.system,
        );
        expect(reverseCol).to.be.undefined;

        // Placeholder should exist
        const placeholder = childCols.find((c) =>
          c.column_name?.startsWith('_nc_trash_ph_'),
        );
        expect(placeholder).to.not.be.undefined;
      });

      it('should restore HM link and remove placeholder', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'HmRestoreP',
          title: 'HmRestoreP',
        });
        const childTable = await createTable(context, base, {
          table_name: 'HmRestoreC',
          title: 'HmRestoreC',
        });

        const ltarCol = await createLtarColumn(context, {
          title: 'HmRestoreLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        await trashField(context, workspaceId, baseId, ltarCol.id);

        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, ltarCol.id);
        const restoreRes = await restoreTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(restoreRes.status).to.eq(200);

        // Link column back in parent
        const parentCols = await Column.list(ctx, {
          fk_model_id: parentTable.id,
        });
        expect(parentCols.find((c) => c.title === 'HmRestoreLink')).to.not.be
          .undefined;

        // Reverse column back in child, placeholder gone
        const childCols = await Column.list(ctx, {
          fk_model_id: childTable.id,
        });
        expect(
          childCols.find(
            (c) =>
              (c.uidt === UITypes.LinkToAnotherRecord ||
                c.uidt === UITypes.Links) &&
              !c.system,
          ),
        ).to.not.be.undefined;
        expect(
          childCols.find((c) => c.column_name?.startsWith('_nc_trash_ph_')),
        ).to.be.undefined;
      });

      it('should populate placeholder with linked display values', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'HmDataP',
          title: 'HmDataP',
        });
        const childTable = await createTable(context, base, {
          table_name: 'HmDataC',
          title: 'HmDataC',
        });

        const ltarCol = await createLtarColumn(context, {
          title: 'HmDataLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        // Create child rows (they get Title = "Row 0", "Row 1" from factory)
        await createRow(context, { base, table: childTable, index: 0 });
        await createRow(context, { base, table: childTable, index: 1 });

        // Create a parent row
        await createRow(context, { base, table: parentTable, index: 0 });

        // Link child rows to parent via the links API
        const parentRows = await request(context.app)
          .get(`/api/v1/db/data/noco/${baseId}/${parentTable.id}`)
          .set('xc-auth', context.token)
          .expect(200);
        const parentRowId = parentRows.body.list[0].Id;

        const childRows = await request(context.app)
          .get(`/api/v1/db/data/noco/${baseId}/${childTable.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        // Link using the v2 links endpoint
        await request(context.app)
          .post(
            `/api/v2/tables/${parentTable.id}/links/${ltarCol.id}/records/${parentRowId}`,
          )
          .set('xc-auth', context.token)
          .send(childRows.body.list.map((r: any) => ({ Id: r.Id })))
          .expect(201);

        // Trash the HM link on parent
        await trashField(context, workspaceId, baseId, ltarCol.id);

        // Check placeholder on child table has display values
        const childCols = await Column.list(ctx, {
          fk_model_id: childTable.id,
        });
        const placeholder = childCols.find((c) =>
          c.column_name?.startsWith('_nc_trash_ph_'),
        );
        expect(placeholder).to.not.be.undefined;

        // Read child data — placeholder column should have parent's display value
        const dataRes = await request(context.app)
          .get(`/api/v1/db/data/noco/${baseId}/${childTable.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        // At least one child row should have a non-empty placeholder value
        const placeholderValues = dataRes.body.list.map(
          (r: any) => r[placeholder.title],
        );
        const nonEmpty = placeholderValues.filter(
          (v: any) => v != null && v !== '',
        );
        expect(nonEmpty.length).to.be.gte(1);
      });
    });

    // ── V1 Links: BT ──────────────────────────────────────────

    describe('V1 Links — BT trash & restore', () => {
      it('should cascade reverse HM column on BT trash', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'BtParent',
          title: 'BtParent',
        });
        const childTable = await createTable(context, base, {
          table_name: 'BtChild',
          title: 'BtChild',
        });

        // Create HM on parent (auto-creates BT on child)
        await createLtarColumn(context, {
          title: 'BtHmLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        // Find the auto-created BT column on child
        const childCols = await Column.list(ctx, {
          fk_model_id: childTable.id,
        });
        const btCol = childCols.find(
          (c) =>
            (c.uidt === UITypes.LinkToAnotherRecord ||
              c.uidt === UITypes.Links) &&
            !c.system,
        );
        expect(btCol).to.not.be.undefined;

        // Trash the BT column
        const trashRes1 = await trashField(
          context,
          workspaceId,
          baseId,
          btCol.id,
        );
        expect(trashRes1.status).to.eq(200);

        // Check trash entry has related_items (cascade happened)
        const trashListRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashListRes.body.list, btCol.id);
        expect(entry).to.not.be.undefined;
        expect(entry.resource_type).to.eq('field');

        // Reverse HM on parent should be hidden (placeholder takes the same title)
        const parentCols = await Column.list(ctx, {
          fk_model_id: parentTable.id,
        });
        const hmCol = parentCols.find(
          (c) =>
            c.title === 'BtHmLink' &&
            (c.uidt === UITypes.LinkToAnotherRecord || c.uidt === UITypes.Links),
        );
        expect(hmCol).to.be.undefined;

        // Placeholder should exist with the same title but as SingleLineText
        const placeholder = parentCols.find((c) =>
          c.column_name?.startsWith('_nc_trash_ph_'),
        );
        expect(placeholder).to.not.be.undefined;
      });
    });

    // ── V1 Links: OO ──────────────────────────────────────────

    describe('V1 Links — OO trash & restore', () => {
      it('should cascade reverse OO column on trash', async () => {
        const tableA = await createTable(context, base, {
          table_name: 'OoTableA',
          title: 'OoTableA',
        });
        const tableB = await createTable(context, base, {
          table_name: 'OoTableB',
          title: 'OoTableB',
        });

        const ooCol = await createLtarColumn(context, {
          title: 'OoLink',
          parentTable: tableA,
          childTable: tableB,
          type: 'oo',
        });

        await trashField(context, workspaceId, baseId, ooCol.id);

        // Reverse OO on tableB should be hidden
        const bCols = await Column.list(ctx, { fk_model_id: tableB.id });
        const reverseOo = bCols.find(
          (c) =>
            (c.uidt === UITypes.LinkToAnotherRecord ||
              c.uidt === UITypes.Links) &&
            !c.system,
        );
        expect(reverseOo).to.be.undefined;

        // Placeholder on tableB
        expect(
          bCols.find((c) => c.column_name?.startsWith('_nc_trash_ph_')),
        ).to.not.be.undefined;

        // Restore
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, ooCol.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        // Both columns back, placeholder gone
        const aCols = await Column.list(ctx, { fk_model_id: tableA.id });
        expect(aCols.find((c) => c.title === 'OoLink')).to.not.be.undefined;

        const bColsAfter = await Column.list(ctx, { fk_model_id: tableB.id });
        expect(
          bColsAfter.find(
            (c) =>
              (c.uidt === UITypes.LinkToAnotherRecord ||
                c.uidt === UITypes.Links) &&
              !c.system,
          ),
        ).to.not.be.undefined;
        expect(
          bColsAfter.find((c) => c.column_name?.startsWith('_nc_trash_ph_')),
        ).to.be.undefined;
      });
    });

    // ── V2 LTAR: MM ──────────────────────────────────────────

    describe('V2 LTAR — MM trash & restore', () => {
      it('should cascade reverse MM column on trash', async () => {
        const tableA = await createTable(context, base, {
          table_name: 'MmTableA',
          title: 'MmTableA',
        });
        const tableB = await createTable(context, base, {
          table_name: 'MmTableB',
          title: 'MmTableB',
        });

        const mmCol = await createLtarColumn2(context, {
          title: 'MmLink',
          parentTable: tableA,
          childTable: tableB,
          type: 'mm',
        });

        await trashField(context, workspaceId, baseId, mmCol.id);

        // Reverse MM on tableB should be hidden
        const bCols = await Column.list(ctx, { fk_model_id: tableB.id });
        const reverseMm = bCols.find(
          (c) =>
            (c.uidt === UITypes.LinkToAnotherRecord ||
              c.uidt === UITypes.Links) &&
            !c.system,
        );
        expect(reverseMm).to.be.undefined;

        // Restore
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, mmCol.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        // Both MM columns back
        const aColsAfter = await Column.list(ctx, {
          fk_model_id: tableA.id,
        });
        expect(aColsAfter.find((c) => c.title === 'MmLink')).to.not.be
          .undefined;

        const bColsAfter = await Column.list(ctx, {
          fk_model_id: tableB.id,
        });
        expect(
          bColsAfter.find(
            (c) =>
              (c.uidt === UITypes.LinkToAnotherRecord ||
                c.uidt === UITypes.Links) &&
              !c.system,
          ),
        ).to.not.be.undefined;
      });
    });

    // ── V2 LTAR: OO ──────────────────────────────────────────

    describe('V2 LTAR — OO trash & restore', () => {
      it('should cascade reverse OO column (junction-based) on trash', async () => {
        const tableA = await createTable(context, base, {
          table_name: 'OoV2A',
          title: 'OoV2A',
        });
        const tableB = await createTable(context, base, {
          table_name: 'OoV2B',
          title: 'OoV2B',
        });

        // createLtarColumn2 uses UITypes.LinkToAnotherRecord → V2 (junction-based)
        const ooCol = await createLtarColumn2(context, {
          title: 'OoV2Link',
          parentTable: tableA,
          childTable: tableB,
          type: 'oo',
        });

        await trashField(context, workspaceId, baseId, ooCol.id);

        // Reverse on tableB hidden
        const bCols = await Column.list(ctx, { fk_model_id: tableB.id });
        expect(
          bCols.find(
            (c) =>
              (c.uidt === UITypes.LinkToAnotherRecord ||
                c.uidt === UITypes.Links) &&
              !c.system,
          ),
        ).to.be.undefined;

        // Restore
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, ooCol.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        // Both back
        const aColsAfter = await Column.list(ctx, {
          fk_model_id: tableA.id,
        });
        expect(aColsAfter.find((c) => c.title === 'OoV2Link')).to.not.be
          .undefined;
      });
    });

    // ── Dependent columns: Lookup & Rollup ────────────────────

    describe('Dependent columns — Lookup & Rollup error marking', () => {
      it('should error-mark Lookup when LTAR is trashed, clear on restore', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'LkParent',
          title: 'LkParent',
        });
        const childTable = await createTable(context, base, {
          table_name: 'LkChild',
          title: 'LkChild',
        });

        const ltarCol = await createLtarColumn(context, {
          title: 'LkLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        const lookupCol = await createLookupColumn(context, {
          base,
          title: 'LkLookup',
          table: parentTable,
          relatedTableName: childTable.table_name,
          relatedTableColumnTitle: 'Title',
          relationColumnId: ltarCol.id,
        });

        // Trash the LTAR column
        await trashField(context, workspaceId, baseId, ltarCol.id);

        // Lookup should have an error
        const lkCol = await Column.get(ctx, { colId: lookupCol.id });
        const colOptions = await lkCol.getColOptions(ctx);
        expect(colOptions.error).to.not.be.null;
        expect(colOptions.error).to.include('deleted');

        // Restore the LTAR column
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, ltarCol.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        // Lookup error should be cleared
        const lkColAfter = await Column.get(ctx, { colId: lookupCol.id });
        const colOptsAfter = await lkColAfter.getColOptions(ctx);
        expect(colOptsAfter.error).to.be.null;
      });

      it('should error-mark Rollup when its LTAR is trashed', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'RlParent',
          title: 'RlParent',
        });
        const childTable = await createTable(context, base, {
          table_name: 'RlChild',
          title: 'RlChild',
        });

        const ltarCol = await createLtarColumn(context, {
          title: 'RlLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        const rollupCol = await createRollupColumn(context, {
          base,
          title: 'RlRollup',
          rollupFunction: 'count',
          table: parentTable,
          relatedTableName: childTable.table_name,
          relatedTableColumnTitle: 'Title',
          ltarColumnId: ltarCol.id,
        });

        await trashField(context, workspaceId, baseId, ltarCol.id);

        // Rollup should have an error
        const rlCol = await Column.get(ctx, { colId: rollupCol.id });
        expect(rlCol).to.not.be.null;
        const colOptions = await rlCol.getColOptions(ctx);
        expect(colOptions.error).to.not.be.null;
        expect(colOptions.error).to.include('deleted');
      });
    });

    // ── Permanent delete ──────────────────────────────────────

    describe('Permanent delete', () => {
      it('should permanently delete a trashed field', async () => {
        const table = await createTable(context, base);
        const col = await createColumn(context, table, {
          title: 'PermDelField',
          column_name: 'PermDelField',
          uidt: UITypes.SingleLineText,
        });

        await trashField(context, workspaceId, baseId, col.id);

        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, col.id);

        const delRes = await permanentDeleteTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(delRes.status).to.eq(200);

        const c = await Column.get(ctx, {
          colId: col.id,
          includeDeleted: true,
        });
        expect(c).to.not.be.ok;

        const trashRes2 = await listTrash(context, workspaceId, baseId);
        expect(findTrashEntry(trashRes2.body.list, col.id)).to.be.undefined;
      });
    });

    // ── V2 LTAR: OM/MO ────────────────────────────────────────

    describe('V2 LTAR — OM/MO trash & restore', () => {
      it('should cascade reverse MO column on OM trash', async () => {
        const tableA = await createTable(context, base, {
          table_name: 'OmTableA',
          title: 'OmTableA',
        });
        const tableB = await createTable(context, base, {
          table_name: 'OmTableB',
          title: 'OmTableB',
        });

        const omCol = await createLtarColumn2(context, {
          title: 'OmLink',
          parentTable: tableA,
          childTable: tableB,
          type: 'om',
        });

        await trashField(context, workspaceId, baseId, omCol.id);

        // Reverse MO on tableB should be hidden
        const bCols = await Column.list(ctx, { fk_model_id: tableB.id });
        expect(
          bCols.find(
            (c) =>
              (c.uidt === UITypes.LinkToAnotherRecord ||
                c.uidt === UITypes.Links) &&
              !c.system,
          ),
        ).to.be.undefined;

        // Restore
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, omCol.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        // Both back
        const aColsAfter = await Column.list(ctx, {
          fk_model_id: tableA.id,
        });
        expect(aColsAfter.find((c) => c.title === 'OmLink')).to.not.be
          .undefined;

        const bColsAfter = await Column.list(ctx, {
          fk_model_id: tableB.id,
        });
        expect(
          bColsAfter.find(
            (c) =>
              (c.uidt === UITypes.LinkToAnotherRecord ||
                c.uidt === UITypes.Links) &&
              !c.system,
          ),
        ).to.not.be.undefined;
      });
    });

    // ── Transitive Lookup error chain ─────────────────────────

    describe('Transitive Lookup error chain', () => {
      it('should error-mark both Lookups when their shared LTAR is trashed', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'ChainParent',
          title: 'ChainParent',
        });
        const childTable = await createTable(context, base, {
          table_name: 'ChainChild',
          title: 'ChainChild',
        });

        // Add a second column on child so we have two to look up
        await createColumn(context, childTable, {
          title: 'Extra',
          column_name: 'Extra',
          uidt: UITypes.SingleLineText,
        });

        const ltarCol = await createLtarColumn(context, {
          title: 'ChainLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        // L1: Lookup on parent → child's Title via ChainLink
        const l1 = await createLookupColumn(context, {
          base,
          title: 'L1Lookup',
          table: parentTable,
          relatedTableName: childTable.table_name,
          relatedTableColumnTitle: 'Title',
          relationColumnId: ltarCol.id,
        });

        // L2: Lookup on parent → child's Extra via same ChainLink
        const l2 = await createLookupColumn(context, {
          base,
          title: 'L2Lookup',
          table: parentTable,
          relatedTableName: childTable.table_name,
          relatedTableColumnTitle: 'Extra',
          relationColumnId: ltarCol.id,
        });

        // Trash the LTAR
        await trashField(context, workspaceId, baseId, ltarCol.id);

        // L1 should have error
        const l1After = await Column.get(ctx, { colId: l1.id });
        const l1Opts = await l1After.getColOptions(ctx);
        expect(l1Opts.error).to.not.be.null;
        expect(l1Opts.error).to.include('deleted');

        // L2 should also have error
        const l2After = await Column.get(ctx, { colId: l2.id });
        const l2Opts = await l2After.getColOptions(ctx);
        expect(l2Opts.error).to.not.be.null;
        expect(l2Opts.error).to.include('deleted');
      });
    });

    // ── Formula error marking ─────────────────────────────────

    describe('Formula referencing trashed column', () => {
      it('should error-mark Formula when referenced column is trashed', async () => {
        const table = await createTable(context, base);

        const textCol = await createColumn(context, table, {
          title: 'MyText',
          column_name: 'MyText',
          uidt: UITypes.SingleLineText,
        });

        const formulaCol = await createColumn(context, table, {
          title: 'MyFormula',
          column_name: 'MyFormula',
          uidt: UITypes.Formula,
          formula_raw: `CONCAT({MyText}, ' suffix')`,
        });

        await trashField(context, workspaceId, baseId, textCol.id);

        // Formula should have error
        const fCol = await Column.get(ctx, { colId: formulaCol.id });
        const fOpts = await fCol.getColOptions(ctx);
        expect(fOpts.error).to.not.be.null;
        expect(fOpts.error).to.include('deleted');
      });
    });

    // ── QrCode/Barcode error marking ──────────────────────────

    describe('QrCode & Barcode referencing trashed column', () => {
      it('should error-mark QrCode when referenced column is trashed', async () => {
        const table = await createTable(context, base);

        const qrCol = await createQrCodeColumn(context, {
          title: 'MyQr',
          table,
          referencedQrValueTableColumnTitle: 'Title',
        });

        // Get the Title column id
        const cols = await Column.list(ctx, { fk_model_id: table.id });
        const titleCol = cols.find((c) => c.title === 'Title');

        await trashField(context, workspaceId, baseId, titleCol.id);

        // QrCode should have error
        const qCol = await Column.get(ctx, { colId: qrCol.id });
        const qOpts = await qCol.getColOptions(ctx);
        expect(qOpts.error).to.not.be.null;
        expect(qOpts.error).to.include('deleted');
      });

      it('should error-mark Barcode when referenced column is trashed', async () => {
        const table = await createTable(context, base);

        const barcodeCol = await createBarcodeColumn(context, {
          title: 'MyBarcode',
          table,
          referencedBarcodeValueTableColumnTitle: 'Title',
        });

        const cols = await Column.list(ctx, { fk_model_id: table.id });
        const titleCol = cols.find((c) => c.title === 'Title');

        await trashField(context, workspaceId, baseId, titleCol.id);

        // Barcode should have error
        const bCol = await Column.get(ctx, { colId: barcodeCol.id });
        const bOpts = await bCol.getColOptions(ctx);
        expect(bOpts.error).to.not.be.null;
        expect(bOpts.error).to.include('deleted');
      });
    });

    // ── Select column options survive restore ─────────────────

    describe('Select column — options survive trash & restore', () => {
      it('should preserve SingleSelect options after trash and restore', async () => {
        const table = await createTable(context, base);

        const selectCol = await createColumn(context, table, {
          title: 'Status',
          column_name: 'Status',
          uidt: UITypes.SingleSelect,
          colOptions: {
            options: [
              { title: 'Todo' },
              { title: 'In Progress' },
              { title: 'Done' },
            ],
          },
        });

        // Verify options exist before trash
        const optsBefore = await SelectOption.read(ctx, selectCol.id);
        expect(optsBefore.options.length).to.eq(3);

        await trashField(context, workspaceId, baseId, selectCol.id);

        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, selectCol.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        // Re-fetch column to verify it's back
        const restored = await Column.get(ctx, { colId: selectCol.id });
        expect(restored).to.not.be.null;

        // Options should survive — read via getColOptions which loads fresh from DB
        const colOptions = await restored.getColOptions(ctx);
        expect(colOptions.options).to.be.an('array');
        expect(colOptions.options.length).to.eq(3);
        const titles = colOptions.options.map((o: any) => o.title);
        expect(titles).to.include('Todo');
        expect(titles).to.include('In Progress');
        expect(titles).to.include('Done');
      });
    });

    // ── Permanent delete LTAR with cascade ────────────────────

    describe('Permanent delete LTAR — cascade cleanup', () => {
      it('should clean up cascade artifacts on LTAR permanent delete', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'PermLtarP',
          title: 'PermLtarP',
        });
        const childTable = await createTable(context, base, {
          table_name: 'PermLtarC',
          title: 'PermLtarC',
        });

        const ltarCol = await createLtarColumn(context, {
          title: 'PermLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        await trashField(context, workspaceId, baseId, ltarCol.id);

        // Placeholder should exist on child
        const childCols = await Column.list(ctx, {
          fk_model_id: childTable.id,
        });
        expect(
          childCols.find((c) => c.column_name?.startsWith('_nc_trash_ph_')),
        ).to.not.be.undefined;

        // Permanent delete
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, ltarCol.id);
        const delRes = await permanentDeleteTrash(
          context,
          workspaceId,
          baseId,
          entry.id,
        );
        expect(delRes.status).to.eq(200);

        // Trash entry gone
        const trashRes2 = await listTrash(context, workspaceId, baseId);
        expect(findTrashEntry(trashRes2.body.list, ltarCol.id)).to.be.undefined;

        // Placeholder column kept (user retains snapshot data)
        const childColsAfter = await Column.list(ctx, {
          fk_model_id: childTable.id,
        });
        expect(
          childColsAfter.find((c) =>
            c.column_name?.startsWith('_nc_trash_ph_'),
          ),
        ).to.not.be.undefined;
      });
    });

    // ── Error clearing on restore ───────────────────────────

    describe('Error clearing on restore', () => {
      it('should clear Rollup error on restore', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'RlClrP',
          title: 'RlClrP',
        });
        const childTable = await createTable(context, base, {
          table_name: 'RlClrC',
          title: 'RlClrC',
        });

        const ltarCol = await createLtarColumn(context, {
          title: 'RlClrLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        const rollupCol = await createRollupColumn(context, {
          base,
          title: 'RlClrRollup',
          rollupFunction: 'count',
          table: parentTable,
          relatedTableName: childTable.table_name,
          relatedTableColumnTitle: 'Title',
          ltarColumnId: ltarCol.id,
        });

        await trashField(context, workspaceId, baseId, ltarCol.id);

        // Error set
        const rlCol = await Column.get(ctx, { colId: rollupCol.id });
        const opts = await rlCol.getColOptions(ctx);
        expect(opts.error).to.not.be.null;

        // Restore
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, ltarCol.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        // Error cleared
        const rlColAfter = await Column.get(ctx, { colId: rollupCol.id });
        const optsAfter = await rlColAfter.getColOptions(ctx);
        expect(optsAfter.error).to.be.null;
      });

      it('should clear Formula error on restore', async () => {
        const table = await createTable(context, base);

        const textCol = await createColumn(context, table, {
          title: 'FmClrText',
          column_name: 'FmClrText',
          uidt: UITypes.SingleLineText,
        });

        const formulaCol = await createColumn(context, table, {
          title: 'FmClrFormula',
          column_name: 'FmClrFormula',
          uidt: UITypes.Formula,
          formula_raw: `CONCAT({FmClrText}, ' suffix')`,
        });

        await trashField(context, workspaceId, baseId, textCol.id);

        // Error set
        const fCol = await Column.get(ctx, { colId: formulaCol.id });
        const opts = await fCol.getColOptions(ctx);
        expect(opts.error).to.not.be.null;

        // Restore
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, textCol.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        // Error cleared
        const fColAfter = await Column.get(ctx, { colId: formulaCol.id });
        const optsAfter = await fColAfter.getColOptions(ctx);
        expect(optsAfter.error).to.be.null;
      });

      it('should clear QrCode and Barcode error on restore', async () => {
        const table = await createTable(context, base);

        const qrCol = await createQrCodeColumn(context, {
          title: 'QrClr',
          table,
          referencedQrValueTableColumnTitle: 'Title',
        });

        const barcodeCol = await createBarcodeColumn(context, {
          title: 'BcClr',
          table,
          referencedBarcodeValueTableColumnTitle: 'Title',
        });

        const cols = await Column.list(ctx, { fk_model_id: table.id });
        const titleCol = cols.find((c) => c.title === 'Title');

        await trashField(context, workspaceId, baseId, titleCol.id);

        // Errors set
        const qr = await Column.get(ctx, { colId: qrCol.id });
        expect((await qr.getColOptions(ctx)).error).to.not.be.null;
        const bc = await Column.get(ctx, { colId: barcodeCol.id });
        expect((await bc.getColOptions(ctx)).error).to.not.be.null;

        // Restore
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, titleCol.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        // Errors cleared
        const qrAfter = await Column.get(ctx, { colId: qrCol.id });
        expect((await qrAfter.getColOptions(ctx)).error).to.be.null;
        const bcAfter = await Column.get(ctx, { colId: barcodeCol.id });
        expect((await bcAfter.getColOptions(ctx)).error).to.be.null;
      });
    });

    // ── BT full restore cycle ────────────────────────────────

    describe('V1 Links — BT full restore', () => {
      it('should restore BT and reverse HM after trash', async () => {
        const parentTable = await createTable(context, base, {
          table_name: 'BtRstP',
          title: 'BtRstP',
        });
        const childTable = await createTable(context, base, {
          table_name: 'BtRstC',
          title: 'BtRstC',
        });

        await createLtarColumn(context, {
          title: 'BtRstLink',
          parentTable,
          childTable,
          type: 'hm',
        });

        // Find BT on child
        const childCols = await Column.list(ctx, {
          fk_model_id: childTable.id,
        });
        const btCol = childCols.find(
          (c) =>
            (c.uidt === UITypes.LinkToAnotherRecord ||
              c.uidt === UITypes.Links) &&
            !c.system,
        );

        await trashField(context, workspaceId, baseId, btCol.id);

        // Restore
        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, btCol.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        // BT back on child
        const childColsAfter = await Column.list(ctx, {
          fk_model_id: childTable.id,
        });
        expect(
          childColsAfter.find(
            (c) =>
              (c.uidt === UITypes.LinkToAnotherRecord ||
                c.uidt === UITypes.Links) &&
              !c.system,
          ),
        ).to.not.be.undefined;

        // HM back on parent, placeholder gone
        const parentColsAfter = await Column.list(ctx, {
          fk_model_id: parentTable.id,
        });
        expect(
          parentColsAfter.find(
            (c) =>
              c.title === 'BtRstLink' &&
              (c.uidt === UITypes.LinkToAnotherRecord ||
                c.uidt === UITypes.Links),
          ),
        ).to.not.be.undefined;
        expect(
          parentColsAfter.find((c) =>
            c.column_name?.startsWith('_nc_trash_ph_'),
          ),
        ).to.be.undefined;
      });
    });

    // ── Parent table trashed guard ───────────────────────────

    describe('Parent table trashed guard', () => {
      it('should fail to restore field when parent table is trashed', async () => {
        const table = await createTable(context, base, {
          table_name: 'ParentTrashed',
          title: 'ParentTrashed',
        });

        const col = await createColumn(context, table, {
          title: 'OrphanField',
          column_name: 'OrphanField',
          uidt: UITypes.SingleLineText,
        });

        // Trash the field first
        await trashField(context, workspaceId, baseId, col.id);

        // Now trash the table (via tableDelete which routes to trashTable stub → hard delete)
        await internalPost(context, workspaceId, baseId, {
          operation: 'tableDelete',
          tableId: table.id,
        });

        // Try to restore — should fail because parent table is gone
        const trashRes = await listTrash(context, workspaceId, baseId);
        const fieldEntry = findTrashEntry(trashRes.body.list, col.id);
        if (fieldEntry) {
          const restoreRes = await restoreTrash(
            context,
            workspaceId,
            baseId,
            fieldEntry.id,
          );
          expect(restoreRes.status).to.be.gte(400);
        }
      });
    });

    // ── MultiSelect options survive ──────────────────────────

    describe('MultiSelect options survive trash & restore', () => {
      it('should preserve MultiSelect options after trash and restore', async () => {
        const table = await createTable(context, base);

        const selectCol = await createColumn(context, table, {
          title: 'Tags',
          column_name: 'Tags',
          uidt: UITypes.MultiSelect,
          colOptions: {
            options: [
              { title: 'Red' },
              { title: 'Green' },
              { title: 'Blue' },
            ],
          },
        });

        await trashField(context, workspaceId, baseId, selectCol.id);

        const trashRes = await listTrash(context, workspaceId, baseId);
        const entry = findTrashEntry(trashRes.body.list, selectCol.id);
        await restoreTrash(context, workspaceId, baseId, entry.id);

        const restored = await Column.get(ctx, { colId: selectCol.id });
        expect(restored).to.not.be.null;

        const colOptions = await restored.getColOptions(ctx);
        expect(colOptions.options).to.be.an('array');
        expect(colOptions.options.length).to.eq(3);
        const titles = colOptions.options.map((o: any) => o.title);
        expect(titles).to.include('Red');
        expect(titles).to.include('Green');
        expect(titles).to.include('Blue');
      });
    });

    // ── Error handling ────────────────────────────────────────

    describe('Error handling', () => {
      it('should prevent double-trashing a field', async () => {
        const table = await createTable(context, base);
        const col = await createColumn(context, table, {
          title: 'DoubleTrash',
          column_name: 'DoubleTrash',
          uidt: UITypes.SingleLineText,
        });

        await trashField(context, workspaceId, baseId, col.id);

        const res = await trashField(context, workspaceId, baseId, col.id);
        expect(res.status).to.be.gte(400);
      });

      it('should return error when trashing non-existent column', async () => {
        const res = await trashField(
          context,
          workspaceId,
          baseId,
          'nonexistent_col_id',
        );
        expect(res.status).to.be.gte(400);
      });
    });
  });
}
