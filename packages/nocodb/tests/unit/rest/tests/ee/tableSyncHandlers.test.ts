import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import sinon from 'sinon';
import { TableSyncStatus, UITypes, ViewTypes } from 'nocodb-sdk';
import init from '~test/init';
import { isEE } from '~test/utils/helpers';
import { createProject } from '~test/factory/base';
import { createTable } from '~test/factory/table';
import { createView } from '~test/factory/view';
import {
  createColumn,
  createLtarColumn2,
  deleteColumn,
  updateColumn,
} from '~test/factory/column';
import { createRow } from '~test/factory/row';
import {
  tableSyncCreate,
  tableSyncResume,
  tableSyncUpdate,
  waitForSyncSettled,
} from '~test/factory/tableSync';
import { internalPost } from '~test/factory/internal';
import View from '~/models/View';
import Model from '~/models/Model';
import TableSync from '~/models/TableSync';
import { TableSyncService } from '~/modules/table-sync/table-sync.service';

/**
 * Table Sync — reactive meta-dependency handlers
 *
 * Each test triggers a source-side meta event (column add / rename / type
 * change / delete, view revoke, table delete) via the REST API and asserts
 * the dest-side reaction. Goes through the real Nest event-handler chain,
 * not direct handler invocation — catches DI regressions and source-side
 * emit gaps too.
 *
 * Handlers are detached (`void doWork().catch(log)`), so we wait for the
 * effect to settle by polling either the dest meta state or the sync row.
 */
