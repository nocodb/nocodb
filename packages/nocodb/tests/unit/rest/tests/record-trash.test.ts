import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { NcErrorType, UITypes } from 'nocodb-sdk';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { createRow } from '../../factory/row';
import {
  createColumn,
  createLtarColumn,
  createLtarColumn2,
} from '../../factory/column';
import type { Column, Model, Base } from '../../../../src/models';

/**
 * Record Trash (soft-delete / restore / permanent-delete) tests.
 *
 * Covers:
 *   A. Basic CRUD operations (list, count, restore, perm-delete, empty)
 *   B. V1 link restore preservation (HM, OO, MM)
 *   C. V1 OO conflict detection + force restore
 *   D. V2 link restore + junction preservation (MM, OO, MO, OM)
 *   E. Self-referential links (V1 + V2)
 *   F. LMT propagation on soft-delete and restore
 *   G. Permanent delete cleanup (FK null, junction cleanup)
 *   H. Audit logging
 */
export default function recordTrashTests() {
  describe('Record Trash', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let base: Base;
    let wsId: string;
    let internalUrl: string;

    // Tables
    let tblA: Model;
    let tblB: Model;
    let tblSelf: Model;

    // V1 link columns (Links UIType → V1 for HM/BT/OO)
    let v1HmCol: Column; // tblA HM -> tblB (direct FK)
    let v1OoCol: Column; // tblA OO -> tblB (direct FK — Links + OO = V1)
    let v1MmCol: Column; // tblA MM <-> tblB (junction table)

    // V2 link columns (LTAR UIType → V2 for OO; Links UIType → V2 for MM/MO/OM)
    let v2OoCol: Column; // tblA OO -> tblB (junction table — LTAR + OO = V2)
    let v2MmCol: Column; // tblA MM <-> tblB (junction table)
    let v2MoCol: Column; // tblA MO -> tblB (junction table)
    let v2OmCol: Column; // tblA OM -> tblB (junction table)

    // Self-ref columns
    let v1SelfOoCol: Column; // V1 OO self-ref (Links + OO = V1)
    let v2SelfOoCol: Column; // V2 OO self-ref (LTAR + OO = V2)
    let v1SelfHmCol: Column;
    let v1SelfMmCol: Column;
    let v2SelfMmCol: Column;
    let v2SelfMoCol: Column;

    // ── helpers ──────────────────────────────────────────────────────────────

    /** Create a record in a table and return its row */
    async function insertRow(table: Model, title: string) {
      const columns = await table.getColumns({
        workspace_id: base.fk_workspace_id,
        base_id: base.id,
      });
      const titleCol = columns.find((c) => c.pv);
      const rsp = await request(context.app)
        .post(
          `/api/v3/data/${base.id}/${table.id}/records`,
        )
        .set('xc-auth', context.token)
        .send({ fields: { [titleCol!.title!]: title } })
        .expect(200);
      return rsp.body.records[0];
    }

    /** Soft-delete a record via V3 API */
    async function softDelete(table: Model, rowId: number) {
      await request(context.app)
        .delete(
          `/api/v3/data/${base.id}/${table.id}/records`,
        )
        .set('xc-auth', context.token)
        .send({ id: rowId })
        .expect(200);
    }

    /** List active records */
    async function listActive(table: Model) {
      const rsp = await request(context.app)
        .get(
          `/api/v3/data/${base.id}/${table.id}/records`,
        )
        .set('xc-auth', context.token)
        .expect(200);
      return rsp.body.records;
    }

    /** Get a single record */
    async function getRecord(table: Model, rowId: number) {
      const rsp = await request(context.app)
        .get(
          `/api/v3/data/${base.id}/${table.id}/records/${rowId}`,
        )
        .set('xc-auth', context.token)
        .expect(200);
      return rsp.body;
    }

    /** Internal GET operation */
    async function internalGet(
      params: Record<string, any>,
      status = 200,
    ) {
      const rsp = await request(context.app)
        .get(internalUrl)
        .query(params)
        .set('xc-token', context.xc_token)
        .expect(status);
      return rsp.body;
    }

    /** Internal POST operation */
    async function internalPost(
      query: Record<string, any>,
      body: Record<string, any>,
      status = 200,
    ) {
      const rsp = await request(context.app)
        .post(internalUrl)
        .query(query)
        .set('xc-token', context.xc_token)
        .send(body)
        .expect(status);
      return rsp.body;
    }

    /** Trash list */
    async function trashList(tableId: string) {
      return internalGet({
        operation: 'recordTrashList',
        tableId,
      });
    }

    /** Trash count */
    async function trashCount(tableId: string) {
      return internalGet({
        operation: 'recordTrashCount',
        tableId,
      });
    }

    /** Restore records */
    async function restoreRecords(
      tableId: string,
      rowIds: (string | number)[],
      force = false,
      status = 200,
    ) {
      return internalPost(
        { operation: 'recordTrashRestore' },
        { tableId, rowIds: rowIds.map(String), force },
        status,
      );
    }

    /** Permanent delete records */
    async function permDelete(
      tableId: string,
      rowIds: (string | number)[],
      status = 200,
    ) {
      return internalPost(
        { operation: 'recordTrashPermanentDelete' },
        { tableId, rowIds: rowIds.map(String) },
        status,
      );
    }

    /** Empty trash */
    async function emptyTrash(tableId: string, status = 200) {
      return internalPost(
        { operation: 'recordTrashEmpty' },
        { tableId },
        status,
      );
    }

    /** Add V1 link: POST /api/v1/db/data/noco/{baseId}/{tableId}/{rowId}/{type}/{colId}/{refRowId} */
    async function v1LinkAdd(
      tableId: string,
      rowId: number,
      type: string,
      colId: string,
      refRowId: number,
    ) {
      await request(context.app)
        .post(
          `/api/v1/db/data/noco/${base.id}/${tableId}/${rowId}/${type}/${colId}/${refRowId}`,
        )
        .set('xc-auth', context.token)
        .expect(200);
    }

    /** Get V1 link list */
    async function v1LinkList(
      tableId: string,
      rowId: number,
      type: string,
      colId: string,
    ) {
      const rsp = await request(context.app)
        .get(
          `/api/v1/db/data/noco/${base.id}/${tableId}/${rowId}/${type}/${colId}`,
        )
        .set('xc-auth', context.token)
        .expect(200);
      return rsp.body;
    }

    /** Add V3 link */
    async function v3LinkAdd(
      tableId: string,
      linkColId: string,
      rowId: number,
      refRowIds: number[],
    ) {
      await request(context.app)
        .post(
          `/api/v3/data/${base.id}/${tableId}/links/${linkColId}/${rowId}`,
        )
        .set('xc-auth', context.token)
        .send(refRowIds.map((id) => ({ id })))
        .expect(200);
    }

    /** Get V3 link list */
    async function v3LinkList(
      tableId: string,
      linkColId: string,
      rowId: number,
    ) {
      const rsp = await request(context.app)
        .get(
          `/api/v3/data/${base.id}/${tableId}/links/${linkColId}/${rowId}`,
        )
        .set('xc-auth', context.token)
        .expect(200);
      return rsp.body;
    }

    /** Get audit log for a record */
    async function auditList(tableId: string, rowId: number) {
      return internalGet({
        operation: 'recordAuditList',
        fk_model_id: tableId,
        row_id: rowId,
      });
    }

    /** Sleep utility for LMT tests */
    function sleep(ms: number) {
      return new Promise((r) => setTimeout(r, ms));
    }

    // ── setup ────────────────────────────────────────────────────────────────

    beforeEach(async function () {
      this.timeout(60000);
      context = await init();
      base = await createProject(context);
      wsId = base.fk_workspace_id!;
      internalUrl = `/api/v2/internal/${wsId}/${base.id}`;

      // Create tables
      tblA = await createTable(context, base, {
        table_name: 'TableA',
        title: 'TableA',
      });
      tblB = await createTable(context, base, {
        table_name: 'TableB',
        title: 'TableB',
      });
      tblSelf = await createTable(context, base, {
        table_name: 'TableSelf',
        title: 'TableSelf',
      });

      // V1 links
      v1HmCol = await createLtarColumn2(context, {
        title: 'V1_HM',
        parentTable: tblA,
        childTable: tblB,
        type: 'hm',
      });
      v1OoCol = await createLtarColumn(context, {
        title: 'V1_OO',
        parentTable: tblA,
        childTable: tblB,
        type: 'oo', // Links + OO = V1 (direct FK)
      });
      v1MmCol = await createLtarColumn2(context, {
        title: 'V1_MM',
        parentTable: tblA,
        childTable: tblB,
        type: 'mm',
      });

      // V2 links
      v2OoCol = await createLtarColumn2(context, {
        title: 'V2_OO',
        parentTable: tblA,
        childTable: tblB,
        type: 'oo', // LTAR + OO = V2 (junction table)
      });
      v2MmCol = await createLtarColumn(context, {
        title: 'V2_MM',
        parentTable: tblA,
        childTable: tblB,
        type: 'mm',
      });
      v2MoCol = await createLtarColumn(context, {
        title: 'V2_MO',
        parentTable: tblA,
        childTable: tblB,
        type: 'mo',
      });
      v2OmCol = await createLtarColumn(context, {
        title: 'V2_OM',
        parentTable: tblA,
        childTable: tblB,
        type: 'om',
      });

      // Self-referential
      v1SelfOoCol = await createLtarColumn(context, {
        title: 'V1_Self_OO',
        parentTable: tblSelf,
        childTable: tblSelf,
        type: 'oo', // Links + OO = V1
      });
      v2SelfOoCol = await createLtarColumn2(context, {
        title: 'V2_Self_OO',
        parentTable: tblSelf,
        childTable: tblSelf,
        type: 'oo', // LTAR + OO = V2
      });
      v1SelfHmCol = await createLtarColumn2(context, {
        title: 'V1_Self_HM',
        parentTable: tblSelf,
        childTable: tblSelf,
        type: 'hm',
      });
      v1SelfMmCol = await createLtarColumn2(context, {
        title: 'V1_Self_MM',
        parentTable: tblSelf,
        childTable: tblSelf,
        type: 'mm',
      });

      // Self-referential V2 (Links UIType)
      v2SelfMmCol = await createLtarColumn(context, {
        title: 'V2_Self_MM',
        parentTable: tblSelf,
        childTable: tblSelf,
        type: 'mm',
      });
      v2SelfMoCol = await createLtarColumn(context, {
        title: 'V2_Self_MO',
        parentTable: tblSelf,
        childTable: tblSelf,
        type: 'mo',
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // A. Basic CRUD Operations
    // ═══════════════════════════════════════════════════════════════════════

    describe('A. Basic CRUD', () => {
      it('1. Soft-delete record appears in trash list', async function () {
        const row = await insertRow(tblA, 'A1');
        await softDelete(tblA, row.id);

        const trash = await trashList(tblA.id!);
        const ids = trash.list.map((r: any) => r.Id);
        expect(ids).to.include(row.id);
      });

      it('2. Trash count reflects soft-deleted records', async function () {
        await insertRow(tblA, 'A1');
        const row2 = await insertRow(tblA, 'A2');
        const row3 = await insertRow(tblA, 'A3');
        await softDelete(tblA, row2.id);
        await softDelete(tblA, row3.id);

        const result = await trashCount(tblA.id!);
        expect(result.count).to.equal(2);
      });

      it('3. Restore record → visible in active list, gone from trash', async function () {
        const row = await insertRow(tblA, 'A1');
        await softDelete(tblA, row.id);
        await restoreRecords(tblA.id!, [row.id]);

        const active = await listActive(tblA);
        expect(active.map((r: any) => r.id)).to.include(row.id);

        const trash = await trashList(tblA.id!);
        const trashIds = trash.list.map((r: any) => r.Id);
        expect(trashIds).to.not.include(row.id);
      });

      it('4. Permanent delete → gone from active and trash', async function () {
        const row = await insertRow(tblB, 'B1');
        await softDelete(tblB, row.id);
        await permDelete(tblB.id!, [row.id]);

        const trash = await trashList(tblB.id!);
        const trashIds = trash.list.map((r: any) => r.Id);
        expect(trashIds).to.not.include(row.id);

        // Should be 404 in active list
        await request(context.app)
          .get(`/api/v3/data/${base.id}/${tblB.id}/records/${row.id}`)
          .set('xc-auth', context.token)
          .expect(404);
      });

      it('5. Empty trash → all trashed records permanently deleted', async function () {
        const r1 = await insertRow(tblB, 'B1');
        const r2 = await insertRow(tblB, 'B2');
        const r3 = await insertRow(tblB, 'B3');
        await softDelete(tblB, r1.id);
        await softDelete(tblB, r2.id);
        await softDelete(tblB, r3.id);

        await emptyTrash(tblB.id!);

        const result = await trashCount(tblB.id!);
        expect(result.count).to.equal(0);
      });

      it('6. Permanent delete on active record → 422', async function () {
        const row = await insertRow(tblB, 'B1');
        await permDelete(tblB.id!, [row.id], 422);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // B. V1 Links — Restore Preserves Links
    // ═══════════════════════════════════════════════════════════════════════

    describe('B. V1 Links — restore preserves links', () => {
      it('7. HM: delete child → restore → link to parent intact', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1HmCol.id!, b1.id);

        await softDelete(tblB, b1.id);
        await restoreRecords(tblB.id!, [b1.id]);

        const links = await v1LinkList(tblA.id!, a1.id, 'hm', v1HmCol.id!);
        expect(links.list.length).to.equal(1);
      });

      it('8. OO: delete child → restore → OO link preserved', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b1.id);

        await softDelete(tblB, b1.id);
        await restoreRecords(tblB.id!, [b1.id]);

        const links = await v1LinkList(tblA.id!, a1.id, 'hm', v1OoCol.id!);
        expect(links.list.length).to.equal(1);
      });

      it('9. MM: delete record → restore → MM link preserved', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'mm', v1MmCol.id!, b1.id);

        await softDelete(tblB, b1.id);
        await restoreRecords(tblB.id!, [b1.id]);

        const links = await v1LinkList(tblA.id!, a1.id, 'mm', v1MmCol.id!);
        expect(links.list.length).to.equal(1);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // C. V1 OO — No Conflict (direct FK, no junction)
    // ═══════════════════════════════════════════════════════════════════════

    describe('C. V1 OO Conflict Detection', () => {
      it('10. V1 OO: A→B, delete B, link A→C, restore B → 409 conflict', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        const b2 = await insertRow(tblB, 'B2');

        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b1.id);
        await softDelete(tblB, b1.id);
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b2.id);

        // V1 OO: FK preserved on soft-deleted B1. B2 now also has same FK → conflict
        const rsp = await restoreRecords(tblB.id!, [b1.id], false, 409);
        expect(rsp.error).to.equal(NcErrorType.ERR_RECORD_RESTORE_CONFLICT);
      });

      it('11. V1 OO: force restore B → success, B without link, A still → C', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        const b2 = await insertRow(tblB, 'B2');

        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b1.id);
        await softDelete(tblB, b1.id);
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b2.id);

        await restoreRecords(tblB.id!, [b1.id], true);

        // A1 should still point to B2
        const links = await v1LinkList(tblA.id!, a1.id, 'hm', v1OoCol.id!);
        expect(links.list.length).to.equal(1);
        expect(links.list[0].Id).to.equal(b2.id);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // D. V2 Links — Restore + Junction Preservation
    // ═══════════════════════════════════════════════════════════════════════

    describe('D. V2 Links — restore + junction preservation', () => {
      it('12. V2 MM: delete record → restore → junction row intact', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v3LinkAdd(tblA.id!, v2MmCol.id!, a1.id, [b1.id]);

        await softDelete(tblB, b1.id);
        await restoreRecords(tblB.id!, [b1.id]);

        const links = await v3LinkList(tblA.id!, v2MmCol.id!, a1.id);
        expect(links.records.length).to.equal(1);
      });

      it('13. V2 OO: delete child → restore (no conflict) → link preserved', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'oo', v2OoCol.id!, b1.id);

        await softDelete(tblB, b1.id);
        await restoreRecords(tblB.id!, [b1.id]);

        const links = await v1LinkList(tblA.id!, a1.id, 'oo', v2OoCol.id!);
        expect(links.list.length).to.equal(1);
      });

      it('14. V2 OO: A→B, delete B, link A→C → junction row {A,B} preserved', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        const b2 = await insertRow(tblB, 'B2');

        await v1LinkAdd(tblA.id!, a1.id, 'oo', v2OoCol.id!, b1.id);
        await softDelete(tblB, b1.id);
        await v1LinkAdd(tblA.id!, a1.id, 'oo', v2OoCol.id!, b2.id);

        const rsp = await restoreRecords(tblB.id!, [b1.id], false, 409);
        expect(rsp.error).to.equal(NcErrorType.ERR_RECORD_RESTORE_CONFLICT);
      });

      it('15. V2 OO: force restore B → success, A still → C', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        const b2 = await insertRow(tblB, 'B2');

        await v1LinkAdd(tblA.id!, a1.id, 'oo', v2OoCol.id!, b1.id);
        await softDelete(tblB, b1.id);
        await v1LinkAdd(tblA.id!, a1.id, 'oo', v2OoCol.id!, b2.id);

        await restoreRecords(tblB.id!, [b1.id], true);

        const links = await v1LinkList(tblA.id!, a1.id, 'oo', v2OoCol.id!);
        expect(links.list.length).to.equal(1);
        expect(links.list[0].Id).to.equal(b2.id);
      });

      it('16. V2 MO: delete record → restore → link preserved', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v3LinkAdd(tblA.id!, v2MoCol.id!, a1.id, [b1.id]);

        await softDelete(tblB, b1.id);
        await restoreRecords(tblB.id!, [b1.id]);

        const links = await v3LinkList(tblA.id!, v2MoCol.id!, a1.id);
        expect(links.records.length).to.equal(1);
      });

      it('18. V2 OM: delete record → restore → link preserved', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v3LinkAdd(tblA.id!, v2OmCol.id!, a1.id, [b1.id]);

        await softDelete(tblB, b1.id);
        await restoreRecords(tblB.id!, [b1.id]);

        const links = await v3LinkList(tblA.id!, v2OmCol.id!, a1.id);
        expect(links.records.length).to.equal(1);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // E. Self-Referential Links
    // ═══════════════════════════════════════════════════════════════════════

    describe('E. Self-Referential Links', () => {
      // ── V1 Self-Ref ──

      it('19. V1 OO self-ref: S1→S2, delete S2 → restore → link preserved', async function () {
        const s1 = await insertRow(tblSelf, 'S1');
        const s2 = await insertRow(tblSelf, 'S2');
        await v1LinkAdd(tblSelf.id!, s1.id, 'hm', v1SelfOoCol.id!, s2.id);

        await softDelete(tblSelf, s2.id);
        await restoreRecords(tblSelf.id!, [s2.id]);

        const links = await v1LinkList(tblSelf.id!, s1.id, 'hm', v1SelfOoCol.id!);
        expect(links.list.length).to.equal(1);
      });

      it('20. V1 OO self-ref: S1→S2, delete S2, link S1→S3, restore S2 → 409', async function () {
        const s1 = await insertRow(tblSelf, 'S1');
        const s2 = await insertRow(tblSelf, 'S2');
        const s3 = await insertRow(tblSelf, 'S3');

        await v1LinkAdd(tblSelf.id!, s1.id, 'hm', v1SelfOoCol.id!, s2.id);
        await softDelete(tblSelf, s2.id);
        await v1LinkAdd(tblSelf.id!, s1.id, 'hm', v1SelfOoCol.id!, s3.id);

        await restoreRecords(tblSelf.id!, [s2.id], false, 409);
      });

      it('21. V1 OO self-ref: force restore S2 → success, S1 still → S3', async function () {
        const s1 = await insertRow(tblSelf, 'S1');
        const s2 = await insertRow(tblSelf, 'S2');
        const s3 = await insertRow(tblSelf, 'S3');

        await v1LinkAdd(tblSelf.id!, s1.id, 'hm', v1SelfOoCol.id!, s2.id);
        await softDelete(tblSelf, s2.id);
        await v1LinkAdd(tblSelf.id!, s1.id, 'hm', v1SelfOoCol.id!, s3.id);

        await restoreRecords(tblSelf.id!, [s2.id], true);

        const links = await v1LinkList(tblSelf.id!, s1.id, 'hm', v1SelfOoCol.id!);
        expect(links.list.length).to.equal(1);
        expect(links.list[0].Id).to.equal(s3.id);
      });

      it('22. V1 HM self-ref: delete child → restore → link preserved', async function () {
        const s1 = await insertRow(tblSelf, 'S1');
        const s2 = await insertRow(tblSelf, 'S2');
        await v1LinkAdd(tblSelf.id!, s1.id, 'hm', v1SelfHmCol.id!, s2.id);

        await softDelete(tblSelf, s2.id);
        await restoreRecords(tblSelf.id!, [s2.id]);

        const links = await v1LinkList(tblSelf.id!, s1.id, 'hm', v1SelfHmCol.id!);
        expect(links.list.length).to.equal(1);
      });

      it('23. V1 MM self-ref: S1↔S2, delete S2 → restore → link preserved', async function () {
        const s1 = await insertRow(tblSelf, 'S1');
        const s2 = await insertRow(tblSelf, 'S2');
        await v1LinkAdd(tblSelf.id!, s1.id, 'mm', v1SelfMmCol.id!, s2.id);

        await softDelete(tblSelf, s2.id);
        await restoreRecords(tblSelf.id!, [s2.id]);

        const links = await v1LinkList(tblSelf.id!, s1.id, 'mm', v1SelfMmCol.id!);
        expect(links.list.length).to.equal(1);
      });

      // ── V2 Self-Ref ──

      it('24. V2 OO self-ref: S1→S2, delete S2 → restore → link preserved', async function () {
        const s1 = await insertRow(tblSelf, 'S1');
        const s2 = await insertRow(tblSelf, 'S2');
        await v1LinkAdd(tblSelf.id!, s1.id, 'oo', v2SelfOoCol.id!, s2.id);

        await softDelete(tblSelf, s2.id);
        await restoreRecords(tblSelf.id!, [s2.id]);

        const links = await v1LinkList(tblSelf.id!, s1.id, 'oo', v2SelfOoCol.id!);
        expect(links.list.length).to.equal(1);
      });

      it('25. V2 OO self-ref: S1→S2, delete S2, link S1→S3, restore S2 → 409', async function () {
        const s1 = await insertRow(tblSelf, 'S1');
        const s2 = await insertRow(tblSelf, 'S2');
        const s3 = await insertRow(tblSelf, 'S3');

        await v1LinkAdd(tblSelf.id!, s1.id, 'oo', v2SelfOoCol.id!, s2.id);
        await softDelete(tblSelf, s2.id);
        await v1LinkAdd(tblSelf.id!, s1.id, 'oo', v2SelfOoCol.id!, s3.id);

        await restoreRecords(tblSelf.id!, [s2.id], false, 409);
      });

      it('26. V2 OO self-ref: force restore S2 → success, S1 still → S3', async function () {
        const s1 = await insertRow(tblSelf, 'S1');
        const s2 = await insertRow(tblSelf, 'S2');
        const s3 = await insertRow(tblSelf, 'S3');

        await v1LinkAdd(tblSelf.id!, s1.id, 'oo', v2SelfOoCol.id!, s2.id);
        await softDelete(tblSelf, s2.id);
        await v1LinkAdd(tblSelf.id!, s1.id, 'oo', v2SelfOoCol.id!, s3.id);

        await restoreRecords(tblSelf.id!, [s2.id], true);

        const links = await v1LinkList(tblSelf.id!, s1.id, 'oo', v2SelfOoCol.id!);
        expect(links.list.length).to.equal(1);
        expect(links.list[0].Id).to.equal(s3.id);
      });

      it('27. V2 MM self-ref: S1↔S2, delete S2 → restore → junction row intact', async function () {
        const s1 = await insertRow(tblSelf, 'S1');
        const s2 = await insertRow(tblSelf, 'S2');
        await v3LinkAdd(tblSelf.id!, v2SelfMmCol.id!, s1.id, [s2.id]);

        await softDelete(tblSelf, s2.id);
        await restoreRecords(tblSelf.id!, [s2.id]);

        const links = await v3LinkList(tblSelf.id!, v2SelfMmCol.id!, s1.id);
        expect(links.records.length).to.equal(1);
      });

      it('29. V2 MO self-ref: delete record → restore → link preserved', async function () {
        const s1 = await insertRow(tblSelf, 'S1');
        const s2 = await insertRow(tblSelf, 'S2');
        await v3LinkAdd(tblSelf.id!, v2SelfMoCol.id!, s1.id, [s2.id]);

        await softDelete(tblSelf, s2.id);
        await restoreRecords(tblSelf.id!, [s2.id]);

        const links = await v3LinkList(tblSelf.id!, v2SelfMoCol.id!, s1.id);
        expect(links.records.length).to.equal(1);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // F. LMT Propagation
    // ═══════════════════════════════════════════════════════════════════════

    describe('F. LMT Propagation', () => {
      async function getUpdatedAt(table: Model, rowId: number) {
        const rec = await getRecord(table, rowId);
        // V3 API returns fields with column titles; system UpdatedAt title
        return rec.fields?.UpdatedAt || rec.fields?.nc_updated_at || rec.UpdatedAt || rec.nc_updated_at;
      }

      it('30. V1 HM: soft-delete child → parent LMT updated', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1HmCol.id!, b1.id);

        const lmtBefore = await getUpdatedAt(tblA, a1.id);
        await sleep(1100);
        await softDelete(tblB, b1.id);
        const lmtAfter = await getUpdatedAt(tblA, a1.id);

        expect(new Date(lmtAfter).getTime()).to.be.greaterThan(
          new Date(lmtBefore).getTime(),
        );
      });

      it('31. V1 HM: restore child → parent LMT updated', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1HmCol.id!, b1.id);
        await softDelete(tblB, b1.id);

        const lmtBefore = await getUpdatedAt(tblA, a1.id);
        await sleep(1100);
        await restoreRecords(tblB.id!, [b1.id]);
        const lmtAfter = await getUpdatedAt(tblA, a1.id);

        expect(new Date(lmtAfter).getTime()).to.be.greaterThan(
          new Date(lmtBefore).getTime(),
        );
      });

      it('32. V1 OO: soft-delete child → parent LMT updated', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b1.id);

        const lmtBefore = await getUpdatedAt(tblA, a1.id);
        await sleep(1100);
        await softDelete(tblB, b1.id);
        const lmtAfter = await getUpdatedAt(tblA, a1.id);

        expect(new Date(lmtAfter).getTime()).to.be.greaterThan(
          new Date(lmtBefore).getTime(),
        );
      });

      it('33. V1 OO: restore child → parent LMT updated', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b1.id);
        await softDelete(tblB, b1.id);

        const lmtBefore = await getUpdatedAt(tblA, a1.id);
        await sleep(1100);
        await restoreRecords(tblB.id!, [b1.id]);
        const lmtAfter = await getUpdatedAt(tblA, a1.id);

        expect(new Date(lmtAfter).getTime()).to.be.greaterThan(
          new Date(lmtBefore).getTime(),
        );
      });

      it('34. V1 MM: soft-delete one side → other side LMT updated', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'mm', v1MmCol.id!, b1.id);

        const lmtBefore = await getUpdatedAt(tblA, a1.id);
        await sleep(1100);
        await softDelete(tblB, b1.id);
        const lmtAfter = await getUpdatedAt(tblA, a1.id);

        expect(new Date(lmtAfter).getTime()).to.be.greaterThan(
          new Date(lmtBefore).getTime(),
        );
      });

      it('35. V1 MM: restore → other side LMT updated', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'mm', v1MmCol.id!, b1.id);
        await softDelete(tblB, b1.id);

        const lmtBefore = await getUpdatedAt(tblA, a1.id);
        await sleep(1100);
        await restoreRecords(tblB.id!, [b1.id]);
        const lmtAfter = await getUpdatedAt(tblA, a1.id);

        expect(new Date(lmtAfter).getTime()).to.be.greaterThan(
          new Date(lmtBefore).getTime(),
        );
      });

      it('36. V2 OO: soft-delete child → parent LMT updated', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'oo', v2OoCol.id!, b1.id);

        const lmtBefore = await getUpdatedAt(tblA, a1.id);
        await sleep(1100);
        await softDelete(tblB, b1.id);
        const lmtAfter = await getUpdatedAt(tblA, a1.id);

        expect(new Date(lmtAfter).getTime()).to.be.greaterThan(
          new Date(lmtBefore).getTime(),
        );
      });

      it('37. V2 OO: restore child → parent LMT updated', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'oo', v2OoCol.id!, b1.id);
        await softDelete(tblB, b1.id);

        const lmtBefore = await getUpdatedAt(tblA, a1.id);
        await sleep(1100);
        await restoreRecords(tblB.id!, [b1.id]);
        const lmtAfter = await getUpdatedAt(tblA, a1.id);

        expect(new Date(lmtAfter).getTime()).to.be.greaterThan(
          new Date(lmtBefore).getTime(),
        );
      });

      it('38. V2 MM: soft-delete one side → other side LMT updated', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v3LinkAdd(tblA.id!, v2MmCol.id!, a1.id, [b1.id]);

        const lmtBefore = await getUpdatedAt(tblA, a1.id);
        await sleep(1100);
        await softDelete(tblB, b1.id);
        const lmtAfter = await getUpdatedAt(tblA, a1.id);

        expect(new Date(lmtAfter).getTime()).to.be.greaterThan(
          new Date(lmtBefore).getTime(),
        );
      });

      it('39. V2 MM: restore → other side LMT updated', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v3LinkAdd(tblA.id!, v2MmCol.id!, a1.id, [b1.id]);
        await softDelete(tblB, b1.id);

        const lmtBefore = await getUpdatedAt(tblA, a1.id);
        await sleep(1100);
        await restoreRecords(tblB.id!, [b1.id]);
        const lmtAfter = await getUpdatedAt(tblA, a1.id);

        expect(new Date(lmtAfter).getTime()).to.be.greaterThan(
          new Date(lmtBefore).getTime(),
        );
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // G. Permanent Delete Cleanup
    // ═══════════════════════════════════════════════════════════════════════

    describe('G. Permanent Delete Cleanup', () => {
      it('40. V1 HM: permanent delete child → parent HM link empty', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1HmCol.id!, b1.id);

        await softDelete(tblB, b1.id);
        await permDelete(tblB.id!, [b1.id]);

        const links = await v1LinkList(tblA.id!, a1.id, 'hm', v1HmCol.id!);
        expect(links.list.length).to.equal(0);
      });

      it('41. V1 OO: permanent delete child → parent OO link empty', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b1.id);

        await softDelete(tblB, b1.id);
        await permDelete(tblB.id!, [b1.id]);

        const links = await v1LinkList(tblA.id!, a1.id, 'hm', v1OoCol.id!);
        expect(links.list.length).to.equal(0);
      });

      it('42. V1 MM: permanent delete → junction row cleaned up', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'mm', v1MmCol.id!, b1.id);

        await softDelete(tblB, b1.id);
        await permDelete(tblB.id!, [b1.id]);

        const links = await v1LinkList(tblA.id!, a1.id, 'mm', v1MmCol.id!);
        expect(links.list.length).to.equal(0);
      });

      it('43. V2 OO: permanent delete → junction row cleaned up', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v1LinkAdd(tblA.id!, a1.id, 'oo', v2OoCol.id!, b1.id);

        await softDelete(tblB, b1.id);
        await permDelete(tblB.id!, [b1.id]);

        const links = await v1LinkList(tblA.id!, a1.id, 'oo', v2OoCol.id!);
        expect(links.list.length).to.equal(0);
      });

      it('44. V2 MM: permanent delete → junction row cleaned up', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v3LinkAdd(tblA.id!, v2MmCol.id!, a1.id, [b1.id]);

        await softDelete(tblB, b1.id);
        await permDelete(tblB.id!, [b1.id]);

        const links = await v3LinkList(tblA.id!, v2MmCol.id!, a1.id);
        expect(links.records.length).to.equal(0);
      });

      it('45. V2 MO: permanent delete → junction row cleaned up', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        await v3LinkAdd(tblA.id!, v2MoCol.id!, a1.id, [b1.id]);

        await softDelete(tblB, b1.id);
        await permDelete(tblB.id!, [b1.id]);

        const links = await v3LinkList(tblA.id!, v2MoCol.id!, a1.id);
        expect(links.records.length).to.equal(0);
      });

      it('46. Empty trash on table with V1 link columns → no SQL error', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const a2 = await insertRow(tblA, 'A2');
        await softDelete(tblA, a1.id);
        await softDelete(tblA, a2.id);

        await emptyTrash(tblA.id!);

        const result = await trashCount(tblA.id!);
        expect(result.count).to.equal(0);
      });

      it('47. Empty trash on table with V2 link columns → no SQL error', async function () {
        const b1 = await insertRow(tblB, 'B1');
        const b2 = await insertRow(tblB, 'B2');
        await softDelete(tblB, b1.id);
        await softDelete(tblB, b2.id);

        await emptyTrash(tblB.id!);

        const result = await trashCount(tblB.id!);
        expect(result.count).to.equal(0);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // H. Audit Logging
    // ═══════════════════════════════════════════════════════════════════════

    describe('H. Audit Logging', () => {
      it('48. Soft-delete record → audit entry logged', async function () {
        const row = await insertRow(tblB, 'B1');
        await softDelete(tblB, row.id);

        const audit = await auditList(tblB.id!, row.id);
        const ops = audit.list.map((e: any) => e.op_type);
        expect(ops).to.include('DATA_SOFT_DELETE');
      });

      it('49. Restore record → audit entry logged', async function () {
        const row = await insertRow(tblB, 'B1');
        await softDelete(tblB, row.id);
        await restoreRecords(tblB.id!, [row.id]);

        const audit = await auditList(tblB.id!, row.id);
        const ops = audit.list.map((e: any) => e.op_type);
        expect(ops).to.include('DATA_RESTORE');
      });

      it('50. Permanent delete → audit entry logged', async function () {
        const row = await insertRow(tblB, 'B1');
        const rowId = row.id;
        await softDelete(tblB, rowId);
        await permDelete(tblB.id!, [rowId]);

        const audit = await auditList(tblB.id!, rowId);
        const ops = audit.list.map((e: any) => e.op_type);
        expect(ops).to.include('DATA_DELETE');
      });

      it('51. Force restore (OO conflict) → audit logs restore', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        const b2 = await insertRow(tblB, 'B2');

        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b1.id);
        await softDelete(tblB, b1.id);
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b2.id);
        await restoreRecords(tblB.id!, [b1.id], true);

        const audit = await auditList(tblB.id!, b1.id);
        const ops = audit.list.map((e: any) => e.op_type);
        expect(ops).to.include('DATA_RESTORE');
      });

      it('52. Bulk soft-delete → one audit entry per record', async function () {
        const r1 = await insertRow(tblB, 'B1');
        const r2 = await insertRow(tblB, 'B2');

        // Delete both
        await request(context.app)
          .delete(`/api/v3/data/${base.id}/${tblB.id}/records`)
          .set('xc-auth', context.token)
          .send([{ id: r1.id }, { id: r2.id }])
          .expect(200);

        const audit1 = await auditList(tblB.id!, r1.id);
        const audit2 = await auditList(tblB.id!, r2.id);

        expect(audit1.list.some((e: any) => e.op_type === 'DATA_SOFT_DELETE')).to.be
          .true;
        expect(audit2.list.some((e: any) => e.op_type === 'DATA_SOFT_DELETE')).to.be
          .true;
      });

      it('53. Bulk restore → one audit entry per record', async function () {
        const r1 = await insertRow(tblB, 'B1');
        const r2 = await insertRow(tblB, 'B2');
        await softDelete(tblB, r1.id);
        await softDelete(tblB, r2.id);

        await restoreRecords(tblB.id!, [r1.id, r2.id]);

        const audit1 = await auditList(tblB.id!, r1.id);
        const audit2 = await auditList(tblB.id!, r2.id);

        expect(audit1.list.some((e: any) => e.op_type === 'DATA_RESTORE')).to.be
          .true;
        expect(audit2.list.some((e: any) => e.op_type === 'DATA_RESTORE')).to.be
          .true;
      });
    });
  });
}
