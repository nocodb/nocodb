import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import {
  TableSyncOnDeleteAction,
  TableSyncStatus,
  TableSyncTrigger,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import init from '~test/init';
import { isPgData } from '~test/init/db';
import { isEE } from '~test/utils/helpers';
import { createProject } from '~test/factory/base';
import { createTable } from '~test/factory/table';
import { createView } from '~test/factory/view';
import { createColumn, createLtarColumn2 } from '~test/factory/column';
import { internalGet, internalPost, untracedCtx } from '~test/factory/internal';
import {
  tableSyncCreate,
  tableSyncDelete,
  tableSyncFreeze,
  tableSyncResume,
  tableSyncUpdate,
  waitForSyncSettled,
} from '~test/factory/tableSync';
import View from '~/models/View';
import Model from '~/models/Model';
import TableSync from '~/models/TableSync';
import { OperationLog } from '~/models';

/**
 * Command-registry undo/redo round-trips for the Table Sync contracts.
 *
 * The `tableSync*` ops record into `nc_operation_logs` via `@TraceCommand`;
 * this exercises forward → undo → redo for each and asserts the entity state
 * oscillates stably with the sync id preserved across the trash-restore that
 * backs undo-of-delete / redo-of-create. Complements `ee/tableSync.test.ts`
 * (forward-only) and the per-entity matrix in `undo-redo/index.test.ts` (which
 * carries a create + delete smoke spec for sync); the field-level and
 * freeze/resume depth lives here, where the two-base + shared-view fixture is.
 *
 * Replay specifics this locks in:
 *   - create undo  → tableSyncDelete(dropTables) → trash; redo → restore (same id)
 *   - delete undo  → trashRestore (same id);       redo → re-trash
 *   - delete(dropTables) undo → trashRestore cascades the dest tables back id-stable
 *   - update (scalar) undo → macroUndo replays tableSyncConfigUpdate's inverse
 *   - update (field add/unselect) undo → macroUndo restores/drops the column id-stable
 *   - freeze undo  → tableSyncResume;              redo → tableSyncFreeze
 *   - resume undo  → tableSyncFreeze;              redo → tableSyncResume
 *
 * PG-only: table sync relies on custom links, unsupported on the MSSQL data DB.
 */

const TAB_ID = '33333333-3333-4333-8333-333333333333';

type Ctx = Awaited<ReturnType<typeof init>> & { tabId?: string };

export function tableSyncUndoRedoTests() {
  if (!isEE()) return;

  describe('Table Sync — command-registry undo/redo', () => {
    let context: Ctx;
    let workspaceId: string;
    let sourceBase: any;
    let destBase: any;
    let sourceTable: any;
    let sourceView: View;
    let destEnv: { workspaceId: string; baseId: string };

    /** Enable allow_sync on the source grid view (auto-shares it with a uuid).
     *  PATCH /api/v2/meta/views/:id is the canonical surface for this. */
    async function enableAllowSync(viewId: string) {
      await request(context.app)
        .patch(`/api/v2/meta/views/${viewId}`)
        .set('xc-auth', context.token)
        .send({ allow_sync: true })
        .expect(200);

      return View.get(
        { workspace_id: workspaceId, base_id: sourceBase.id },
        viewId,
      );
    }

    function syncBody(overrides: Record<string, any> = {}) {
      return {
        title: overrides.title ?? `Synced-${Date.now()}`,
        source_workspace_id: workspaceId,
        source_base_id: sourceBase.id,
        source_table_id: sourceTable.id,
        source_view_id: sourceView.id,
        ...overrides,
      };
    }

    // Sync contracts scope to the (dest) base — `scope: scopeBase(context)`.
    function baseScope() {
      return [{ type: 'base' as const, id: destBase.id }];
    }

    function undo() {
      return internalPost(
        context,
        destEnv,
        { operation: 'undo' },
        { scopes: baseScope() },
      );
    }

    function redo() {
      return internalPost(
        context,
        destEnv,
        { operation: 'redo' },
        { scopes: baseScope() },
      );
    }

    /** Top of the active per-tab stack within the dest-base scope — what
     *  `UndoRedoService.undo()` would consume. */
    function topLog() {
      return OperationLog.getLatestActive(
        { workspace_id: workspaceId, base_id: destBase.id },
        { fk_user_id: context.user.id, tab_id: TAB_ID, scopes: baseScope() },
      );
    }

    function getSync(id: string) {
      return TableSync.get(
        { workspace_id: workspaceId, base_id: destBase.id },
        id,
      );
    }

    /** True if the sync's main dest (mirror) table still exists (not trashed). */
    async function destTableExists(tableId: string): Promise<boolean> {
      const m = await Model.get(
        { workspace_id: workspaceId, base_id: destBase.id },
        tableId,
      ).catch(() => null);
      return !!m && !(m as any).deleted;
    }

    /** True if the sync's main dest table has a column titled `title`. */
    async function destHasColumn(
      syncId: string,
      title: string,
    ): Promise<boolean> {
      const sync = await getSync(syncId);
      const main = (sync?.mappings ?? []).find((m: any) => m.role === 'main');
      if (!main) return false;
      const destCtx = { workspace_id: workspaceId, base_id: destBase.id };
      const destModel = await Model.get(destCtx, main.dest_table_id).catch(
        () => null,
      );
      if (!destModel) return false;
      const cols = await destModel.getColumns(destCtx);
      return cols.some((c: any) => c.title === title);
    }

    beforeEach(async function () {
      this.timeout(120000);
      context = await init();
      // Table sync needs custom links — PG data DB only.
      if (!isPgData(context)) {
        this.skip();
      }
      workspaceId = context.fk_workspace_id!;

      sourceBase = await createProject(context, { title: 'URSyncSource' });
      destBase = await createProject(context, { title: 'URSyncDest' });
      destEnv = { workspaceId, baseId: destBase.id };

      sourceTable = await createTable(context, sourceBase, {
        table_name: 'Customers',
        title: 'Customers',
      });

      sourceView = await createView(context, {
        title: 'SyncFeed',
        table: sourceTable,
        type: ViewTypes.GRID,
      });

      sourceView = (await enableAllowSync(sourceView.id))!;
      expect(sourceView.allow_sync, 'allow_sync enabled').to.eq(true);
      expect(sourceView.uuid, 'view auto-shared').to.be.a('string');

      // Trace only the op under test — fixtures above must stay off the stack.
      context.tabId = TAB_ID;
    });

    it('tableSyncCreate → undo (delete) → redo (restore), id preserved', async function () {
      this.timeout(120000);
      const res = await tableSyncCreate(
        context,
        destEnv,
        syncBody({ title: 'CreateRT' }),
      ).expect(200);
      const syncId: string = res.body.id;
      await waitForSyncSettled(destEnv, syncId);

      expect(await getSync(syncId), 'sync exists after create').to.not.be.null;
      const row = await topLog();
      expect(row, 'log row recorded for create').to.exist;
      expect(row!.forward_op).to.equal('tableSyncCreate');
      expect(row!.entity_id).to.equal(syncId);
      expect(row!.status).to.equal('active');

      const u = await undo();
      expect(u.status, `undo HTTP: ${JSON.stringify(u.body)}`).to.eq(200);
      expect(u.body.status, 'undo result').to.equal('ok');
      expect(await getSync(syncId), 'sync trashed after undo').to.be.null;

      const r = await redo();
      expect(r.status, `redo HTTP: ${JSON.stringify(r.body)}`).to.eq(200);
      expect(r.body.status, 'redo result').to.equal('ok');
      await waitForSyncSettled(destEnv, syncId);
      const restored = await getSync(syncId);
      expect(restored, 'sync restored after redo').to.not.be.null;
      expect(restored!.id, 'sync id preserved across restore').to.equal(syncId);
    });

    it('tableSyncUpdate (title) → undo → redo', async function () {
      this.timeout(120000);
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({ title: 'Before' }),
      ).expect(200);
      const syncId: string = created.body.id;
      await waitForSyncSettled(destEnv, syncId);

      await tableSyncUpdate(context, destEnv, syncId, { title: 'After' }).expect(
        200,
      );
      expect((await getSync(syncId))!.title, 'title applied').to.equal('After');
      const row = await topLog();
      expect(row, 'log row recorded for update').to.exist;
      expect(row!.forward_op).to.equal('tableSyncUpdate');
      expect(row!.entity_id).to.equal(syncId);

      expect((await undo()).body.status, 'undo result').to.equal('ok');
      expect(
        (await getSync(syncId))!.title,
        'title reverted on undo',
      ).to.equal('Before');

      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expect(
        (await getSync(syncId))!.title,
        'title re-applied on redo',
      ).to.equal('After');
    });

    it('tableSyncDelete → undo (restore) → redo (delete), id preserved', async function () {
      this.timeout(120000);
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({ title: 'DeleteRT' }),
      ).expect(200);
      const syncId: string = created.body.id;
      const settled = await waitForSyncSettled(destEnv, syncId);

      // The keep-tables delete is the "convert to regular table" path for the
      // main dest table — its synced/readonly flags must flip with each leg.
      const main = (settled.mappings ?? []).find((m: any) => m.role === 'main');
      expect(main, 'main mapping exists').to.exist;
      const destTableId: string = main!.dest_table_id;
      const destCtx = { workspace_id: workspaceId, base_id: destBase.id };

      const beforeModel = await Model.get(destCtx, destTableId);
      expect(!!beforeModel!.synced, 'dest synced before delete').to.eq(true);

      await tableSyncDelete(context, destEnv, syncId).expect(200);
      expect(await getSync(syncId), 'sync trashed after delete').to.be.null;
      const row = await topLog();
      expect(row, 'log row recorded for delete').to.exist;
      expect(row!.forward_op).to.equal('tableSyncDelete');
      expect(row!.entity_id).to.equal(syncId);

      const afterDelete = await Model.get(destCtx, destTableId);
      expect(!!afterDelete!.synced, 'dest un-synced after delete').to.eq(false);
      const afterDeleteCols = await afterDelete!.getColumns(destCtx);
      expect(
        afterDeleteCols.some((c: any) => c.readonly),
        'no readonly cols after delete',
      ).to.eq(false);

      expect((await undo()).body.status, 'undo result').to.equal('ok');
      await waitForSyncSettled(destEnv, syncId);
      const restored = await getSync(syncId);
      expect(restored, 'sync restored on undo').to.not.be.null;
      expect(restored!.id, 'id preserved across restore').to.equal(syncId);

      const afterUndo = await Model.get(destCtx, destTableId);
      expect(!!afterUndo!.synced, 'dest synced again on undo').to.eq(true);

      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expect(await getSync(syncId), 'sync trashed again on redo').to.be.null;

      const afterRedo = await Model.get(destCtx, destTableId);
      expect(!!afterRedo!.synced, 'dest un-synced again on redo').to.eq(false);
    });

    it('tableSyncFreeze → undo (resume) → redo (freeze)', async function () {
      this.timeout(120000);
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({ title: 'FreezeRT' }),
      ).expect(200);
      const syncId: string = created.body.id;
      await waitForSyncSettled(destEnv, syncId);

      await tableSyncFreeze(context, destEnv, syncId).expect(200);
      expect((await getSync(syncId))!.status, 'paused after freeze').to.equal(
        TableSyncStatus.Paused,
      );
      const row = await topLog();
      expect(row, 'log row recorded for freeze').to.exist;
      expect(row!.forward_op).to.equal('tableSyncFreeze');

      // Undo = resume → re-enqueues a resync job. Let it settle so the redo
      // (freeze) isn't overwritten by a late job completion flipping to Active.
      expect((await undo()).body.status, 'undo result').to.equal('ok');
      await waitForSyncSettled(destEnv, syncId);
      expect(
        (await getSync(syncId))!.status,
        'not paused after resume',
      ).to.not.equal(TableSyncStatus.Paused);

      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expect(
        (await getSync(syncId))!.status,
        'paused again after redo freeze',
      ).to.equal(TableSyncStatus.Paused);
    });

    it('tableSyncResume → undo (freeze) → redo (resume)', async function () {
      this.timeout(120000);
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({ title: 'ResumeRT' }),
      ).expect(200);
      const syncId: string = created.body.id;
      await waitForSyncSettled(destEnv, syncId);
      // Pause first (untraced) so resume is the op under test.
      await tableSyncFreeze(untracedCtx(context), destEnv, syncId).expect(200);
      expect(
        (await getSync(syncId))!.status,
        'paused before resume',
      ).to.equal(TableSyncStatus.Paused);

      await tableSyncResume(context, destEnv, syncId).expect(200);
      await waitForSyncSettled(destEnv, syncId);
      expect(
        (await getSync(syncId))!.status,
        'not paused after resume',
      ).to.not.equal(TableSyncStatus.Paused);
      const row = await topLog();
      expect(row, 'log row recorded for resume').to.exist;
      expect(row!.forward_op).to.equal('tableSyncResume');

      expect((await undo()).body.status, 'undo result').to.equal('ok');
      expect(
        (await getSync(syncId))!.status,
        'paused after undo (freeze)',
      ).to.equal(TableSyncStatus.Paused);

      expect((await redo()).body.status, 'redo result').to.equal('ok');
      await waitForSyncSettled(destEnv, syncId);
      expect(
        (await getSync(syncId))!.status,
        'not paused after redo (resume)',
      ).to.not.equal(TableSyncStatus.Paused);
    });

    it('tableSyncDelete(dropTables) → undo restores tables (id-stable) → redo', async function () {
      this.timeout(120000);
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({ title: 'DropTablesRT' }),
      ).expect(200);
      const syncId: string = created.body.id;
      const settled = await waitForSyncSettled(destEnv, syncId);
      const main = (settled.mappings ?? []).find((m: any) => m.role === 'main');
      const destTableId: string = main!.dest_table_id;
      expect(await destTableExists(destTableId), 'dest table exists').to.eq(true);

      await tableSyncDelete(context, destEnv, syncId, {
        dropTables: true,
      }).expect(200);
      expect(await getSync(syncId), 'sync trashed').to.be.null;
      expect(
        await destTableExists(destTableId),
        'dest table trashed alongside sync',
      ).to.eq(false);
      const row = await topLog();
      expect(row, 'log row recorded for delete(dropTables)').to.exist;
      expect(row!.forward_op).to.equal('tableSyncDelete');

      // Undo = trashRestore → cascade-restores the dest tables, id preserved.
      expect((await undo()).body.status, 'undo result').to.equal('ok');
      const restored = await getSync(syncId);
      expect(restored, 'sync restored on undo').to.not.be.null;
      expect(restored!.id, 'sync id preserved').to.equal(syncId);
      expect(
        await destTableExists(destTableId),
        'dest table restored id-stable',
      ).to.eq(true);

      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expect(await getSync(syncId), 'sync trashed again on redo').to.be.null;
      expect(
        await destTableExists(destTableId),
        'dest table trashed again on redo',
      ).to.eq(false);
    });

    it('tableSyncUpdate (unselect field) → undo restores the column (id-stable) → redo', async function () {
      this.timeout(120000);
      // A non-PV source column gives us a field to unselect.
      await createColumn(untracedCtx(context), sourceTable, {
        title: 'Notes',
        column_name: 'Notes',
        uidt: UITypes.SingleLineText,
      });
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({ title: 'UnselectRT' }),
      ).expect(200);
      const syncId: string = created.body.id;
      await waitForSyncSettled(destEnv, syncId);
      expect(
        await destHasColumn(syncId, 'Notes'),
        'Notes mirrored on initial sync',
      ).to.eq(true);

      // selected_fields = [] keeps only the PV → Notes is unselected (dropped).
      await tableSyncUpdate(context, destEnv, syncId, {
        selected_fields: [],
      }).expect(200);
      await waitForSyncSettled(destEnv, syncId);
      expect(
        await destHasColumn(syncId, 'Notes'),
        'Notes dropped after unselect',
      ).to.eq(false);
      const row = await topLog();
      expect(row, 'log row recorded for update').to.exist;
      expect(row!.forward_op).to.equal('tableSyncUpdate');
      expect(row!.entity_id).to.equal(syncId);

      // Undo replays the macro: columnDelete's inverse (trash-restore) brings the
      // dropped column back id-stable, and the glue op rebuilds its mapping.
      expect((await undo()).body.status, 'undo result').to.equal('ok');
      expect(
        await destHasColumn(syncId, 'Notes'),
        'Notes restored on undo',
      ).to.eq(true);

      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expect(
        await destHasColumn(syncId, 'Notes'),
        'Notes dropped again on redo',
      ).to.eq(false);
    });

    it('tableSyncUpdate (select field) → undo drops the column → redo re-adds (id-stable)', async function () {
      this.timeout(120000);
      await createColumn(untracedCtx(context), sourceTable, {
        title: 'Notes',
        column_name: 'Notes',
        uidt: UITypes.SingleLineText,
      });
      // Start with Notes unselected (selected_fields = [] → PV only).
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({ title: 'SelectRT', selected_fields: [] }),
      ).expect(200);
      const syncId: string = created.body.id;
      await waitForSyncSettled(destEnv, syncId);
      expect(
        await destHasColumn(syncId, 'Notes'),
        'Notes not mirrored while unselected',
      ).to.eq(false);

      // Select Notes → a dest column is added (columnAdd).
      await tableSyncUpdate(context, destEnv, syncId, {
        selected_fields: ['Notes'],
      }).expect(200);
      await waitForSyncSettled(destEnv, syncId);
      expect(
        await destHasColumn(syncId, 'Notes'),
        'Notes added after select',
      ).to.eq(true);
      const row = await topLog();
      expect(row!.forward_op).to.equal('tableSyncUpdate');

      expect((await undo()).body.status, 'undo result').to.equal('ok');
      expect(
        await destHasColumn(syncId, 'Notes'),
        'Notes dropped on undo',
      ).to.eq(false);

      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expect(
        await destHasColumn(syncId, 'Notes'),
        'Notes re-added on redo',
      ).to.eq(true);
    });

    // ─────────────────────────── MM-LTAR field cases ───────────────────────
    // A picked `link_view_by_column` turns a source LTAR into a *real* dest
    // relation: a LinkedShadow mirror table + an MM junction. Tearing that
    // back down (unselect the field, or drop the picked view) cascades several
    // columnDeletes through `removeSyncedField`; rebuilding it goes through
    // `addSyncedField`. These cases lock in that the macro reverses/redoes the
    // whole shadow+junction cluster id-stable, not just a flat column.

    interface LtarFx {
      ordersTable: Model;
      ltarTitle: string;
      mainViewId: string;
      ordersViewId: string;
    }

    /** Build a Customers ⇄ Orders MM relation on the source, plus a fresh
     *  sync-enabled main view that includes the new LTAR column and a
     *  sync-enabled view on the linked Orders table. All untraced. */
    async function setupLtarSource(): Promise<LtarFx> {
      const ordersTable = await createTable(untracedCtx(context), sourceBase, {
        table_name: 'Orders',
        title: 'Orders',
      });
      const ltarTitle = 'Orders';
      await createLtarColumn2(untracedCtx(context), {
        title: ltarTitle,
        parentTable: sourceTable,
        childTable: ordersTable,
        type: 'mm',
      });

      // Reload so the new LTAR column is visible, then build a fresh main view
      // that includes it (the beforeEach view predates the LTAR column).
      const ltarSource = (await Model.getWithInfo(
        { workspace_id: workspaceId, base_id: sourceBase.id },
        { id: sourceTable.id },
      ))!;
      let mainView = await createView(untracedCtx(context), {
        title: `LtarFeed-${Date.now()}`,
        table: ltarSource,
        type: ViewTypes.GRID,
      });
      mainView = (await enableAllowSync(mainView.id))!;

      const ordersView = await createView(untracedCtx(context), {
        title: 'OrdersFeed',
        table: ordersTable,
        type: ViewTypes.GRID,
      });
      await enableAllowSync(ordersView.id);

      return {
        ordersTable,
        ltarTitle,
        mainViewId: mainView.id,
        ordersViewId: ordersView.id,
      };
    }

    /** True if the sync has a LinkedShadow mapping (the materialised mirror of
     *  a picked linked view) — the schema-level signal that the MM relation is
     *  live on the dest. */
    function syncHasShadow(sync: TableSync | null): boolean {
      return (sync?.mappings ?? []).some(
        (m: any) => m.role === 'linked_shadow',
      );
    }

    it('tableSyncUpdate (unselect MM-LTAR field) → undo restores shadow+junction (id-stable) → redo', async function () {
      this.timeout(120000);
      const fx = await setupLtarSource();

      // Create the sync WITH the LTAR selected + a picked linked view → this
      // materialises a LinkedShadow mapping + an MM junction on the dest.
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({
          title: 'LtarUnselectRT',
          source_view_id: fx.mainViewId,
          selected_fields: ['Title', fx.ltarTitle],
          link_view_by_column: { [fx.ltarTitle]: fx.ordersViewId },
        }),
      ).expect(200);
      const syncId: string = created.body.id;
      const settled = await waitForSyncSettled(destEnv, syncId);
      expect(syncHasShadow(settled), 'shadow mapping created').to.eq(true);
      expect(
        await destHasColumn(syncId, fx.ltarTitle),
        'LTAR mirrored on main dest',
      ).to.eq(true);

      // Unselect the LTAR → removeSyncedField cascades the junction + shadow
      // teardown.
      await tableSyncUpdate(context, destEnv, syncId, {
        selected_fields: ['Title'],
      }).expect(200);
      await waitForSyncSettled(destEnv, syncId);
      expect(
        syncHasShadow((await getSync(syncId))!),
        'shadow gone after unselect',
      ).to.eq(false);
      const row = await topLog();
      expect(row!.forward_op).to.equal('tableSyncUpdate');

      // Undo → macroUndo restores the dropped columns id-stable and the glue
      // op rebuilds the LinkedShadow mapping.
      expect((await undo()).body.status, 'undo result').to.equal('ok');
      expect(
        syncHasShadow((await getSync(syncId))!),
        'shadow restored on undo',
      ).to.eq(true);
      expect(
        await destHasColumn(syncId, fx.ltarTitle),
        'LTAR restored on main dest',
      ).to.eq(true);

      // Redo → tears the MM relation back down.
      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expect(
        syncHasShadow((await getSync(syncId))!),
        'shadow gone again on redo',
      ).to.eq(false);
    });

    it('tableSyncUpdate (select MM-LTAR field + picked view) → undo tears down shadow+junction → redo rebuilds (id-stable)', async function () {
      this.timeout(120000);
      const fx = await setupLtarSource();

      // Start with only the PV synced — no LTAR, no shadow.
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({
          title: 'LtarSelectRT',
          source_view_id: fx.mainViewId,
          selected_fields: ['Title'],
        }),
      ).expect(200);
      const syncId: string = created.body.id;
      const settled = await waitForSyncSettled(destEnv, syncId);
      expect(syncHasShadow(settled), 'no shadow before select').to.eq(false);

      // Select the LTAR AND pick its linked view → builds shadow + junction.
      await tableSyncUpdate(context, destEnv, syncId, {
        selected_fields: ['Title', fx.ltarTitle],
        link_view_by_column: { [fx.ltarTitle]: fx.ordersViewId },
      }).expect(200);
      await waitForSyncSettled(destEnv, syncId);
      expect(
        syncHasShadow((await getSync(syncId))!),
        'shadow created after select',
      ).to.eq(true);
      const row = await topLog();
      expect(row!.forward_op).to.equal('tableSyncUpdate');

      // Undo → drops the freshly-built shadow/junction/LTAR cluster.
      expect((await undo()).body.status, 'undo result').to.equal('ok');
      expect(
        syncHasShadow((await getSync(syncId))!),
        'shadow gone on undo',
      ).to.eq(false);

      // Redo → rebuilds the MM relation.
      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expect(
        syncHasShadow((await getSync(syncId))!),
        'shadow rebuilt on redo',
      ).to.eq(true);
    });

    it('tableSyncUpdate (remove MM-LTAR picked view → flatten) → undo restores relation (id-stable) → redo', async function () {
      this.timeout(120000);
      const fx = await setupLtarSource();

      // Create WITH the picked view → proper relation + shadow + junction.
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({
          title: 'UnpickRT',
          source_view_id: fx.mainViewId,
          selected_fields: ['Title', fx.ltarTitle],
          link_view_by_column: { [fx.ltarTitle]: fx.ordersViewId },
        }),
      ).expect(200);
      const syncId: string = created.body.id;
      const settled = await waitForSyncSettled(destEnv, syncId);
      expect(syncHasShadow(settled), 'shadow exists initially').to.eq(true);

      // Remove the picked view (field stays selected) → the proper relation
      // flattens to a text column: removeSyncedField tears down the
      // shadow/junction, addSyncedField writes the flat column.
      await tableSyncUpdate(context, destEnv, syncId, {
        selected_fields: ['Title', fx.ltarTitle],
        link_view_by_column: {},
      }).expect(200);
      await waitForSyncSettled(destEnv, syncId);
      expect(
        syncHasShadow((await getSync(syncId))!),
        'shadow gone after flatten',
      ).to.eq(false);
      const row = await topLog();
      expect(row!.forward_op).to.equal('tableSyncUpdate');

      // Undo → restores the proper relation (shadow+junction back id-stable).
      expect((await undo()).body.status, 'undo result').to.equal('ok');
      expect(
        syncHasShadow((await getSync(syncId))!),
        'shadow restored on undo',
      ).to.eq(true);

      // Redo → flattens again.
      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expect(
        syncHasShadow((await getSync(syncId))!),
        'shadow gone again on redo',
      ).to.eq(false);
    });

    it('tableSyncUpdate (source_view rebind) → undo reverts the source view → redo', async function () {
      this.timeout(120000);
      // A second sync-enabled grid view on the SAME source table.
      let altView = await createView(untracedCtx(context), {
        title: `AltFeed-${Date.now()}`,
        table: sourceTable,
        type: ViewTypes.GRID,
      });
      altView = (await enableAllowSync(altView.id))!;

      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({ title: 'RebindRT' }),
      ).expect(200);
      const syncId: string = created.body.id;
      await waitForSyncSettled(destEnv, syncId);

      const mainSourceView = (s: TableSync | null) =>
        (s?.mappings ?? []).find((m: any) => m.role === 'main')?.source_view_id;
      expect(
        mainSourceView(await getSync(syncId)),
        'bound to original view',
      ).to.equal(sourceView.id);

      // Re-bind to the alternate view (same source table).
      await tableSyncUpdate(context, destEnv, syncId, {
        source_view_id: altView.id,
      }).expect(200);
      await waitForSyncSettled(destEnv, syncId);
      expect(
        mainSourceView(await getSync(syncId)),
        'rebound to alt view',
      ).to.equal(altView.id);
      const row = await topLog();
      expect(row!.forward_op).to.equal('tableSyncUpdate');

      // Undo → the glue op restores the prior mapping snapshot (original view)
      // AND re-triggers a full resync so the dest DATA matches the restored
      // view — otherwise the rows from `altView` would linger. The resync runs
      // as an async job: normally we catch it mid-flight (`Syncing` — the glue
      // flips it before enqueuing), but on a fast run it can settle before the
      // read, in which case a bumped `last_synced_at` equally proves the
      // resync fired (the processor stamps it on completion).
      function expectResyncFired(
        sync: TableSync,
        syncedAtBefore: string | null,
        label: string,
      ) {
        expect(
          sync.status === TableSyncStatus.Syncing ||
            (sync.status === TableSyncStatus.Active &&
              sync.last_synced_at !== syncedAtBefore),
          `${label} (status: ${sync.status}, last_synced_at: ${sync.last_synced_at} vs ${syncedAtBefore})`,
        ).to.eq(true);
      }

      const syncedAtBeforeUndo = (await getSync(syncId))!.last_synced_at;
      expect((await undo()).body.status, 'undo result').to.equal('ok');
      expectResyncFired(
        (await getSync(syncId))!,
        syncedAtBeforeUndo,
        'undo re-triggered a resync',
      );
      await waitForSyncSettled(destEnv, syncId);
      expect(
        mainSourceView(await getSync(syncId)),
        'source view reverted on undo',
      ).to.equal(sourceView.id);

      // Redo → rebinds to the alt view again, resyncing once more.
      const syncedAtBeforeRedo = (await getSync(syncId))!.last_synced_at;
      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expectResyncFired(
        (await getSync(syncId))!,
        syncedAtBeforeRedo,
        'redo re-triggered a resync',
      );
      await waitForSyncSettled(destEnv, syncId);
      expect(
        mainSourceView(await getSync(syncId)),
        'source view rebound on redo',
      ).to.equal(altView.id);
    });

    it('tableSyncUpdate (sync_trigger + on_delete_action scalars) → undo reverts → redo', async function () {
      this.timeout(120000);
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({ title: 'ScalarRT' }),
      ).expect(200);
      const syncId: string = created.body.id;
      await waitForSyncSettled(destEnv, syncId);
      const before = await getSync(syncId);
      expect(before!.sync_trigger, 'default trigger').to.equal(
        TableSyncTrigger.Realtime,
      );
      expect(before!.on_delete_action, 'default on_delete').to.equal(
        TableSyncOnDeleteAction.MarkDeleted,
      );

      await tableSyncUpdate(context, destEnv, syncId, {
        sync_trigger: TableSyncTrigger.Manual,
        on_delete_action: TableSyncOnDeleteAction.Delete,
      }).expect(200);
      let s = await getSync(syncId);
      expect(s!.sync_trigger, 'trigger applied').to.equal(
        TableSyncTrigger.Manual,
      );
      expect(s!.on_delete_action, 'on_delete applied').to.equal(
        TableSyncOnDeleteAction.Delete,
      );

      expect((await undo()).body.status, 'undo result').to.equal('ok');
      s = await getSync(syncId);
      expect(s!.sync_trigger, 'trigger reverted').to.equal(
        TableSyncTrigger.Realtime,
      );
      expect(s!.on_delete_action, 'on_delete reverted').to.equal(
        TableSyncOnDeleteAction.MarkDeleted,
      );

      expect((await redo()).body.status, 'redo result').to.equal('ok');
      s = await getSync(syncId);
      expect(s!.sync_trigger, 'trigger re-applied').to.equal(
        TableSyncTrigger.Manual,
      );
      expect(s!.on_delete_action, 'on_delete re-applied').to.equal(
        TableSyncOnDeleteAction.Delete,
      );
    });

    // ── Per-table detach ("convert to regular table" on shadow/junction) ──

    it('tableSyncDetachTable (shadow) → undo (re-attach, mapping rebuilt) → redo', async function () {
      this.timeout(120000);
      const fx = await setupLtarSource();

      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({
          title: 'ShadowDetachRT',
          source_view_id: fx.mainViewId,
          selected_fields: ['Title', fx.ltarTitle],
          link_view_by_column: { [fx.ltarTitle]: fx.ordersViewId },
        }),
      ).expect(200);
      const syncId: string = created.body.id;
      const settled = await waitForSyncSettled(destEnv, syncId);

      const shadow = (settled.mappings ?? []).find(
        (m: any) => m.role === 'linked_shadow',
      );
      expect(shadow, 'shadow mapping exists').to.exist;
      const shadowTableId: string = shadow!.dest_table_id;
      const mappingCountBefore = (settled.mappings ?? []).length;
      const destCtx = { workspace_id: workspaceId, base_id: destBase.id };

      // The MAIN dest table can't go through the per-table detach — its
      // convert drops the sync itself (tableSyncDelete keep-tables).
      const main = (settled.mappings ?? []).find((m: any) => m.role === 'main');
      await internalPost(
        untracedCtx(context),
        destEnv,
        { operation: 'tableSyncDetachTable' },
        { modelId: main!.dest_table_id },
      ).expect(400);

      const beforeModel = await Model.get(destCtx, shadowTableId);
      expect(!!beforeModel!.synced, 'shadow synced before detach').to.eq(true);
      const beforeCols = await beforeModel!.getColumns(destCtx);
      const readonlyBefore = beforeCols.filter((c: any) => c.readonly).length;
      expect(readonlyBefore, 'shadow has readonly cols').to.be.gte(1);

      // Detach the shadow — drops its mapping, converts the table; the rest
      // of the sync keeps running.
      await internalPost(
        context,
        destEnv,
        { operation: 'tableSyncDetachTable' },
        { modelId: shadowTableId },
      ).expect(200);

      const afterDetach = await getSync(syncId);
      expect(
        (afterDetach!.mappings ?? []).some(
          (m: any) => m.dest_table_id === shadowTableId,
        ),
        'shadow mapping dropped from the sync config',
      ).to.eq(false);
      // The junction routing to the shadow cascades with it — the whole field
      // cluster (incl. the link-view pick riding the shadow mapping) leaves.
      expect(
        (afterDetach!.mappings ?? []).some((m: any) => m.role === 'junction'),
        'junction mapping cascades out with the shadow',
      ).to.eq(false);
      expect((afterDetach!.mappings ?? []).length).to.eq(
        mappingCountBefore - 2,
      );
      expect(
        afterDetach!.selected_fields,
        'LTAR field dropped from selected_fields',
      ).to.not.include(fx.ltarTitle);

      const detachedModel = await Model.get(destCtx, shadowTableId);
      expect(!!detachedModel!.synced, 'shadow un-synced').to.eq(false);
      const detachedCols = await detachedModel!.getColumns(destCtx);
      expect(
        detachedCols.some((c: any) => c.readonly),
        'no readonly cols after detach',
      ).to.eq(false);

      const row = await topLog();
      expect(row!.forward_op).to.equal('tableSyncDetachTable');
      expect(row!.entity_id).to.equal(shadowTableId);

      // Undo → mapping re-inserted, table re-flagged synced/readonly.
      expect((await undo()).body.status, 'undo result').to.equal('ok');
      const afterUndo = await getSync(syncId);
      const restoredMapping = (afterUndo!.mappings ?? []).find(
        (m: any) => m.dest_table_id === shadowTableId,
      );
      expect(restoredMapping, 'shadow mapping restored on undo').to.exist;
      expect(restoredMapping!.role).to.eq('linked_shadow');
      expect(
        (afterUndo!.mappings ?? []).some((m: any) => m.role === 'junction'),
        'junction mapping restored on undo',
      ).to.eq(true);
      expect((afterUndo!.mappings ?? []).length).to.eq(mappingCountBefore);
      expect(
        afterUndo!.selected_fields,
        'LTAR field back in selected_fields on undo',
      ).to.include(fx.ltarTitle);
      const restoredModel = await Model.get(destCtx, shadowTableId);
      expect(!!restoredModel!.synced, 'shadow synced again on undo').to.eq(
        true,
      );
      const restoredCols = await restoredModel!.getColumns(destCtx);
      expect(
        restoredCols.filter((c: any) => c.readonly).length,
        'readonly cols restored on undo',
      ).to.eq(readonlyBefore);

      // Redo → detached again.
      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expect(
        ((await getSync(syncId))!.mappings ?? []).some(
          (m: any) => m.dest_table_id === shadowTableId,
        ),
        'mapping dropped again on redo',
      ).to.eq(false);
      const redoneModel = await Model.get(destCtx, shadowTableId);
      expect(!!redoneModel!.synced, 'shadow regular again on redo').to.eq(
        false,
      );

      // Now a regular table — deleting it directly is allowed.
      await internalPost(untracedCtx(context), destEnv, {
        operation: 'tableDelete',
        tableId: shadowTableId,
      }).expect(200);
    });

    it('tableSyncDetachTable (junction) → links handed over → undo re-locks → redo', async function () {
      this.timeout(120000);
      const fx = await setupLtarSource();

      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({
          title: 'JunctionDetachRT',
          source_view_id: fx.mainViewId,
          selected_fields: ['Title', fx.ltarTitle],
          link_view_by_column: { [fx.ltarTitle]: fx.ordersViewId },
        }),
      ).expect(200);
      const syncId: string = created.body.id;
      const settled = await waitForSyncSettled(destEnv, syncId);

      const junction = (settled.mappings ?? []).find(
        (m: any) => m.role === 'junction',
      );
      expect(junction, 'junction mapping exists').to.exist;
      const junctionTableId: string = junction!.dest_table_id;
      const main = (settled.mappings ?? []).find((m: any) => m.role === 'main');
      const mainTableId: string = main!.dest_table_id;
      const destCtx = { workspace_id: workspaceId, base_id: destBase.id };

      /** The mirrored LTAR column on the main dest table. */
      async function mainLtarCol() {
        const mainModel = await Model.get(destCtx, mainTableId);
        const cols = await mainModel!.getColumns(destCtx);
        return cols.find((c: any) => c.title === fx.ltarTitle);
      }

      expect(
        (await mainLtarCol())!.readonly,
        'main LTAR readonly before detach',
      ).to.eq(true);

      // Detach the junction — the LINKS hand over with it: the junction's FK
      // columns and the main mirror's LTAR column all become editable.
      await internalPost(
        context,
        destEnv,
        { operation: 'tableSyncDetachTable' },
        { modelId: junctionTableId },
      ).expect(200);

      const afterDetach = await getSync(syncId);
      expect(
        (afterDetach!.mappings ?? []).some(
          (m: any) => m.dest_table_id === junctionTableId,
        ),
        'junction mapping dropped',
      ).to.eq(false);
      // The shadow only existed for this link — it cascades out with the
      // junction, taking the link-view pick (its source_view_id) along.
      expect(
        (afterDetach!.mappings ?? []).some(
          (m: any) => m.role === 'linked_shadow',
        ),
        'shadow mapping cascades out with the junction',
      ).to.eq(false);
      expect(
        afterDetach!.selected_fields,
        'LTAR field dropped from selected_fields',
      ).to.not.include(fx.ltarTitle);

      const junctionModel = await Model.get(destCtx, junctionTableId);
      expect(!!junctionModel!.synced, 'junction un-synced').to.eq(false);
      const junctionCols = await junctionModel!.getColumns(destCtx);
      expect(
        junctionCols.some((c: any) => c.readonly),
        'junction FK cols editable after detach',
      ).to.eq(false);
      expect(
        !!(await mainLtarCol())!.readonly,
        'main LTAR editable after detach',
      ).to.eq(false);

      // Undo → mapping back, junction + LTAR re-locked.
      expect((await undo()).body.status, 'undo result').to.equal('ok');
      const afterUndo = await getSync(syncId);
      const restoredMapping = (afterUndo!.mappings ?? []).find(
        (m: any) => m.dest_table_id === junctionTableId,
      );
      expect(restoredMapping, 'junction mapping restored on undo').to.exist;
      expect(restoredMapping!.role).to.eq('junction');
      expect(
        (afterUndo!.mappings ?? []).some(
          (m: any) => m.role === 'linked_shadow',
        ),
        'shadow mapping restored on undo',
      ).to.eq(true);
      expect(
        afterUndo!.selected_fields,
        'LTAR field back in selected_fields on undo',
      ).to.include(fx.ltarTitle);
      expect(
        !!(await Model.get(destCtx, junctionTableId))!.synced,
        'junction synced again on undo',
      ).to.eq(true);
      expect(
        (await mainLtarCol())!.readonly,
        'main LTAR re-locked on undo',
      ).to.eq(true);

      // Redo → handed over again.
      expect((await redo()).body.status, 'redo result').to.equal('ok');
      expect(
        !!(await Model.get(destCtx, junctionTableId))!.synced,
        'junction regular again on redo',
      ).to.eq(false);
      expect(
        !!(await mainLtarCol())!.readonly,
        'main LTAR editable again on redo',
      ).to.eq(false);
    });

    // Manual counterpart to the convert flows: the user tries to trash a
    // synced dest table directly (Trash UI / tableDelete). Synced tables
    // never enter trash — the delete is blocked with a "convert it first"
    // error and the table + its mapping stay untouched.
    it('deleting a synced dest table directly is blocked until detached', async function () {
      this.timeout(120000);
      const created = await tableSyncCreate(
        untracedCtx(context),
        destEnv,
        syncBody({ title: 'BlockedDelete' }),
      ).expect(200);
      const syncId: string = created.body.id;
      await waitForSyncSettled(destEnv, syncId);

      const sync = await getSync(syncId);
      const main = (sync!.mappings ?? []).find((m: any) => m.role === 'main');
      expect(main, 'main mapping exists').to.exist;
      const destTableId: string = main!.dest_table_id;

      // Synced dest tables never enter trash — deleting one directly is
      // blocked until it's converted to a regular table (for table sync:
      // delete the sync keeping the table).
      await internalPost(untracedCtx(context), destEnv, {
        operation: 'tableDelete',
        tableId: destTableId,
      }).expect(400);

      expect(
        await destTableExists(destTableId),
        'dest table still live after blocked delete',
      ).to.eq(true);
      const after = await getSync(syncId);
      expect(
        (after!.mappings ?? []).find((m: any) => m.role === 'main'),
        'mapping untouched by the blocked delete',
      ).to.exist;
    });
  });
}