function tableSyncHandlerTests() {
  if (!isEE()) {
    return;
  }

  describe('Table Sync — meta-dependency handlers', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let workspaceId: string;
    let sourceBase: any;
    let destBase: any;
    let sourceTable: Model;
    let sourceView: View;
    let destEnv: { workspaceId: string; baseId: string };

    async function enableAllowSync(viewId: string, baseId: string) {
      await request(context.app)
        .patch(`/api/v2/meta/views/${viewId}`)
        .set('xc-auth', context.token)
        .send({ allow_sync: true })
        .expect(200);
      return View.get({ workspace_id: workspaceId, base_id: baseId }, viewId);
    }

    function mainDestTableId(sync: TableSync): string {
      const main = (sync.mappings ?? []).find((m: any) => m.role === 'main');
      expect(main, 'main mapping should exist').to.exist;
      return main!.dest_table_id;
    }

    async function loadDestModel(dest_table_id: string): Promise<Model> {
      const m = await Model.get(
        { workspace_id: workspaceId, base_id: destBase.id },
        dest_table_id,
      );
      expect(m, `dest model ${dest_table_id} should exist`).to.exist;
      return m!;
    }

    /**
     * Handlers run detached (`void doWork().catch(log)`), so the source-side
     * REST call returns before the dest-side reaction has finished. Poll
     * until the predicate returns truthy or the deadline hits.
     */
    async function waitFor<T>(
      label: string,
      poll: () => Promise<T | null | undefined | false>,
      { timeoutMs = 10_000, pollMs = 100 } = {},
    ): Promise<T> {
      const deadline = Date.now() + timeoutMs;
      let last: T | null | undefined | false = null;
      while (Date.now() < deadline) {
        last = await poll();
        if (last) return last as T;
        await new Promise((r) => setTimeout(r, pollMs));
      }
      throw new Error(`waitFor(${label}) timed out after ${timeoutMs}ms`);
    }

    async function getDestCol(destTableId: string, title: string) {
      const destTable = await loadDestModel(destTableId);
      const cols = await destTable.getColumns({
        workspace_id: workspaceId,
        base_id: destBase.id,
      });
      return cols.find((c) => c.title === title);
    }

    beforeEach(async function () {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      sourceBase = await createProject(context, { title: 'HandlerSyncSource' });
      destBase = await createProject(context, { title: 'HandlerSyncDest' });
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
      sourceView = (await enableAllowSync(sourceView.id, sourceBase.id))!;
    });

    describe('column-change handler', () => {
      /**
       * Source rename should NOT change the dest column title. The column-
       * mapping table (TableSyncColumnMapping) is keyed by source/dest column
       * IDs, not titles, so a rename is invisible to the sync — exactly the
       * Airtable behaviour we're matching.
       */
      it('source column rename is a no-op on dest (id-based matching survives)', async () => {
        await createColumn(context, sourceTable, {
          title: 'Note',
          uidt: UITypes.SingleLineText,
        });

        const created = await tableSyncCreate(context, destEnv, {
          title: 'RenameSurvival',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTableId = mainDestTableId(settled);

        // Confirm dest has "Note" column to start.
        expect(await getDestCol(destTableId, 'Note')).to.exist;

        // Rename source col.
        const refreshedSource = await Model.getWithInfo(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          { id: sourceTable.id },
        );
        const noteCol = refreshedSource!.columns!.find((c) => c.title === 'Note');
        await updateColumn(context, {
          table: sourceTable,
          column: noteCol as any,
          attr: { title: 'Notes' },
        });

        // The dest col title should NOT change — id-based matching means
        // the dest keeps its original "Note" title. A short poll-and-confirm
        // catches the case where the handler accidentally renamed it.
        await new Promise((r) => setTimeout(r, 800));
        expect(
          await getDestCol(destTableId, 'Note'),
          'dest col should keep its original title',
        ).to.exist;
        expect(
          await getDestCol(destTableId, 'Notes'),
          'dest col title should NOT be updated on source rename',
        ).to.not.exist;
      });

      /**
       * Source uidt change must propagate to the dest. Pre-fix, the dest
       * column update was silently dropped by the synced-readonly guard in
       * `columnsService._runColumnUpdate`. The handler now passes
       * `bypassSyncedFieldGuard: true` so the retype actually applies.
       */
      it('source column uidt change propagates to dest (bypasses synced guard)', async () => {
        await createColumn(context, sourceTable, {
          title: 'Place',
          uidt: UITypes.GeoData,
        });

        const created = await tableSyncCreate(context, destEnv, {
          title: 'UidtPropagate',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTableId = mainDestTableId(settled);

        // Confirm initial uidt on dest.
        const initialDestCol = await getDestCol(destTableId, 'Place');
        expect(initialDestCol).to.exist;
        expect(initialDestCol!.uidt).to.eq(UITypes.GeoData);

        // Change source col GeoData → SingleLineText.
        const refreshedSource = await Model.getWithInfo(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          { id: sourceTable.id },
        );
        const placeCol = refreshedSource!.columns!.find(
          (c) => c.title === 'Place',
        );
        await updateColumn(context, {
          table: sourceTable,
          column: placeCol as any,
          attr: { uidt: UITypes.SingleLineText },
        });

        // Poll the dest col until its uidt flips to SLT.
        await waitFor('dest col uidt to flip', async () => {
          const col = await getDestCol(destTableId, 'Place');
          return col?.uidt === UITypes.SingleLineText ? col : null;
        });
      });

      /**
       * Source column deletion should cascade — drop the dest col and strip
       * its title from `selected_fields` so the next reconcile doesn't
       * accidentally re-add it as a SLT placeholder.
       */
      it('source column delete drops dest col and strips selected_fields entry', async () => {
        await createColumn(context, sourceTable, {
          title: 'Note',
          uidt: UITypes.SingleLineText,
        });

        const created = await tableSyncCreate(context, destEnv, {
          title: 'DropOnSourceDelete',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', 'Note'],
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTableId = mainDestTableId(settled);
        expect(await getDestCol(destTableId, 'Note')).to.exist;

        // Drop source col.
        const refreshedSource = await Model.getWithInfo(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          { id: sourceTable.id },
        );
        const noteCol = refreshedSource!.columns!.find((c) => c.title === 'Note');
        await deleteColumn(context, {
          table: sourceTable,
          column: noteCol as any,
        });

        // Dest col should disappear.
        await waitFor('dest col to be dropped', async () => {
          const col = await getDestCol(destTableId, 'Note');
          return col ? false : (true as any);
        });

        // selected_fields should no longer contain "Note".
        await waitFor('selected_fields stripped', async () => {
          const sync = await TableSync.get(
            { workspace_id: workspaceId, base_id: destBase.id },
            created.body.id,
          );
          const sel = sync?.selected_fields as string[] | null;
          return Array.isArray(sel) && !sel.includes('Note') ? sync : null;
        });
      });
    });

    describe('column-add handler', () => {
      /**
       * sync-all mode (`selected_fields === null`) should auto-mirror new
       * source columns into the dest schema. Specific-fields syncs are
       * user-managed and don't auto-add.
       */
      it('new source col in sync-all mode is auto-added to dest', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'AutoAddAllFields',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          // selected_fields omitted → sync-all mode.
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTableId = mainDestTableId(settled);
        expect(await getDestCol(destTableId, 'NewCol')).to.not.exist;

        // Add a new source col.
        await createColumn(context, sourceTable, {
          title: 'NewCol',
          uidt: UITypes.SingleLineText,
        });

        // Dest schema should grow.
        await waitFor('dest col to be auto-added', async () => {
          const col = await getDestCol(destTableId, 'NewCol');
          return col ?? null;
        });
      });

      /**
       * Specific-fields mode (`selected_fields` is an array) is user-managed —
       * adding a source col should NOT auto-mirror to dest. Only when the
       * user explicitly updates `selected_fields` does the new col land.
       */
      it('new source col in specific-fields mode is NOT auto-added', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'SpecificFieldsNoAutoAdd',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title'],
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTableId = mainDestTableId(settled);

        await createColumn(context, sourceTable, {
          title: 'UnrequestedCol',
          uidt: UITypes.SingleLineText,
        });

        // Give the handler ~600ms to do nothing.
        await new Promise((r) => setTimeout(r, 800));

        expect(
          await getDestCol(destTableId, 'UnrequestedCol'),
          'specific-fields mode should not auto-add new source col',
        ).to.not.exist;
      });

      /**
       * LTAR column added on source AFTER sync creation, in sync-all mode.
       * Until very recently `COLUMN_ADDED` was never emitted by columnsService,
       * so the handler was dead code. Now that the event fires for both
       * regular and LTAR cols, an LTAR added later should auto-mirror as
       * SLT placeholder (no shadow — no view is picked at add time).
       */
      it('LTAR added on source in sync-all mode auto-mirrors as SLT placeholder', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'LtarAutoAddAllFields',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTableId = mainDestTableId(settled);

        // Create a sibling table + add an LTAR to source — the column-add
        // handler should pick this up.
        const ordersTable = await createTable(context, sourceBase, {
          table_name: 'Orders',
          title: 'Orders',
        });
        await createLtarColumn2(context, {
          title: 'OrderLinks',
          parentTable: sourceTable,
          childTable: ordersTable,
          type: 'mm',
        });

        // Dest schema should grow with the new LTAR field rendered as SLT.
        const destLtarCol = await waitFor(
          'LTAR auto-mirrored on dest as SLT placeholder',
          async () => {
            const col = await getDestCol(destTableId, 'OrderLinks');
            return col ?? null;
          },
        );
        // Sync-all + no view picked → SLT, not a real LTAR.
        expect(destLtarCol.uidt).to.eq(UITypes.SingleLineText);

        // No LinkedShadow mapping should be created — no view to mirror yet.
        const refreshed = await TableSync.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          created.body.id,
        );
        const shadows = (refreshed?.mappings ?? []).filter(
          (m: any) => m.role === 'linked_shadow',
        );
        expect(shadows, 'no shadow until a view is picked').to.have.lengthOf(0);
      });

      /**
       * Regression: `columnAdd` used to emit COLUMN_ADDED twice for an MM
       * LTAR's forward column (once in `createLTARColumn`, once in the
       * generic post-switch path). Both events drove a detached
       * `reconcileFields`, and the loser of the race hit `duplicateAlias`.
       * The forward column must now fire COLUMN_ADDED exactly once, so the
       * sync handler reconciles exactly once.
       */
      it('MM LTAR add triggers exactly one reconcile (no duplicate COLUMN_ADDED)', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'LtarSingleReconcile',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          // selected_fields omitted → sync-all mode.
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTableId = mainDestTableId(settled);

        // Spy only AFTER the initial sync settles, so we count just the
        // reconcile triggered by the LTAR add below.
        const svc = context.nestApp.get(TableSyncService, { strict: false });
        const reconcileSpy = sinon.spy(svc, 'reconcileFields');

        try {
          const ordersTable = await createTable(context, sourceBase, {
            table_name: 'Orders',
            title: 'Orders',
          });
          await createLtarColumn2(context, {
            title: 'OrderLinks',
            parentTable: sourceTable,
            childTable: ordersTable,
            type: 'mm',
          });

          await waitFor('LTAR auto-mirrored on dest', async () => {
            const col = await getDestCol(destTableId, 'OrderLinks');
            return col ?? null;
          });

          // Settle window for any erroneous second reconcile to fire.
          await new Promise((r) => setTimeout(r, 750));

          expect(
            reconcileSpy.callCount,
            'forward MM LTAR add should reconcile exactly once',
          ).to.eq(1);
        } finally {
          reconcileSpy.restore();
        }
      });
    });

    describe('view-change handler', () => {
      /**
       * Revoking `allow_sync` on the source view must flip the sync to Error.
       * Without this gate, the processor would keep mirroring from a view
       * the source owner no longer wants exposed.
       */
      it('disabling allow_sync on source view flips sync to Error', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'AllowSyncRevoke',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        expect(settled.status).to.eq(TableSyncStatus.Active);

        // Disable allow_sync on the source view.
        await request(context.app)
          .patch(`/api/v2/meta/views/${sourceView.id}`)
          .set('xc-auth', context.token)
          .send({ allow_sync: false })
          .expect(200);

        // The sync should flip to Error with a descriptive reason.
        const errored = await waitFor('sync flipped to Error', async () => {
          const s = await TableSync.get(
            { workspace_id: workspaceId, base_id: destBase.id },
            created.body.id,
          );
          return s?.status === TableSyncStatus.Error ? s : null;
        });
        expect(errored.last_error).to.be.a('string');
        expect(errored.last_error!.toLowerCase()).to.match(/allow.?sync/);
      });

      /**
       * Clearing the share UUID on the source view (i.e. un-sharing) should
       * also flip the sync to Error — uuid is one of the three revoke
       * conditions the handler watches for (allow_sync, uuid, password).
       */
      it('clearing source-view UUID flips sync to Error', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'UuidCleared',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);
        await waitForSyncSettled(destEnv, created.body.id);

        // Un-share via the dedicated share-delete endpoint. This clears
        // `uuid` (and disables `allow_sync` if it was on), then emits the
        // VIEW_UPDATED meta-dep event the view-change handler listens for.
        await request(context.app)
          .delete(`/api/v2/meta/views/${sourceView.id}/share`)
          .set('xc-auth', context.token)
          .expect(200);

        const errored = await waitFor('sync flipped to Error on uuid clear', async () => {
          const s = await TableSync.get(
            { workspace_id: workspaceId, base_id: destBase.id },
            created.body.id,
          );
          return s?.status === TableSyncStatus.Error ? s : null;
        });
        expect(errored.last_error).to.be.a('string');
      });
    });

    describe('table-delete handler', () => {
      /**
       * Deleting the source main table breaks the sync structurally — the
       * dest schema is tied to it. Handler flips the sync to Error with a
       * descriptive reason so the user can choose to drop the sync (with or
       * without dropping the dest tables).
       */
      it('deleting source main table flips sync to Error', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'SourceTableDeleted',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        expect(settled.status).to.eq(TableSyncStatus.Active);

        // Delete the source table.
        await request(context.app)
          .delete(`/api/v2/meta/tables/${sourceTable.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        const errored = await waitFor('sync flipped to Error after source table delete', async () => {
          const s = await TableSync.get(
            { workspace_id: workspaceId, base_id: destBase.id },
            created.body.id,
          );
          return s?.status === TableSyncStatus.Error ? s : null;
        });
        expect(errored.last_error).to.be.a('string');
        expect(errored.last_error!.toLowerCase()).to.match(/delete|deleted/);
      });

      /**
       * Deleting a LinkedShadow's source table is a soft fallback — the
       * sync stays Active, the LTAR on main is dropped (cascading the
       * junction), the shadow table is unsynced (Model.updateSynced=false,
       * readonly→false on cols), and the LinkedShadow mapping is removed.
       *
       * Regression: pre-fix, the junction-drop step failed with a
       * "many to many table for undefined" error because
       * `tablesService.tableDelete` unconditionally throws on M2M tables
       * even with `forceDeleteSyncs`. Now `forceDeleteSyncs: true` also
       * bypasses the M2M guard.
       */
      it('deleting LinkedShadow source unsyncs shadow + drops LTAR, sync stays Active', async () => {
        // Source: Customers ⇄ Orders LTAR.
        const ordersTable = await createTable(context, sourceBase, {
          table_name: 'Orders',
          title: 'Orders',
        });
        await createLtarColumn2(context, {
          title: 'OrderLinks',
          parentTable: sourceTable,
          childTable: ordersTable,
          type: 'mm',
        });
        const ordersView = await createView(context, {
          title: 'OrdersFeed',
          table: ordersTable,
          type: ViewTypes.GRID,
        });
        await enableAllowSync(ordersView.id, sourceBase.id);

        // Rebuild source view since the LTAR was added after the original.
        sourceView = await createView(context, {
          title: `CustFeed-${Date.now()}`,
          table: sourceTable,
          type: ViewTypes.GRID,
        });
        sourceView = (await enableAllowSync(sourceView.id, sourceBase.id))!;

        // A couple of source rows so the sync has data.
        await createRow(context, { base: sourceBase, table: sourceTable, index: 0 });
        await createRow(context, { base: sourceBase, table: ordersTable, index: 0 });

        const created = await tableSyncCreate(context, destEnv, {
          title: 'LinkedShadowDelete',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', 'OrderLinks'],
          link_view_by_column: { OrderLinks: ordersView.id },
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        expect(settled.status).to.eq(TableSyncStatus.Active);

        const shadow = (settled.mappings ?? []).find(
          (m: any) => m.role === 'linked_shadow',
        );
        expect(shadow, 'shadow mapping should exist after sync create').to.exist;
        const shadowDestTableId = shadow!.dest_table_id;
        const mainDest = mainDestTableId(settled);
        expect(await getDestCol(mainDest, 'OrderLinks')).to.exist;

        // Now delete the linked source table — this is the trigger.
        await request(context.app)
          .delete(`/api/v2/meta/tables/${ordersTable.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        // (a) Sync stays Active (NOT flipped to Error).
        await new Promise((r) => setTimeout(r, 1500));
        const stillActive = await TableSync.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          created.body.id,
        );
        expect(
          stillActive?.status,
          'sync should stay Active when only a linked shadow source is deleted',
        ).to.eq(TableSyncStatus.Active);

        // (b) The LTAR column on main should be gone.
        await waitFor('LTAR dropped from main dest', async () => {
          const col = await getDestCol(mainDest, 'OrderLinks');
          return col ? false : (true as any);
        });

        // (c) The LinkedShadow mapping should be removed from the sync.
        const afterMappings = (stillActive?.mappings ?? []).filter(
          (m: any) =>
            m.role === 'linked_shadow' && m.dest_table_id === shadowDestTableId,
        );
        expect(
          afterMappings,
          'LinkedShadow mapping should be removed',
        ).to.have.lengthOf(0);

        // (d) The shadow dest table should still exist (converted, not dropped).
        const shadowModel = await Model.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          shadowDestTableId,
        );
        expect(
          shadowModel,
          'shadow dest table should be kept (just unsynced)',
        ).to.exist;
        expect(
          shadowModel!.synced,
          'shadow should be flipped to non-synced',
        ).to.not.eq(true);
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // LTAR LIFECYCLE
    // ──────────────────────────────────────────────────────────────────
    //
    // A sync's LTAR dest column has two shapes:
    //   - **placeholder (SLT)**: no view picked → SingleLineText with
    //     comma-joined PV text. No shadow table.
    //   - **proper (shadow)**: a linked-view is picked → shadow table +
    //     junction (MM) + real LTAR on main.
    //
    // The transitions between them, plus what happens when something
    // upstream goes wrong (view deleted, share revoked, LTAR col
    // deleted), all flow through `reconcileFields` / view-change
    // / column-change / table-delete handlers. This block walks the
    // matrix.
    describe('LTAR lifecycle', () => {
      let ordersTable: Model;
      let ordersView: View;
      const LTAR_TITLE = 'OrderLinks';

      async function setupLtarSource() {
        ordersTable = await createTable(context, sourceBase, {
          table_name: 'Orders',
          title: 'Orders',
        });
        await createLtarColumn2(context, {
          title: LTAR_TITLE,
          parentTable: sourceTable,
          childTable: ordersTable,
          type: 'mm',
        });

        // Recreate source view so the new LTAR col is visible from the start.
        sourceView = await createView(context, {
          title: `CustFeed-${Date.now()}`,
          table: sourceTable,
          type: ViewTypes.GRID,
        });
        sourceView = (await enableAllowSync(sourceView.id, sourceBase.id))!;

        // Linked view for the Orders table — sync-enabled.
        ordersView = await createView(context, {
          title: 'OrdersFeed',
          table: ordersTable,
          type: ViewTypes.GRID,
        });
        await enableAllowSync(ordersView.id, sourceBase.id);

        // A bit of source data so the LTAR has rows to flatten / shadow.
        const c0 = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });
        const o0 = await createRow(context, {
          base: sourceBase,
          table: ordersTable,
          index: 0,
        });
        const o1 = await createRow(context, {
          base: sourceBase,
          table: ordersTable,
          index: 1,
        });
        // Link c0 → [o0, o1] via V3 link endpoint.
        const refreshed = await Model.getWithInfo(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          { id: sourceTable.id },
        );
        const ltarCol = refreshed!.columns!.find((c) => c.title === LTAR_TITLE);
        await request(context.app)
          .post(
            `/api/v3/data/${sourceBase.id}/${sourceTable.id}/links/${ltarCol!.id}/${c0.Id}`,
          )
          .set('xc-auth', context.token)
          .send([{ id: o0.Id }, { id: o1.Id }])
          .expect(200);
      }

      async function shadowMapping(syncId: string) {
        const s = await TableSync.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          syncId,
        );
        return (s?.mappings ?? []).find(
          (m: any) => m.role === 'linked_shadow',
        );
      }

      /**
       * No view picked at create time → LTAR comes through as a flat
       * SingleLineText. There should be no shadow mapping at all.
       */
      it('LTAR with no picked view → SLT placeholder, no shadow', async () => {
        await setupLtarSource();

        const created = await tableSyncCreate(context, destEnv, {
          title: 'LtarNoView',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', LTAR_TITLE],
          // link_view_by_column omitted on purpose
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);

        const shadows = (settled.mappings ?? []).filter(
          (m: any) => m.role === 'linked_shadow',
        );
        expect(shadows, 'no shadow when no linked view is picked').to.have
          .lengthOf(0);

        const destCol = await getDestCol(
          mainDestTableId(settled),
          LTAR_TITLE,
        );
        expect(destCol).to.exist;
        expect(destCol!.uidt).to.eq(UITypes.SingleLineText);
      });

      /**
       * SLT placeholder → proper shadow when the user picks a view via
       * updateSync. This is the path the user originally hit; we tested
       * the data-fill side earlier (`tableSyncData.test.ts`), here we
       * focus on the schema transition.
       */
      it('LTAR SLT → shadow when a linked view is picked via updateSync', async () => {
        await setupLtarSource();

        const created = await tableSyncCreate(context, destEnv, {
          title: 'LtarSLTtoShadow',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', LTAR_TITLE],
        }).expect(200);
        await waitForSyncSettled(destEnv, created.body.id);
        expect(
          await shadowMapping(created.body.id),
          'no shadow before picking a view',
        ).to.eq(undefined);

        await tableSyncUpdate(context, destEnv, created.body.id, {
          selected_fields: ['Title', LTAR_TITLE],
          link_view_by_column: { [LTAR_TITLE]: ordersView.id },
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);

        const shadow = (settled.mappings ?? []).find(
          (m: any) => m.role === 'linked_shadow',
        );
        expect(shadow, 'shadow mapping should now exist').to.exist;

        const destCol = await getDestCol(
          mainDestTableId(settled),
          LTAR_TITLE,
        );
        expect(destCol).to.exist;
        // After the transition, dest LTAR is a real LinkToAnotherRecord —
        // NOT the SLT placeholder it was before.
        expect(destCol!.uidt).to.eq(UITypes.LinkToAnotherRecord);
      });

      /**
       * Inverse transition: shadow → SLT when the user removes the linked
       * view from `link_view_by_column` via updateSync. Tears down the
       * shadow + junction and replaces the dest LTAR with a SLT placeholder.
       */
      it('LTAR shadow → SLT placeholder when linked view is removed via updateSync', async () => {
        await setupLtarSource();

        const created = await tableSyncCreate(context, destEnv, {
          title: 'LtarShadowToSLT',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', LTAR_TITLE],
          link_view_by_column: { [LTAR_TITLE]: ordersView.id },
        }).expect(200);
        const initial = await waitForSyncSettled(destEnv, created.body.id);
        const shadowDestTableId = (initial.mappings ?? []).find(
          (m: any) => m.role === 'linked_shadow',
        )!.dest_table_id;

        // Drop the picked view by sending an empty link_view_by_column map.
        await tableSyncUpdate(context, destEnv, created.body.id, {
          selected_fields: ['Title', LTAR_TITLE],
          link_view_by_column: {},
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);

        const shadows = (settled.mappings ?? []).filter(
          (m: any) => m.role === 'linked_shadow',
        );
        expect(
          shadows,
          'shadow mapping should be torn down',
        ).to.have.lengthOf(0);

        // Shadow dest table itself should be gone.
        const shadowModel = await Model.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          shadowDestTableId,
        );
        expect(shadowModel, 'shadow dest table should be dropped').to.not.exist;

        // Main dest's LTAR col should be back to SLT placeholder.
        const destCol = await getDestCol(
          mainDestTableId(settled),
          LTAR_TITLE,
        );
        expect(destCol).to.exist;
        expect(destCol!.uidt).to.eq(UITypes.SingleLineText);
      });

      /**
       * Removing the LTAR title from `selected_fields` should drop the
       * dest LTAR column entirely — plus the shadow + junction if a view
       * was picked.
       */
      it('removing LTAR from selected_fields drops dest LTAR + shadow + junction', async () => {
        await setupLtarSource();

        const created = await tableSyncCreate(context, destEnv, {
          title: 'LtarRemoveFromSelected',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', LTAR_TITLE],
          link_view_by_column: { [LTAR_TITLE]: ordersView.id },
        }).expect(200);
        const initial = await waitForSyncSettled(destEnv, created.body.id);
        const shadowDestTableId = (initial.mappings ?? []).find(
          (m: any) => m.role === 'linked_shadow',
        )!.dest_table_id;
        const junctionDestTableId = (initial.mappings ?? []).find(
          (m: any) => m.role === 'junction',
        )!.dest_table_id;

        await tableSyncUpdate(context, destEnv, created.body.id, {
          selected_fields: ['Title'],
          // Drop the LTAR pick along with the field itself.
          link_view_by_column: {},
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);

        // Dest LTAR col is gone.
        expect(
          await getDestCol(mainDestTableId(settled), LTAR_TITLE),
          'dest LTAR col should be dropped',
        ).to.not.exist;

        // Shadow + junction mappings AND tables gone.
        expect(
          (settled.mappings ?? []).some(
            (m: any) => m.role === 'linked_shadow',
          ),
        ).to.eq(false);
        expect(
          (settled.mappings ?? []).some((m: any) => m.role === 'junction'),
        ).to.eq(false);

        const shadow = await Model.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          shadowDestTableId,
        );
        const junction = await Model.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          junctionDestTableId,
        );
        expect(shadow, 'shadow dest table should be dropped').to.not.exist;
        expect(junction, 'junction dest table should be dropped').to.not.exist;
      });

      /**
       * Revoke condition on the LINKED view (not the main). The view-change
       * handler walks every mapping for the changed view — so revoking
       * allow_sync on the linked view should also flip the sync to Error.
       */
      it('linked view allow_sync revoked → sync flips to Error', async () => {
        await setupLtarSource();

        const created = await tableSyncCreate(context, destEnv, {
          title: 'LinkedAllowSyncRevoke',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', LTAR_TITLE],
          link_view_by_column: { [LTAR_TITLE]: ordersView.id },
        }).expect(200);
        await waitForSyncSettled(destEnv, created.body.id);

        // Disable allow_sync on the LINKED view.
        await request(context.app)
          .patch(`/api/v2/meta/views/${ordersView.id}`)
          .set('xc-auth', context.token)
          .send({ allow_sync: false })
          .expect(200);

        const errored = await waitFor(
          'sync flipped to Error on linked view allow_sync revoke',
          async () => {
            const s = await TableSync.get(
              { workspace_id: workspaceId, base_id: destBase.id },
              created.body.id,
            );
            return s?.status === TableSyncStatus.Error ? s : null;
          },
        );
        expect(errored.last_error).to.be.a('string');
      });

      /**
       * Clearing the share UUID on the LINKED view: same revoke path,
       * different condition. The handler checks (allow_sync, uuid,
       * password hash) on each fire.
       */
      it('linked view uuid cleared → sync flips to Error', async () => {
        await setupLtarSource();

        const created = await tableSyncCreate(context, destEnv, {
          title: 'LinkedUuidCleared',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', LTAR_TITLE],
          link_view_by_column: { [LTAR_TITLE]: ordersView.id },
        }).expect(200);
        await waitForSyncSettled(destEnv, created.body.id);

        await request(context.app)
          .delete(`/api/v2/meta/views/${ordersView.id}/share`)
          .set('xc-auth', context.token)
          .expect(200);

        await waitFor(
          'sync flipped to Error on linked view uuid clear',
          async () => {
            const s = await TableSync.get(
              { workspace_id: workspaceId, base_id: destBase.id },
              created.body.id,
            );
            return s?.status === TableSyncStatus.Error ? s : null;
          },
        );
      });

      /**
       * Deleting the LINKED VIEW fires the new `VIEW_DELETED` meta event,
       * which the view-change handler catches and flips the sync to Error
       * with a "view deleted" reason. No manual resync needed.
       */
      it('linked view deleted → sync flips to Error reactively', async () => {
        await setupLtarSource();

        const created = await tableSyncCreate(context, destEnv, {
          title: 'LinkedViewDeleted',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', LTAR_TITLE],
          link_view_by_column: { [LTAR_TITLE]: ordersView.id },
        }).expect(200);
        await waitForSyncSettled(destEnv, created.body.id);

        await request(context.app)
          .delete(`/api/v2/meta/views/${ordersView.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        const errored = await waitFor(
          'sync flipped to Error after linked view delete',
          async () => {
            const s = await TableSync.get(
              { workspace_id: workspaceId, base_id: destBase.id },
              created.body.id,
            );
            return s?.status === TableSyncStatus.Error ? s : null;
          },
        );
        expect(errored.last_error).to.be.a('string');
        expect(errored.last_error!.toLowerCase()).to.match(/delete|deleted/);
      });

      /**
       * Deleting the MAIN source view: same `VIEW_DELETED` reactive flow.
       * No manual resync needed.
       */
      it('main view deleted → sync flips to Error reactively', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'MainViewDeleted',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);
        await waitForSyncSettled(destEnv, created.body.id);

        // Need a second grid view to exist before deleting the synced one —
        // `viewDelete` refuses to drop the LAST collaborative grid view.
        await createView(context, {
          title: 'OtherGrid',
          table: sourceTable,
          type: ViewTypes.GRID,
        });

        await request(context.app)
          .delete(`/api/v2/meta/views/${sourceView.id}`)
          .set('xc-auth', context.token)
          .expect(200);

        const errored = await waitFor(
          'sync flipped to Error after main view delete',
          async () => {
            const s = await TableSync.get(
              { workspace_id: workspaceId, base_id: destBase.id },
              created.body.id,
            );
            return s?.status === TableSyncStatus.Error ? s : null;
          },
        );
        expect(errored.last_error).to.be.a('string');
        expect(errored.last_error!.toLowerCase()).to.match(/delete|deleted/);
      });

      /**
       * Dropping the LTAR column on the source — column-change handler
       * sees `COLUMN_DELETED` and runs `removeSyncedField` to cascade
       * (drop dest LTAR + junction; shadow ref-counted, dropped iff no
       * other LTAR references it).
       */
      it('source LTAR column deleted → dest LTAR + junction + shadow dropped', async () => {
        await setupLtarSource();

        const created = await tableSyncCreate(context, destEnv, {
          title: 'LtarSourceColDeleted',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', LTAR_TITLE],
          link_view_by_column: { [LTAR_TITLE]: ordersView.id },
        }).expect(200);
        const initial = await waitForSyncSettled(destEnv, created.body.id);
        const shadowDestTableId = (initial.mappings ?? []).find(
          (m: any) => m.role === 'linked_shadow',
        )!.dest_table_id;

        // Drop the source LTAR column.
        const refreshedSource = await Model.getWithInfo(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          { id: sourceTable.id },
        );
        const ltarSrc = refreshedSource!.columns!.find(
          (c) => c.title === LTAR_TITLE,
        );
        await deleteColumn(context, {
          table: sourceTable,
          column: ltarSrc as any,
        });

        // Cascade: dest LTAR drops, shadow drops (no other LTARs reference it).
        await waitFor('dest LTAR dropped after source delete', async () => {
          const col = await getDestCol(
            mainDestTableId(initial),
            LTAR_TITLE,
          );
          return col ? false : (true as any);
        });
        await waitFor('shadow dest table dropped after source LTAR delete', async () => {
          const shadow = await Model.get(
            { workspace_id: workspaceId, base_id: destBase.id },
            shadowDestTableId,
          );
          return shadow ? false : (true as any);
        });
      });

      /**
       * Two LTARs from main → same linked table → both share ONE shadow.
       * removeSyncedField is ref-counted: dropping one LTAR leaves the
       * shadow alive (still referenced by the other LTAR); dropping the
       * second LTAR finally drops the shadow.
       */
      it('multiple LTARs sharing one shadow → shadow is ref-counted', async () => {
        await setupLtarSource();

        // Add a SECOND LTAR from Customers → Orders.
        await createLtarColumn2(context, {
          title: 'OtherOrderLinks',
          parentTable: sourceTable,
          childTable: ordersTable,
          type: 'mm',
        });

        // Recreate the source view so the new LTAR is visible.
        sourceView = await createView(context, {
          title: `MultiLtarFeed-${Date.now()}`,
          table: sourceTable,
          type: ViewTypes.GRID,
        });
        sourceView = (await enableAllowSync(sourceView.id, sourceBase.id))!;

        const created = await tableSyncCreate(context, destEnv, {
          title: 'MultiLtarShadow',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', LTAR_TITLE, 'OtherOrderLinks'],
          link_view_by_column: {
            [LTAR_TITLE]: ordersView.id,
            OtherOrderLinks: ordersView.id,
          },
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);

        // Both LTARs should reference the SAME shadow.
        const shadowMappings = (settled.mappings ?? []).filter(
          (m: any) => m.role === 'linked_shadow',
        );
        expect(
          shadowMappings,
          'two LTARs to the same linked table → one shadow mapping',
        ).to.have.lengthOf(1);
        const shadowDestTableId = shadowMappings[0].dest_table_id;

        // Drop the FIRST source LTAR. Cascade should drop only that LTAR
        // and its junction; shadow stays.
        const refreshed1 = await Model.getWithInfo(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          { id: sourceTable.id },
        );
        const firstLtar = refreshed1!.columns!.find(
          (c) => c.title === LTAR_TITLE,
        );
        await deleteColumn(context, {
          table: sourceTable,
          column: firstLtar as any,
        });

        await waitFor('first dest LTAR dropped', async () => {
          const col = await getDestCol(mainDestTableId(settled), LTAR_TITLE);
          return col ? false : (true as any);
        });

        // Shadow must STILL exist — second LTAR still references it.
        const shadowAfterFirstDrop = await Model.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          shadowDestTableId,
        );
        expect(
          shadowAfterFirstDrop,
          'shadow should still exist while a second LTAR references it',
        ).to.exist;
        expect(
          await getDestCol(mainDestTableId(settled), 'OtherOrderLinks'),
          'second LTAR should still be on dest',
        ).to.exist;

        // Drop the SECOND source LTAR — now the shadow should go.
        const refreshed2 = await Model.getWithInfo(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          { id: sourceTable.id },
        );
        const secondLtar = refreshed2!.columns!.find(
          (c) => c.title === 'OtherOrderLinks',
        );
        await deleteColumn(context, {
          table: sourceTable,
          column: secondLtar as any,
        });

        await waitFor('shadow dropped after the last LTAR removed', async () => {
          const shadow = await Model.get(
            { workspace_id: workspaceId, base_id: destBase.id },
            shadowDestTableId,
          );
          return shadow ? false : (true as any);
        });
      });

      /**
       * A filter change on the source view triggers a debounced full
       * resync via the filter-change handler. Verifies that the sync
       * eventually reflects the new filter — rows that no longer match
       * are tombstoned (or removed, per on_delete_action).
       *
       * Slow test: 5s debounce + processor run + tombstone sweep, so
       * we give it 60s.
       */
      it('source view filter change triggers a resync that reflects the filter', async () => {
        // Build a fresh sourceTable with a `Status` column we can filter on.
        await createColumn(context, sourceTable, {
          title: 'Status',
          uidt: UITypes.SingleLineText,
        });
        await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });
        const r1 = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 1,
        });
        // Set Status on row 1 so we can filter to "only Active".
        await request(context.app)
          .patch(`/api/v1/db/data/noco/${sourceBase.id}/${sourceTable.id}/${r1.Id}`)
          .set('xc-auth', context.token)
          .send({ Status: 'Active' })
          .expect(200);

        const created = await tableSyncCreate(context, destEnv, {
          title: 'FilterChangeResync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTable = await loadDestModel(mainDestTableId(settled));

        // Both rows are mirrored initially.
        const initialDestRows = await request(context.app)
          .get(`/api/v1/db/data/noco/${destBase.id}/${destTable.id}`)
          .set('xc-auth', context.token)
          .expect(200);
        expect(initialDestRows.body.list.length).to.eq(2);

        // Add a filter to the source view: Status = 'Active'.
        const statusCol = (
          await sourceTable.getColumns({
            workspace_id: workspaceId,
            base_id: sourceBase.id,
          })
        ).find((c) => c.title === 'Status');
        await request(context.app)
          .post(`/api/v1/db/meta/views/${sourceView.id}/filters`)
          .set('xc-auth', context.token)
          .send({
            fk_column_id: statusCol!.id,
            comparison_op: 'eq',
            value: 'Active',
            logical_op: 'and',
          })
          .expect(200);

        // The filter-change handler enqueues a debounced (5s) full-resync.
        // Eventually the dest should reflect: only 1 row visible (after
        // tombstone sweep), or 1 active + 1 tombstoned depending on
        // on_delete_action (defaults to MarkDeleted → tombstoned, still
        // appears in raw list with RemoteDeleted=true).
        await waitFor(
          'dest reflects new filter after debounced resync',
          async () => {
            const res = await request(context.app)
              .get(`/api/v1/db/data/noco/${destBase.id}/${destTable.id}`)
              .set('xc-auth', context.token);
            const active = (res.body.list ?? []).filter(
              (r: any) => !r.RemoteDeleted,
            );
            return active.length === 1 ? res.body.list : null;
          },
          { timeoutMs: 60_000, pollMs: 500 },
        );
      });

      /**
       * Source-side link teardown → placeholder parity.
       *
       * Deleting the reverse link on the linked (shadow-source) table tears
       * down the relation; NocoDB leaves a `_nc_ph_*` SingleLineText
       * placeholder (with comma-joined display values) on the MAIN source
       * table, titled like the deleted link. The sync must keep that field —
       * as a plain text column carrying the same values — not drop it.
       * (See ColumnChangeTableSyncHandler.applyDelete placeholder branch.)
       */
      it('source-side link delete: main-source placeholder syncs to dest as text', async () => {
        await setupLtarSource();

        const created = await tableSyncCreate(context, destEnv, {
          title: 'SourceLinkDeletePlaceholder',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', LTAR_TITLE],
          link_view_by_column: { [LTAR_TITLE]: ordersView.id },
        }).expect(200);
        const initial = await waitForSyncSettled(destEnv, created.body.id);
        const mainDest = mainDestTableId(initial);
        expect(
          await getDestCol(mainDest, LTAR_TITLE),
          'dest LTAR should exist initially',
        ).to.exist;
        expect(
          await shadowMapping(created.body.id),
          'shadow should exist initially',
        ).to.exist;

        // Find + delete the reverse LTAR on Orders (points back to Customers).
        const ordersModel = await Model.getWithInfo(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          { id: ordersTable.id },
        );
        await ordersModel!.getColumns({
          workspace_id: workspaceId,
          base_id: sourceBase.id,
        });
        let reverseCol: any;
        for (const c of ordersModel!.columns ?? []) {
          if (
            c.uidt !== UITypes.LinkToAnotherRecord &&
            c.uidt !== UITypes.Links
          ) {
            continue;
          }
          const opt: any = await (c as any).getColOptions({
            workspace_id: workspaceId,
            base_id: sourceBase.id,
          });
          if (opt?.fk_related_model_id === sourceTable.id) {
            reverseCol = c;
            break;
          }
        }
        expect(reverseCol, 'reverse LTAR on Orders should exist').to.exist;

        await deleteColumn(context, {
          table: ordersTable,
          column: reverseCol,
        });

        // Sanity: the MAIN SOURCE now carries a placeholder SLT titled LTAR_TITLE.
        await waitFor('main-source placeholder column created', async () => {
          const m = await Model.getWithInfo(
            { workspace_id: workspaceId, base_id: sourceBase.id },
            { id: sourceTable.id },
          );
          await m!.getColumns({
            workspace_id: workspaceId,
            base_id: sourceBase.id,
          });
          const col = (m!.columns ?? []).find(
            (c) => c.title === LTAR_TITLE && c.uidt === UITypes.SingleLineText,
          );
          return col ?? null;
        });

        // The detached handler should re-derive the field as a dest SLT col.
        await waitFor('dest field re-derived as SingleLineText', async () => {
          const col = await getDestCol(mainDest, LTAR_TITLE);
          return col?.uidt === UITypes.SingleLineText ? col : null;
        });

        // Force a deterministic resync to fill the values, then assert parity.
        await internalPost(context, destEnv, {
          operation: 'tableSyncResync',
          tableSyncId: created.body.id,
        });
        await waitForSyncSettled(destEnv, created.body.id);

        // (a) dest keeps the field as a SingleLineText placeholder column.
        const destCol = await getDestCol(mainDest, LTAR_TITLE);
        expect(destCol, 'dest should keep the field').to.exist;
        expect(destCol!.uidt).to.eq(UITypes.SingleLineText);

        // (b) the title stays in selected_fields (not stripped).
        const reloaded = await TableSync.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          created.body.id,
        );
        expect(
          (reloaded?.selected_fields as string[] | null) ?? [],
          'LTAR title should remain selected',
        ).to.include(LTAR_TITLE);

        // (c) the shadow is gone — it's plain text now, no relation.
        expect(
          await shadowMapping(created.body.id),
          'shadow should be torn down',
        ).to.eq(undefined);

        // (d) values mirror the source placeholder (comma-joined order PVs).
        const srcRows = await request(context.app)
          .get(`/api/v1/db/data/noco/${sourceBase.id}/${sourceTable.id}`)
          .set('xc-auth', context.token)
          .expect(200);
        const destRows = await request(context.app)
          .get(`/api/v1/db/data/noco/${destBase.id}/${mainDest}`)
          .set('xc-auth', context.token)
          .expect(200);
        const srcVal = String(srcRows.body.list?.[0]?.[LTAR_TITLE] ?? '');
        const destVal = String(destRows.body.list?.[0]?.[LTAR_TITLE] ?? '');
        expect(srcVal, 'source placeholder should carry order titles').to.match(
          /test-0|test-1/,
        );
        expect(destVal, 'dest text value should mirror the source placeholder').to.eq(
          srcVal,
        );
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // RESUME / RECOVERY
    // ──────────────────────────────────────────────────────────────────
    describe('resume recovery', () => {
      /**
       * The full recovery loop: a sync flipped to Error by an allow_sync
       * revoke should come back to life when the source re-enables sharing
       * and the user hits resume — status returns to Active and the stale
       * last_error is cleared. The processor re-validates allow_sync / uuid
       * / password-hash on the resync run (no password here, so the null
       * hash still matches after the re-share).
       */
      it('resume after an allow_sync-revoke Error re-activates the sync and clears last_error', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'ResumeRecovery',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);
        await waitForSyncSettled(destEnv, created.body.id);

        // Revoke allow_sync → view-change handler flips the sync to Error.
        await request(context.app)
          .patch(`/api/v2/meta/views/${sourceView.id}`)
          .set('xc-auth', context.token)
          .send({ allow_sync: false })
          .expect(200);

        const errored = await waitFor('sync flipped to Error', async () => {
          const s = await TableSync.get(
            { workspace_id: workspaceId, base_id: destBase.id },
            created.body.id,
          );
          return s?.status === TableSyncStatus.Error ? s : null;
        });
        expect(errored.last_error).to.be.a('string');

        // Source owner re-enables sharing.
        await enableAllowSync(sourceView.id, sourceBase.id);

        // Resume kicks off a fresh resync that should now succeed.
        await tableSyncResume(context, destEnv, created.body.id).expect(200);
        const recovered = await waitForSyncSettled(destEnv, created.body.id);
        expect(recovered.status).to.eq(TableSyncStatus.Active);
        expect(
          recovered.last_error ?? null,
          'last_error should be cleared on successful resume',
        ).to.eq(null);
      });
    });
  });
}

export default tableSyncHandlerTests;
