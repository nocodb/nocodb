import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { NcErrorType, UITypes } from 'nocodb-sdk';
import init from '../../../init';
import { createProject } from '../../../factory/base';
import { createTable } from '../../../factory/table';
import { createRow } from '../../../factory/row';
import {
  createColumn,
  createLtarColumn,
  createLtarColumn2,
} from '../../../factory/column';
import type { Column, Model, Base } from '../../../../../src/models';

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

    /**
     * Fetch base-trash entries scoped to one table, returning the inline
     * `records` array shape the existing tests already use.
     *
     * The unified surface (`baseTrashList`) returns ALL resource types in a
     * base; we filter to `record`-type entries whose `parent_id` matches the
     * table under test. Each entry inlines `records` (PK + values via
     * `chunkList({ extractOnlyPrimaries: true })`), so the `Id` field maps
     * directly back onto the old `{ list: [{ Id }, ...] }` assertions.
     */
    async function baseTrashEntries(tableId: string) {
      const rsp = await internalGet({
        operation: 'baseTrashList',
        resourceType: 'record',
      });
      return ((rsp?.list ?? []) as any[]).filter(
        (entry) => entry.parent_id === tableId,
      );
    }

    async function trashList(tableId: string) {
      const entries = await baseTrashEntries(tableId);
      const list = entries.flatMap((entry) =>
        (entry.records ?? []).map((r: any) => ({ Id: r.Id ?? r.id })),
      );
      return { list };
    }

    /** Trash count — sum of visible records across this table's entries. */
    async function trashCount(tableId: string) {
      const entries = await baseTrashEntries(tableId);
      const count = entries.reduce(
        (sum, entry) => sum + (entry.visible_record_count ?? 0),
        0,
      );
      return { count };
    }

    /** Restore records — pass-through to `baseTrashRestoreRows`. */
    async function restoreRecords(
      tableId: string,
      rowIds: (string | number)[],
      force = false,
      status = 200,
    ) {
      return internalPost(
        { operation: 'baseTrashRestoreRows' },
        { tableId, rowIds: rowIds.map(String), force },
        status,
      );
    }

    /**
     * Permanent-delete the trash entries that contain any of the given
     * rowIds. The unified API only supports entry-level permanent delete,
     * so we resolve `rowIds → trashIds` via the inline `records` array and
     * fan out one delete per affected entry. Each entry typically wraps a
     * single soft-delete operation, so this collapses to one call per
     * `softDelete(...)` in the test setup.
     *
     */
    async function permDelete(
      tableId: string,
      rowIds: (string | number)[],
      status = 200,
    ) {
      const want = new Set(rowIds.map(String));
      let trashIds: string[] = [];
      const POLL_INTERVAL_MS = 50;
      const POLL_ATTEMPTS = 20; // ~1s total
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        const entries = await baseTrashEntries(tableId);
        trashIds = entries
          .filter((entry) =>
            (entry.records ?? []).some((r: any) =>
              want.has(String(r.Id ?? r.id)),
            ),
          )
          .map((entry) => entry.id);
        if (trashIds.length || !rowIds.length) break;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      let last: any = {};
      for (const trashId of trashIds) {
        last = await internalPost(
          { operation: 'baseTrashPermanentDelete' },
          { trashId },
          status,
        );
      }
      return last;
    }

    /** Empty trash — base-scoped (whole base). Tests use one base per run. */
    async function emptyTrash(_tableId: string, status = 200) {
      return internalPost({ operation: 'baseTrashEmpty' }, {}, status);
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

    // ── helpers used by I–M (validation / unique / partial / fix 1) ─────────

    /** Internal columnUpdate — change a column's attrs (validate, unique, colOptions, …) */
    async function updateColumn(
      columnId: string,
      body: Record<string, any>,
      status = 200,
    ) {
      return internalPost(
        { operation: 'columnUpdate', columnId },
        body,
        status,
      );
    }

    /** Add a SingleLineText column to `table`. Returns the new Column. */
    async function addTextColumn(
      table: Model,
      title: string,
      extra: Record<string, any> = {},
    ): Promise<Column> {
      return (await createColumn(context, table, {
        title,
        column_name: title,
        uidt: UITypes.SingleLineText,
        ...extra,
      })) as Column;
    }

    /** Add a SingleSelect column with the given option titles. */
    async function addSingleSelectColumn(
      table: Model,
      title: string,
      options: string[],
    ): Promise<Column> {
      return (await createColumn(context, table, {
        title,
        column_name: title,
        uidt: UITypes.SingleSelect,
        colOptions: { options: options.map((o) => ({ title: o })) },
      })) as Column;
    }

    /** Flip a column's validator on. Pass `func` like 'isEmail' / 'isURL'. */
    async function enableValidator(
      column: Column,
      func: 'isEmail' | 'isURL' | 'isMobilePhone',
      msg = `Validation failed : ${func}`,
    ) {
      await updateColumn(column.id!, {
        ...column,
        meta: { ...(column.meta ?? {}), validate: true },
        validate: JSON.stringify({ func: [func], msg: [msg] }),
      });
    }

    /** Toggle `unique` on an existing column via columnUpdate. */
    async function setUnique(column: Column, unique: boolean) {
      await updateColumn(column.id!, { ...column, unique });
    }

    /** Insert a row with arbitrary fields (V3 data API). */
    async function insertRowWithFields(
      table: Model,
      fields: Record<string, any>,
    ) {
      const rsp = await request(context.app)
        .post(`/api/v3/data/${base.id}/${table.id}/records`)
        .set('xc-auth', context.token)
        .send({ fields })
        .expect(200);
      return rsp.body.records[0];
    }

    /** restoreRecords with an opts object — supports `partial` alongside `force`. */
    async function restoreRecordsOpts(
      tableId: string,
      rowIds: (string | number)[],
      opts: { force?: boolean; partial?: boolean } = {},
      status = 200,
    ) {
      return internalPost(
        { operation: 'baseTrashRestoreRows' },
        { tableId, rowIds: rowIds.map(String), ...opts },
        status,
      );
    }

    /** Read a specific field value on an active record. */
    async function readField(
      table: Model,
      rowId: number | string,
      field: string,
    ) {
      const rec = await getRecord(table, rowId as number);
      return rec.fields?.[field];
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

      // Tests 6 / 6b previously hit `recordTrashPermanentDelete` directly.
      // The unified surface keys permanent delete on the BaseTrash entry
      // (`baseTrashPermanentDelete` + trashId), so the per-row error paths
      // map onto entry-level invariants:
      //   6  → an active record has no trash entry, so attempting
      //        `baseTrashPermanentDelete` against any synthesized id 404s
      //        and the active record is untouched.
      //   6b → restore-side empty-input validation still 400s
      //        (`baseTrashRestoreRows`); permanent-delete-side input
      //        validation is enforced at the entry layer where a missing
      //        trashId 404s.

      it('6. Permanent delete on active record → no entry / 404', async function () {
        const row = await insertRow(tblB, 'B1');

        // Active rows never produce trash entries.
        const entries = await baseTrashEntries(tblB.id!);
        const referenced = entries.some((e) =>
          (e.records ?? []).some(
            (r: any) => String(r.Id ?? r.id) === String(row.id),
          ),
        );
        expect(referenced).to.equal(false);

        // Entry-level permanent delete with a synthesized id 404s — there's
        // no entry to point at, mirroring the old "can't perm-delete an
        // active row" guard.
        await internalPost(
          { operation: 'baseTrashPermanentDelete' },
          { trashId: 'no_such_trash_id' },
          404,
        );

        // The active record is still readable.
        await request(context.app)
          .get(`/api/v3/data/${base.id}/${tblB.id}/records/${row.id}`)
          .set('xc-auth', context.token)
          .expect(200);
      });

      it('6a. Restore with empty rowIds → 400', async function () {
        await restoreRecords(tblB.id!, [], false, 400);
      });

      it('6b. Permanent delete with missing trashId → 404', async function () {
        await internalPost(
          { operation: 'baseTrashPermanentDelete' },
          { trashId: 'no_such_trash_id' },
          404,
        );
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

      it('10a. V1 OO: batch restore [conflict, clean] → entire batch blocked (409)', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const b1 = await insertRow(tblB, 'B1');
        const b2 = await insertRow(tblB, 'B2');
        const b3 = await insertRow(tblB, 'B3');

        // B1 linked to A1 via OO, then soft-deleted, then B2 takes A1's OO slot
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b1.id);
        await softDelete(tblB, b1.id);
        await v1LinkAdd(tblA.id!, a1.id, 'hm', v1OoCol.id!, b2.id);

        // B3 is soft-deleted with no conflict
        await softDelete(tblB, b3.id);

        // Batch restore: B1 has conflict, B3 is clean → entire batch rejected
        const rsp = await restoreRecords(tblB.id!, [b1.id, b3.id], false, 409);
        expect(rsp.error).to.equal(NcErrorType.ERR_RECORD_RESTORE_CONFLICT);

        // Both remain in trash
        const trash = await trashList(tblB.id!);
        const trashIds = trash.list.map((r: any) => r.Id);
        expect(trashIds).to.include(b1.id);
        expect(trashIds).to.include(b3.id);
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

      it('18a. V2 OM (HM): delete parent A1, re-parent B1 to A2, restore A1 → 409 conflict', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const a2 = await insertRow(tblA, 'A2');
        const b1 = await insertRow(tblB, 'B1');

        await v3LinkAdd(tblA.id!, v2OmCol.id!, a1.id, [b1.id]);
        await softDelete(tblA, a1.id);
        // While A1 is in trash, A2 claims B1. Junction {A1,B1} is preserved
        // alongside the new {A2,B1} — restoring A1 would give B1 two parents.
        await v3LinkAdd(tblA.id!, v2OmCol.id!, a2.id, [b1.id]);

        const rsp = await restoreRecords(tblA.id!, [a1.id], false, 409);
        expect(rsp.error).to.equal(NcErrorType.ERR_RECORD_RESTORE_CONFLICT);
      });

      it('18b. V2 OM (HM): force restore A1 → A1 has no B1, A2 still owns B1', async function () {
        const a1 = await insertRow(tblA, 'A1');
        const a2 = await insertRow(tblA, 'A2');
        const b1 = await insertRow(tblB, 'B1');

        await v3LinkAdd(tblA.id!, v2OmCol.id!, a1.id, [b1.id]);
        await softDelete(tblA, a1.id);
        await v3LinkAdd(tblA.id!, v2OmCol.id!, a2.id, [b1.id]);

        await restoreRecords(tblA.id!, [a1.id], true);

        // Force-restore drops the restored record's own conflicting junction
        // row (mirrors V2 OO test 15 — A1 has no B1, A2 still owns B1).
        const a1Links = await v3LinkList(tblA.id!, v2OmCol.id!, a1.id);
        expect(a1Links.records.length).to.equal(0);

        const a2Links = await v3LinkList(tblA.id!, v2OmCol.id!, a2.id);
        expect(a2Links.records.length).to.equal(1);
        expect(a2Links.records[0].id).to.equal(b1.id);
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

    // ═══════════════════════════════════════════════════════════════════════
    // I. Validation conflicts (Email / URL / Phone validators)
    // ═══════════════════════════════════════════════════════════════════════

    describe('I. Validation conflicts', () => {
      it('54. Email validator enabled after trash → 409 with validation conflict', async function () {
        const emailCol = await addTextColumn(tblB, 'Email');
        const row = await insertRowWithFields(tblB, {
          Title: 'B1',
          Email: 'not-an-email',
        });
        await softDelete(tblB, row.id);

        // Turn on the validator AFTER the invalid value is in trash
        await enableValidator(emailCol, 'isEmail');

        const rsp = await restoreRecordsOpts(tblB.id!, [row.id], {}, 409);
        expect(rsp.error).to.equal(NcErrorType.ERR_RECORD_RESTORE_CONFLICT);
        expect(rsp.details?.conflicts?.length).to.be.greaterThan(0);
        const validation = rsp.details.conflicts.find(
          (c: any) => c.kind === 'validation',
        );
        expect(validation).to.exist;
        expect(validation.columnTitle).to.equal('Email');
      });

      it('55. Email validator — valid row restores cleanly even when validator is on', async function () {
        const emailCol = await addTextColumn(tblB, 'Email');
        const row = await insertRowWithFields(tblB, {
          Title: 'B1',
          Email: 'alice@example.com',
        });
        await softDelete(tblB, row.id);
        await enableValidator(emailCol, 'isEmail');

        const rsp = await restoreRecordsOpts(tblB.id!, [row.id]);
        expect(rsp.restored).to.equal(1);
        expect(rsp.cleared).to.deep.equal([]);
      });

      it('56. Force restore with invalid email → email field cleared, row restored', async function () {
        const emailCol = await addTextColumn(tblB, 'Email');
        const row = await insertRowWithFields(tblB, {
          Title: 'B1',
          Email: 'still-not-valid',
        });
        await softDelete(tblB, row.id);
        await enableValidator(emailCol, 'isEmail');

        const rsp = await restoreRecordsOpts(tblB.id!, [row.id], {
          force: true,
        });
        expect(rsp.restored).to.equal(1);
        expect(rsp.cleared?.length).to.equal(1);
        expect(rsp.cleared[0].columns).to.include(emailCol.column_name);

        const emailAfter = await readField(tblB, row.id, 'Email');
        expect(emailAfter == null || emailAfter === '').to.equal(true);
        // Title is untouched
        expect(await readField(tblB, row.id, 'Title')).to.equal('B1');
      });

      it('57. URL validator — invalid URL blocks restore', async function () {
        const urlCol = await addTextColumn(tblB, 'Homepage');
        const row = await insertRowWithFields(tblB, {
          Title: 'B1',
          Homepage: 'htps:/broken',
        });
        await softDelete(tblB, row.id);
        await enableValidator(urlCol, 'isURL');

        const rsp = await restoreRecordsOpts(tblB.id!, [row.id], {}, 409);
        expect(rsp.error).to.equal(NcErrorType.ERR_RECORD_RESTORE_CONFLICT);
        expect(
          rsp.details.conflicts.some(
            (c: any) => c.kind === 'validation' && c.columnTitle === 'Homepage',
          ),
        ).to.equal(true);
      });

      it('58. Phone validator — invalid phone blocks restore', async function () {
        const phoneCol = await addTextColumn(tblB, 'Phone');
        const row = await insertRowWithFields(tblB, {
          Title: 'B1',
          Phone: 'call-me',
        });
        await softDelete(tblB, row.id);
        await enableValidator(phoneCol, 'isMobilePhone');

        const rsp = await restoreRecordsOpts(tblB.id!, [row.id], {}, 409);
        expect(rsp.error).to.equal(NcErrorType.ERR_RECORD_RESTORE_CONFLICT);
        expect(
          rsp.details.conflicts.some(
            (c: any) => c.kind === 'validation' && c.columnTitle === 'Phone',
          ),
        ).to.equal(true);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // J. Unique conflicts (active + intra-batch)
    // ═══════════════════════════════════════════════════════════════════════

    describe('J. Unique conflicts', () => {
      it('59. Unique-active: trash row collides with an active row → 409', async function () {
        const handleCol = await addTextColumn(tblB, 'Handle', { unique: true });

        // Active row holds the value first
        const active = await insertRowWithFields(tblB, {
          Title: 'B1',
          Handle: 'foo',
        });
        // Trash row re-uses the value while the active row is alive:
        // soft-delete active first so the partial unique index permits it,
        // then restore the active row only. The remaining trash row will
        // conflict with it on restore.
        const trash = await insertRowWithFields(tblB, {
          Title: 'B2',
          Handle: 'temp',
        });
        await softDelete(tblB, trash.id);
        // Now set the trash row's handle directly via columnUpdate is not
        // available; instead we reshape the scenario: insert trash row AFTER
        // taking the value, and use a second row that was once 'foo' then
        // soft-deleted. Simpler: delete the active row, insert another with
        // 'foo', then re-active the first. Left as a simpler variant below.
        // Use the columnUpdate → unique strategy instead.
        await setUnique(handleCol, false);
        // With unique off we can give the trash row the same value via a
        // fresh insert + soft-delete:
        const trashDup = await insertRowWithFields(tblB, {
          Title: 'B3',
          Handle: 'foo',
        });
        await softDelete(tblB, trashDup.id);
        await setUnique(handleCol, true);

        const rsp = await restoreRecordsOpts(
          tblB.id!,
          [trashDup.id],
          {},
          409,
        );
        expect(rsp.error).to.equal(NcErrorType.ERR_RECORD_RESTORE_CONFLICT);
        const conflict = rsp.details.conflicts.find(
          (c: any) => c.kind === 'unique-active',
        );
        expect(conflict).to.exist;
        expect(conflict.value).to.equal('foo');
        expect(String(conflict.conflictingRowId)).to.equal(String(active.id));
        // Cleanup not needed — `trash` + `active` remain in DB but only `active` is visible
        void trash;
      });

      it('60. Unique-active + force → value nulled, row restored', async function () {
        const handleCol = await addTextColumn(tblB, 'Handle');
        const active = await insertRowWithFields(tblB, {
          Title: 'B1',
          Handle: 'foo',
        });
        const trashDup = await insertRowWithFields(tblB, {
          Title: 'B2',
          Handle: 'foo',
        });
        await softDelete(tblB, trashDup.id);
        await setUnique(handleCol, true);

        const rsp = await restoreRecordsOpts(tblB.id!, [trashDup.id], {
          force: true,
        });
        expect(rsp.restored).to.equal(1);
        expect(rsp.cleared?.length).to.equal(1);
        expect(rsp.cleared[0].columns).to.include(handleCol.column_name);

        const afterVal = await readField(tblB, trashDup.id, 'Handle');
        expect(afterVal == null || afterVal === '').to.equal(true);
        // Active row still owns 'foo'
        expect(await readField(tblB, active.id, 'Handle')).to.equal('foo');
      });

      it('61. Unique-intra: 3 trash rows share "bar", no active claimant → 2 conflicts (winner keeps)', async function () {
        const handleCol = await addTextColumn(tblB, 'Handle');
        const r1 = await insertRowWithFields(tblB, {
          Title: 'B1',
          Handle: 'bar',
        });
        const r2 = await insertRowWithFields(tblB, {
          Title: 'B2',
          Handle: 'bar',
        });
        const r3 = await insertRowWithFields(tblB, {
          Title: 'B3',
          Handle: 'bar',
        });
        await softDelete(tblB, r1.id);
        await softDelete(tblB, r2.id);
        await softDelete(tblB, r3.id);
        await setUnique(handleCol, true);

        const rsp = await restoreRecordsOpts(
          tblB.id!,
          [r1.id, r2.id, r3.id],
          {},
          409,
        );
        const intras = rsp.details.conflicts.filter(
          (c: any) => c.kind === 'unique-intra',
        );
        // Only 2 losers — the winner has no conflict entry
        expect(intras.length).to.equal(2);
        // All intras share the same winner (lowest PK)
        const winnerRowId = intras[0].winnerRowId;
        expect(intras.every((c: any) => c.winnerRowId === winnerRowId)).to.equal(
          true,
        );
      });

      it('62. Unique-intra + force → winner keeps value, losers cleared', async function () {
        const handleCol = await addTextColumn(tblB, 'Handle');
        const r1 = await insertRowWithFields(tblB, {
          Title: 'B1',
          Handle: 'bar',
        });
        const r2 = await insertRowWithFields(tblB, {
          Title: 'B2',
          Handle: 'bar',
        });
        const r3 = await insertRowWithFields(tblB, {
          Title: 'B3',
          Handle: 'bar',
        });
        await softDelete(tblB, r1.id);
        await softDelete(tblB, r2.id);
        await softDelete(tblB, r3.id);
        await setUnique(handleCol, true);

        const rsp = await restoreRecordsOpts(
          tblB.id!,
          [r1.id, r2.id, r3.id],
          { force: true },
        );
        expect(rsp.restored).to.equal(3);
        expect(rsp.cleared?.length).to.equal(2);

        const handles = await Promise.all(
          [r1.id, r2.id, r3.id].map((id) => readField(tblB, id, 'Handle')),
        );
        // Exactly one of the three keeps 'bar'
        const kept = handles.filter((h) => h === 'bar');
        expect(kept.length).to.equal(1);
      });

      it('63. Active claimant present → every trash row with same value is unique-active (not intra)', async function () {
        const handleCol = await addTextColumn(tblB, 'Handle');
        await insertRowWithFields(tblB, { Title: 'B0', Handle: 'foo' });
        const r1 = await insertRowWithFields(tblB, {
          Title: 'B1',
          Handle: 'foo',
        });
        const r2 = await insertRowWithFields(tblB, {
          Title: 'B2',
          Handle: 'foo',
        });
        await softDelete(tblB, r1.id);
        await softDelete(tblB, r2.id);
        await setUnique(handleCol, true);

        const rsp = await restoreRecordsOpts(
          tblB.id!,
          [r1.id, r2.id],
          {},
          409,
        );
        const active = rsp.details.conflicts.filter(
          (c: any) => c.kind === 'unique-active',
        );
        const intra = rsp.details.conflicts.filter(
          (c: any) => c.kind === 'unique-intra',
        );
        // Both trash rows lose to the active claimant — no intra winner
        expect(active.length).to.equal(2);
        expect(intra.length).to.equal(0);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // K. Partial restore
    // ═══════════════════════════════════════════════════════════════════════

    describe('K. Partial restore', () => {
      it('64. Mixed batch with partial=true → clean rows restored, conflicted stay in trash', async function () {
        const emailCol = await addTextColumn(tblB, 'Email');
        const clean = await insertRowWithFields(tblB, {
          Title: 'B1',
          Email: 'ok@example.com',
        });
        const dirty = await insertRowWithFields(tblB, {
          Title: 'B2',
          Email: 'nope',
        });
        await softDelete(tblB, clean.id);
        await softDelete(tblB, dirty.id);
        await enableValidator(emailCol, 'isEmail');

        const rsp = await restoreRecordsOpts(
          tblB.id!,
          [clean.id, dirty.id],
          { partial: true },
        );
        expect(rsp.restored).to.equal(1);
        expect(rsp.skipped?.length).to.equal(1);
        expect(String(rsp.skipped[0].rowId)).to.equal(String(dirty.id));

        // Clean one is now active
        const active = await listActive(tblB);
        expect(active.map((r: any) => r.id)).to.include(clean.id);

        // Dirty one still in trash
        const trash = await trashList(tblB.id!);
        expect(trash.list.map((r: any) => r.Id)).to.include(dirty.id);
      });

      it('65. Partial with no conflicts behaves like a normal restore', async function () {
        const r = await insertRow(tblB, 'B1');
        await softDelete(tblB, r.id);

        const rsp = await restoreRecordsOpts(tblB.id!, [r.id], {
          partial: true,
        });
        expect(rsp.restored).to.equal(1);
        expect(rsp.skipped).to.deep.equal([]);
      });

      it('66. force + partial together → 400', async function () {
        const r = await insertRow(tblB, 'B1');
        await softDelete(tblB, r.id);
        await restoreRecordsOpts(
          tblB.id!,
          [r.id],
          { force: true, partial: true },
          400,
        );
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // L. Response shape
    // ═══════════════════════════════════════════════════════════════════════

    describe('L. Response shape', () => {
      it('67. Clean restore returns { restored, skipped:[], cleared:[] }', async function () {
        const r = await insertRow(tblB, 'B1');
        await softDelete(tblB, r.id);

        const rsp = await restoreRecordsOpts(tblB.id!, [r.id]);
        expect(rsp.restored).to.equal(1);
        expect(rsp.skipped).to.deep.equal([]);
        expect(rsp.cleared).to.deep.equal([]);
        expect(rsp.message).to.be.a('string');
      });

      it('68. Force-restore response includes cleared[] with the nulled columns', async function () {
        const emailCol = await addTextColumn(tblB, 'Email');
        const r = await insertRowWithFields(tblB, {
          Title: 'B1',
          Email: 'bad',
        });
        await softDelete(tblB, r.id);
        await enableValidator(emailCol, 'isEmail');

        const rsp = await restoreRecordsOpts(tblB.id!, [r.id], {
          force: true,
        });
        expect(rsp.cleared?.length).to.equal(1);
        expect(String(rsp.cleared[0].rowId)).to.equal(String(r.id));
        expect(rsp.cleared[0].columns).to.include(emailCol.column_name);
      });

      it('69. 409 response carries details.conflicts[] and details.counts', async function () {
        const emailCol = await addTextColumn(tblB, 'Email');
        const r = await insertRowWithFields(tblB, {
          Title: 'B1',
          Email: 'bad',
        });
        await softDelete(tblB, r.id);
        await enableValidator(emailCol, 'isEmail');

        const rsp = await restoreRecordsOpts(tblB.id!, [r.id], {}, 409);
        expect(rsp.details?.conflicts).to.be.an('array');
        expect(rsp.details.counts).to.be.an('object');
        expect(rsp.details.counts.validation).to.be.greaterThan(0);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // M. SingleSelect option rename/delete propagates to trash rows (Fix 1)
    // ═══════════════════════════════════════════════════════════════════════

    describe('M. Select option propagation to trash rows', () => {
      it('70. Rename SingleSelect option → trash row value follows, restore clean', async function () {
        const statusCol = await addSingleSelectColumn(tblB, 'Status', [
          'Open',
          'Closed',
        ]);
        const r = await insertRowWithFields(tblB, {
          Title: 'B1',
          Status: 'Open',
        });
        await softDelete(tblB, r.id);

        // Rename 'Open' → 'Active' via columnUpdate
        const colOptions = (await statusCol.getColOptions({
          workspace_id: base.fk_workspace_id,
          base_id: base.id,
        } as any)) as any;
        const renamed = (colOptions?.options ?? []).map((o: any) =>
          o.title === 'Open' ? { ...o, title: 'Active' } : o,
        );
        await updateColumn(statusCol.id!, {
          ...statusCol,
          colOptions: { options: renamed },
        });

        // Restore — should land cleanly and the active row now carries 'Active'
        const rsp = await restoreRecordsOpts(tblB.id!, [r.id]);
        expect(rsp.restored).to.equal(1);
        expect(await readField(tblB, r.id, 'Status')).to.equal('Active');
      });

      it('71. Delete SingleSelect option → trash row value nulled on restore', async function () {
        const statusCol = await addSingleSelectColumn(tblB, 'Status', [
          'Open',
          'Closed',
        ]);
        const r = await insertRowWithFields(tblB, {
          Title: 'B1',
          Status: 'Open',
        });
        await softDelete(tblB, r.id);

        // Remove 'Open' from the option set
        const colOptions = (await statusCol.getColOptions({
          workspace_id: base.fk_workspace_id,
          base_id: base.id,
        } as any)) as any;
        const remaining = (colOptions?.options ?? []).filter(
          (o: any) => o.title !== 'Open',
        );
        await updateColumn(statusCol.id!, {
          ...statusCol,
          colOptions: { options: remaining },
        });

        const rsp = await restoreRecordsOpts(tblB.id!, [r.id]);
        expect(rsp.restored).to.equal(1);
        const after = await readField(tblB, r.id, 'Status');
        expect(after == null || after === '').to.equal(true);
      });
    });
  });
}
