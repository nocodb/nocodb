import 'mocha';
import { expect } from 'chai';
import init from '~test/init';
import { createV3Base } from '~test/factory/base';
import { internalPost, readSorts, untracedCtx } from '~test/factory/internal';
import { createTable, v3Post } from '~test/factory/v3';
import { OperationLog } from '~/models';

type Context = Awaited<ReturnType<typeof init>> & { tabId?: string };

/**
 * Infrastructure-level invariants for the per-tab undo/redo pipeline.
 *
 * The per-entity operation matrix in `./undo-redo/index.test.ts` already
 * exercises forward → undo → redo for every contract. This file only
 * covers behaviors that aren't on a single-op happy path:
 *
 *   - Tab-id gating: no `x-nc-tab-id` header ⇒ no log row recorded.
 *   - `undoStatus` reports canUndo/canRedo across a full cycle.
 *   - Scope isolation: an op on table A doesn't surface on table B's stack.
 *   - Replay reentry guard: undo dispatch must not write a second log row.
 *
 * Uses `sortCreate` throughout as the smallest meaningful contract.
 */

const TAB_ID = 'tab_roundtrip_test';

export function undoRedoRoundtripTests() {
  describe('Undo/Redo - per-tab round-trip', () => {
    let context: Context;
    let env: { workspaceId: string; baseId: string };
    let tableId: string;
    let gridViewId: string;
    let titleColId: string;

    beforeEach(async () => {
      context = await init();
      context.tabId = TAB_ID;
      const workspaceId = context.fk_workspace_id!;
      const base = await createV3Base(context, `undo_${Date.now()}`);
      env = { workspaceId, baseId: base.id };

      // Untraced setup — tableCreate/gridViewCreate must not pollute the
      // test's undo stack; each it() asserts against its own forward op.
      const setupCtx = untracedCtx(context);
      const t = await createTable(setupCtx, env, 'UndoTable');
      tableId = t.id;
      titleColId = t.titleColId;
      const vCreate = await internalPost(
        setupCtx,
        env,
        { operation: 'gridViewCreate', tableId },
        { title: 'UndoGrid' },
      );
      expect(vCreate.status, `gridViewCreate: ${JSON.stringify(vCreate.body)}`).to.eq(200);
      gridViewId = vCreate.body.id;
    });

    it('does NOT record a log row when x-nc-tab-id header is missing', async () => {
      // untracedCtx clears tabId so the request goes through without the header.
      const sCreate = await internalPost(
        untracedCtx(context),
        env,
        { operation: 'sortCreate', viewId: gridViewId },
        { fk_column_id: titleColId, direction: 'asc' },
      );
      expect(sCreate.status).to.eq(200);

      // No tab id ⇒ no log row recorded ⇒ active stack stays empty.
      const top = await OperationLog.getLatestActive(
        { workspace_id: env.workspaceId, base_id: env.baseId },
        {
          fk_user_id: context.user.id,
          tab_id: TAB_ID,
          scopes: [
            { type: 'view', id: gridViewId },
            { type: 'table', id: tableId },
            { type: 'base', id: env.baseId },
          ],
        },
      );
      expect(top, 'no row should be recorded without x-nc-tab-id').to.be.null;
    });

    it('undo with empty stack returns status:"empty"', async () => {
      const res = await internalPost(
        context,
        env,
        { operation: 'undo' },
        {
          scopes: [
            { type: 'view', id: gridViewId },
            { type: 'table', id: tableId },
            { type: 'base', id: env.baseId },
          ],
        },
      );
      expect(res.status).to.eq(200);
      expect(res.body.status).to.equal('empty');
    });

    it('undoStatus reports canUndo / canRedo correctly across the cycle', async () => {
      const scopes = [
        { type: 'view' as const, id: gridViewId },
        { type: 'table' as const, id: tableId },
        { type: 'base' as const, id: env.baseId },
      ];
      const status = async () => {
        const r = await internalPost(
          context,
          env,
          { operation: 'undoStatus' },
          { scopes },
        );
        return r.body as { canUndo: boolean; canRedo: boolean };
      };

      // Initially: nothing to undo or redo
      const s0 = await status();
      expect(s0).to.deep.equal({ canUndo: false, canRedo: false });

      // After forward
      await internalPost(
        context,
        env,
        { operation: 'sortCreate', viewId: gridViewId },
        { fk_column_id: titleColId, direction: 'asc' },
      );
      const s1 = await status();
      expect(s1.canUndo).to.equal(true);
      expect(s1.canRedo).to.equal(false);

      // After undo
      await internalPost(
        context,
        env,
        { operation: 'undo' },
        { scopes },
      );
      const s2 = await status();
      expect(s2.canUndo).to.equal(false);
      expect(s2.canRedo).to.equal(true);

      // After redo
      await internalPost(
        context,
        env,
        { operation: 'redo' },
        { scopes },
      );
      const s3 = await status();
      expect(s3.canUndo).to.equal(true);
      expect(s3.canRedo).to.equal(false);
    });

    it('scope-aware: an op on table A does not appear on table B undo stack', async () => {
      const setupCtx = untracedCtx(context);
      // Create a second table — setup, not under test, so untraced.
      const tB = await createTable(setupCtx, env, 'OtherTable', [
        { title: 'Name', type: 'SingleLineText' },
      ]);
      const titleBId = tB.fields.find((f: any) => f.title === 'Name').id;
      const vCreate2 = await internalPost(
        setupCtx,
        env,
        { operation: 'gridViewCreate', tableId: tB.id },
        { title: 'OtherGrid' },
      );
      const gridB = vCreate2.body.id;

      // Sort on table A
      await internalPost(
        context,
        env,
        { operation: 'sortCreate', viewId: gridViewId },
        { fk_column_id: titleColId, direction: 'asc' },
      );

      // Sort on table B
      await internalPost(
        context,
        env,
        { operation: 'sortCreate', viewId: gridB },
        { fk_column_id: titleBId, direction: 'asc' },
      );

      // Status filtered to table B — only sees one op
      const scopesB = [
        { type: 'view' as const, id: gridB },
        { type: 'table' as const, id: tB.id },
        { type: 'base' as const, id: env.baseId },
      ];
      const statusB = await internalPost(
        context,
        env,
        { operation: 'undoStatus' },
        { scopes: scopesB },
      );
      expect(statusB.body.canUndo).to.equal(true);

      // Undo on table B
      const undoB = await internalPost(
        context,
        env,
        { operation: 'undo' },
        { scopes: scopesB },
      );
      expect(undoB.body.status).to.equal('ok');

      // Table B has no sort; table A's sort still alive — proves the
      // undo only popped from table B's scope.
      const r1 = await internalPost(
        context,
        env,
        { operation: 'undoStatus' },
        { scopes: scopesB },
      );
      expect(r1.body.canUndo).to.equal(false);

      const scopesA = [
        { type: 'view' as const, id: gridViewId },
        { type: 'table' as const, id: tableId },
        { type: 'base' as const, id: env.baseId },
      ];
      const r2 = await internalPost(
        context,
        env,
        { operation: 'undoStatus' },
        { scopes: scopesA },
      );
      expect(r2.body.canUndo).to.equal(true);
    });

    it('isReplay path: undo dispatch does NOT record a second log row', async () => {
      const before = await internalPost(
        context,
        env,
        { operation: 'sortCreate', viewId: gridViewId },
        { fk_column_id: titleColId, direction: 'asc' },
      );
      expect(before.status).to.eq(200);

      const scopes = [
        { type: 'view' as const, id: gridViewId },
        { type: 'table' as const, id: tableId },
        { type: 'base' as const, id: env.baseId },
      ];
      const lookup = {
        fk_user_id: context.user.id,
        tab_id: TAB_ID,
        scopes,
      };
      const baseCtx = { workspace_id: env.workspaceId, base_id: env.baseId };

      const beforeActive = await OperationLog.countByStatus(baseCtx, lookup, 'active');
      const beforeUndone = await OperationLog.countByStatus(baseCtx, lookup, 'undone');

      await internalPost(
        context,
        env,
        { operation: 'undo' },
        { scopes },
      );

      const afterActive = await OperationLog.countByStatus(baseCtx, lookup, 'active');
      const afterUndone = await OperationLog.countByStatus(baseCtx, lookup, 'undone');

      // The inverse sortDelete dispatched under runInReplay must NOT have
      // written its own row (record.ts:281 guard). One row moves from
      // active → undone; total count unchanged.
      expect(afterActive).to.equal(beforeActive - 1);
      expect(afterUndone).to.equal(beforeUndone + 1);
    });

    it('sortDelete undo restores the sort at its original order slot', async () => {
      // Need three sortable columns — the default `createTable` only gives
      // one (`Title`). Setup creates two more fields under untracedCtx so
      // the test's undo stack stays clean.
      const setupCtx = untracedCtx(context);
      const add2 = await v3Post(
        setupCtx,
        `/api/v3/meta/bases/${env.baseId}/tables/${tableId}/fields`,
        { title: 'F2', type: 'SingleLineText' },
      );
      expect(add2.status, `fieldAdd F2: ${JSON.stringify(add2.body)}`).to.eq(200);
      const col2Id: string = add2.body.id;
      const add3 = await v3Post(
        setupCtx,
        `/api/v3/meta/bases/${env.baseId}/tables/${tableId}/fields`,
        { title: 'F3', type: 'SingleLineText' },
      );
      expect(add3.status, `fieldAdd F3: ${JSON.stringify(add3.body)}`).to.eq(200);
      const col3Id: string = add3.body.id;
      expect(col2Id, 'col2Id resolved').to.be.a('string');
      expect(col3Id, 'col3Id resolved').to.be.a('string');

      // Three sorts, untraced so we own the test's log stack ourselves.
      for (const colId of [titleColId, col2Id, col3Id]) {
        const r = await internalPost(
          setupCtx,
          env,
          { operation: 'sortCreate', viewId: gridViewId },
          { fk_column_id: colId, direction: 'asc' },
        );
        expect(r.status, `sortCreate ${colId}: ${JSON.stringify(r.body)}`).to.eq(200);
      }

      const initial = await readSorts(setupCtx, env, gridViewId);
      const middle = initial.find((s) => s.fk_column_id === col2Id);
      expect(middle, 'middle sort resolved').to.be.an('object');
      const middleOrder = middle.order as number;
      expect(middleOrder, 'middle sort has order').to.be.a('number');

      // Delete the middle sort under the test's tab so it lands on the
      // undo stack we'll pop from.
      const del = await internalPost(
        context,
        env,
        { operation: 'sortDelete', sortId: middle.id },
        {},
      );
      expect(del.status, `sortDelete: ${JSON.stringify(del.body)}`).to.eq(200);

      // Undo
      const undoRes = await internalPost(
        context,
        env,
        { operation: 'undo' },
        {
          scopes: [
            { type: 'view' as const, id: gridViewId },
            { type: 'table' as const, id: tableId },
            { type: 'base' as const, id: env.baseId },
          ],
        },
      );
      expect(undoRes.body.status, `undo: ${JSON.stringify(undoRes.body)}`).to.equal('ok');

      // The restored sort should be back at its original `order` slot —
      // NOT appended at the bottom (which would be max(order)+1).
      const after = await readSorts(setupCtx, env, gridViewId);
      const restored = after.find((s) => s.fk_column_id === col2Id);
      expect(restored, 'sort restored').to.be.an('object');
      expect(restored.order, 'order preserved across delete+undo').to.equal(
        middleOrder,
      );
    });
  });
}
