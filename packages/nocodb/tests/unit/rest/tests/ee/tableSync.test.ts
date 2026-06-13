import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import init from '~test/init';
import { isPgData } from '~test/init/db';
import { isEE } from '~test/utils/helpers';
import { createProject } from '~test/factory/base';
import { createTable } from '~test/factory/table';
import { createView } from '~test/factory/view';
import { createColumn, createLtarColumn2 } from '~test/factory/column';
import { createRow } from '~test/factory/row';
import {
  tableSyncCreate,
  tableSyncDelete,
  tableSyncFreeze,
  tableSyncGet,
  tableSyncList,
  tableSyncResume,
  tableSyncSourceSchema,
  tableSyncUpdate,
  waitForSyncSettled,
} from '~test/factory/tableSync';
import View from '~/models/View';
import Model from '~/models/Model';
import TableSync from '~/models/TableSync';

/**
 * Table Sync feature tests
 *
 * Exercises the `tableSync*` internal operations end-to-end. Each test sets
 * up a source table with a grid view that has `allow_sync` enabled (which
 * auto-shares the view) and a separate destination base, then drives the
 * sync lifecycle through the factory helpers.
 */
function tableSyncTests() {
  if (!isEE()) {
    return;
  }

  describe('Table Sync', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let workspaceId: string;
    let sourceBase: any;
    let destBase: any;
    let sourceTable: any;
    let sourceView: View;
    let destEnv: { workspaceId: string; baseId: string };

    /**
     * Enable allow_sync on a grid view (auto-shares the view by assigning a
     * uuid). PATCH `/api/v2/meta/views/:id` is the canonical session-auth
     * surface for this — the internal `viewUpdate` operation doesn't
     * accept allow_sync.
     */
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

    beforeEach(async function () {
      context = await init();
      // Table sync depends on custom links, which aren't supported on
      // MSSQL — skip the suite when the data DB isn't PG.
      if (!isPgData(context)) {
        this.skip();
      }
      workspaceId = context.fk_workspace_id!;

      sourceBase = await createProject(context, { title: 'SyncSourceBase' });
      destBase = await createProject(context, { title: 'SyncDestBase' });
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
      expect(sourceView.allow_sync, 'allow_sync should be enabled').to.eq(true);
      expect(sourceView.uuid, 'view should be auto-shared').to.be.a('string');
    });

    describe('tableSyncCreate', () => {
      it('creates a sync and persists it with the right source mapping', async () => {
        const res = await tableSyncCreate(
          context,
          destEnv,
          syncBody({ title: 'CustomersSync' }),
        ).expect(200);

        expect(res.body).to.have.property('id');
        expect(res.body.title).to.eq('CustomersSync');
        expect(res.body.status).to.be.a('string');

        const mainMapping = (res.body.mappings ?? []).find(
          (m: any) => m.role === 'main',
        );
        expect(mainMapping, 'main mapping should exist').to.exist;
        expect(mainMapping.source_workspace_id).to.eq(workspaceId);
        expect(mainMapping.source_base_id).to.eq(sourceBase.id);
        expect(mainMapping.source_table_id).to.eq(sourceTable.id);
        expect(mainMapping.source_view_id).to.eq(sourceView.id);

        const stored = await TableSync.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          res.body.id,
        );
        expect(stored, 'sync should be persisted').to.not.be.null;
        expect(stored!.title).to.eq('CustomersSync');
      });

      it('rejects duplicate sync titles in the same destination base', async () => {
        await tableSyncCreate(context, destEnv, syncBody({ title: 'DupSync' }))
          .expect(200);

        const dup = await tableSyncCreate(
          context,
          destEnv,
          syncBody({ title: 'DupSync' }),
        ).expect(400);
        const msg = dup.body.message ?? dup.body.msg ?? '';
        expect(msg).to.match(/already exists/i);
      });

      it('rejects a source view that does not have allow_sync enabled', async () => {
        const plainView = await createView(context, {
          title: 'PlainGrid',
          table: sourceTable,
          type: ViewTypes.GRID,
        });

        const res = await tableSyncCreate(
          context,
          destEnv,
          syncBody({ title: 'BadSync', source_view_id: plainView.id }),
        ).expect(403);
        const msg = res.body.message ?? res.body.msg ?? '';
        expect(msg).to.match(/allow sync/i);
      });

      it('rejects a non-existent source view', async () => {
        const res = await tableSyncCreate(
          context,
          destEnv,
          syncBody({
            title: 'GhostSync',
            source_view_id: 'vw_does_not_exist',
          }),
        ).expect(404);
        const msg = res.body.message ?? res.body.msg ?? '';
        expect(msg).to.match(/view/i);
      });

      it('rejects a non-existent source table', async () => {
        await tableSyncCreate(
          context,
          destEnv,
          syncBody({
            title: 'GhostTableSync',
            source_table_id: 'md_does_not_exist',
          }),
        ).expect(404);
      });
    });

    describe('lifecycle', () => {
      let syncId: string;

      beforeEach(async () => {
        const res = await tableSyncCreate(
          context,
          destEnv,
          syncBody({ title: 'LifecycleSync' }),
        ).expect(200);
        syncId = res.body.id;
      });

      it('lists the created sync', async () => {
        const res = await tableSyncList(context, destEnv).expect(200);

        expect(res.body).to.be.an('array');
        const found = (res.body as any[]).find((s: any) => s.id === syncId);
        expect(found, 'created sync should appear in list').to.exist;
        expect(found.title).to.eq('LifecycleSync');
      });

      it('gets the sync by id', async () => {
        const res = await tableSyncGet(context, destEnv, syncId).expect(200);

        expect(res.body.id).to.eq(syncId);
        expect(res.body.title).to.eq('LifecycleSync');
      });

      // The edit form reads the SOURCE schema through the sync's own
      // authorization (its Main mapping), NOT the caller's base ACL — so a user
      // who imported a shared view but has no access to the source base can
      // still populate the field selector. This endpoint is what makes that
      // possible; `tableGet`/`viewColumnList` would 403 on the source base.
      it('returns the source schema for the sync', async () => {
        const res = await tableSyncSourceSchema(
          context,
          destEnv,
          syncId,
        ).expect(200);

        expect(res.body.source_table_missing).to.eq(false);

        expect(res.body.columns, 'source columns').to.be.an('array').that.is.not
          .empty;

        expect(res.body.visible_source_column_ids, 'visible source col ids')
          .to.be.an('array').that.is.not.empty;
        // Every visible id must map to a real source column.
        const colIds = new Set(
          (res.body.columns as any[]).map((c: any) => c.id),
        );
        for (const id of res.body.visible_source_column_ids as string[]) {
          expect(colIds.has(id), `visible col ${id} exists in columns`).to.eq(
            true,
          );
        }

        // The bound grid view comes back (so the form can render its
        // allow_sync / password state) with the password hash masked, never
        // raw bcrypt.
        const boundView = (res.body.views as any[]).find(
          (v: any) => v.id === sourceView.id,
        );
        expect(boundView, 'bound source view should be returned').to.exist;
        expect(boundView.allow_sync).to.eq(true);
        if (boundView.password) {
          expect(boundView.password).to.not.match(/^\$2[aby]\$/);
        }
      });

      it('404s when the sync id is unknown in this base', async () => {
        await tableSyncSourceSchema(context, destEnv, 'tsy_does_not_exist')
          .expect(404);
      });

      // The per-link view picker in the edit form can't read the linked
      // tables' views via the user's own ACL — the modal lives in the dest
      // base and the source may not even be readable by the importing user.
      // The source schema must carry them, keyed by linked table id.
      it('returns the linked tables’ views for link fields', async function () {
        this.timeout(120000);
        const ordersTable = await createTable(context, sourceBase, {
          table_name: 'SchemaOrders',
          title: 'SchemaOrders',
        });
        await createLtarColumn2(context, {
          title: 'SchemaOrders',
          parentTable: sourceTable,
          childTable: ordersTable,
          type: 'mm',
        });
        const ordersView = await createView(context, {
          title: 'OrdersFeed',
          table: ordersTable,
          type: ViewTypes.GRID,
        });

        // Fresh main view that includes the new LTAR column (the suite's
        // default view predates it).
        const ltarSource = (await Model.getWithInfo(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          { id: sourceTable.id },
        ))!;
        let mainView = await createView(context, {
          title: `LinkedFeed-${Date.now()}`,
          table: ltarSource,
          type: ViewTypes.GRID,
        });
        mainView = (await enableAllowSync(mainView.id))!;

        const created = await tableSyncCreate(
          context,
          destEnv,
          syncBody({ title: 'LinkedViewsSync', source_view_id: mainView.id }),
        ).expect(200);
        await waitForSyncSettled(destEnv, created.body.id);

        const res = await tableSyncSourceSchema(
          context,
          destEnv,
          created.body.id,
        ).expect(200);

        const linkedViews = res.body.linked_views ?? {};
        expect(
          linkedViews[ordersTable.id],
          'linked table views returned, keyed by table id',
        ).to.be.an('array').that.is.not.empty;
        expect(
          (linkedViews[ordersTable.id] as any[]).some(
            (v: any) => v.id === ordersView.id,
          ),
          'includes the linked table grid view',
        ).to.eq(true);
      });

      it('updates the sync title', async () => {
        const res = await tableSyncUpdate(context, destEnv, syncId, {
          title: 'RenamedSync',
        }).expect(200);

        expect(res.body.title).to.eq('RenamedSync');

        const reloaded = await TableSync.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          syncId,
        );
        expect(reloaded!.title).to.eq('RenamedSync');
      });

      it('rejects updating a sync title to one that already exists', async () => {
        // A second sync to collide with the lifecycle sync ('LifecycleSync').
        const other = await tableSyncCreate(
          context,
          destEnv,
          syncBody({ title: 'OtherSync' }),
        ).expect(200);

        const res = await tableSyncUpdate(context, destEnv, other.body.id, {
          title: 'LifecycleSync',
        }).expect(400);
        const msg = res.body.message ?? res.body.msg ?? '';
        expect(msg).to.match(/already exists/i);
      });

      it('freezes then resumes the sync', async () => {
        const frozen = await tableSyncFreeze(context, destEnv, syncId).expect(
          200,
        );
        expect(frozen.body.status).to.eq('paused');

        // resume kicks off the resync job, so the status moves to syncing
        // rather than active immediately
        const resumed = await tableSyncResume(context, destEnv, syncId).expect(
          200,
        );
        expect(resumed.body.status).to.be.oneOf(['syncing', 'active']);
      });

      it('resuming an already-active sync is a no-op', async () => {
        const created = await tableSyncCreate(
          context,
          destEnv,
          syncBody({ title: 'NoopResume' }),
        ).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        expect(settled.status).to.eq('active');

        // resume() short-circuits when already Active — no new job, status
        // stays put.
        const res = await tableSyncResume(
          context,
          destEnv,
          created.body.id,
        ).expect(200);
        expect(res.body.status).to.eq('active');
      });

      it('deletes the sync', async () => {
        await tableSyncDelete(context, destEnv, syncId).expect(200);

        const deleted = await TableSync.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          syncId,
        );
        expect(deleted, 'sync should be removed').to.be.null;
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // DELETE + RECONCILE SEMANTICS
    // ──────────────────────────────────────────────────────────────────
    // The two delete modes (drop-tables vs unsync-keep-data) and the
    // selected_fields removal path are distinct contracts that the basic
    // lifecycle tests above don't exercise.
    describe('delete and reconcile semantics', () => {
      const destCtx = () => ({
        workspace_id: workspaceId,
        base_id: destBase.id,
      });

      function mainDestTableId(sync: TableSync): string {
        const main = (sync.mappings ?? []).find(
          (m: any) => m.role === 'main',
        );
        expect(main, 'main mapping should exist').to.exist;
        return main!.dest_table_id;
      }

      async function getDestCol(destTableId: string, title: string) {
        const m = await Model.get(destCtx(), destTableId);
        expect(m, `dest model ${destTableId} should exist`).to.exist;
        const cols = await m!.getColumns(destCtx());
        return cols.find((c) => c.title === title);
      }

      /**
       * `dropTables: true` is the "remove everything" path — every mapped
       * dest table (main + any shadows/junctions) is hard-dropped, then the
       * sync row is removed. After this, the main dest model should not
       * resolve at all.
       */
      it('delete with dropTables=true drops the destination tables', async () => {
        await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });

        const created = await tableSyncCreate(
          context,
          destEnv,
          syncBody({ title: 'DropTablesSync' }),
        ).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTableId = mainDestTableId(settled);
        expect(await Model.get(destCtx(), destTableId)).to.exist;

        await tableSyncDelete(context, destEnv, created.body.id, {
          dropTables: true,
        }).expect(200);

        // Both the sync row and the dest table should be gone.
        expect(await TableSync.get(destCtx(), created.body.id)).to.be.null;
        expect(
          await Model.get(destCtx(), destTableId),
          'dest table should be hard-dropped',
        ).to.not.exist;
      });

      /**
       * `dropTables: false` (the default) is "unsync but keep my data" — the
       * dest table survives but is flipped to a regular (non-synced) table:
       * `synced` is no longer true and the previously-readonly synced columns
       * become editable. The sync row itself is still removed.
       */
      it('delete with dropTables=false keeps the dest table but unsyncs it', async () => {
        await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });

        const created = await tableSyncCreate(
          context,
          destEnv,
          syncBody({ title: 'KeepDataSync' }),
        ).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTableId = mainDestTableId(settled);

        const before = await Model.get(destCtx(), destTableId);
        expect(before!.synced, 'dest should be synced before delete').to.eq(
          true,
        );

        await tableSyncDelete(context, destEnv, created.body.id, {
          dropTables: false,
        }).expect(200);

        expect(await TableSync.get(destCtx(), created.body.id)).to.be.null;

        const after = await Model.get(destCtx(), destTableId);
        expect(after, 'dest table should be kept').to.exist;
        expect(
          after!.synced,
          'kept dest table should be flipped to non-synced',
        ).to.not.eq(true);

        // The synced columns were created readonly; after unsync they should
        // be editable again so the user can take over the data.
        const cols = await after!.getColumns(destCtx());
        const titleCol = cols.find((c) => c.title === 'Title');
        expect(titleCol, 'dest Title column should exist').to.exist;
        expect(
          titleCol!.readonly,
          'previously-synced col should no longer be readonly',
        ).to.not.eq(true);
      });

      /**
       * Removing a plain (non-PV) field from `selected_fields` via updateSync
       * should drop the corresponding dest column. The PV (Title) is always
       * synced and must survive. Only the LTAR-removal variant of this path
       * was covered before.
       */
      it('tableSyncList is scoped to the destination base', async () => {
        const created = await tableSyncCreate(
          context,
          destEnv,
          syncBody({ title: 'ScopedSync' }),
        ).expect(200);

        // A different dest base must NOT see this sync.
        const otherBase = await createProject(context, {
          title: 'OtherDestBase',
        });
        const otherList = await tableSyncList(context, {
          workspaceId,
          baseId: otherBase.id,
        }).expect(200);
        expect(
          (otherList.body as any[]).some((s) => s.id === created.body.id),
          'sync should not leak into another base list',
        ).to.eq(false);

        // The owning base does.
        const ownList = await tableSyncList(context, destEnv).expect(200);
        expect(
          (ownList.body as any[]).some((s) => s.id === created.body.id),
        ).to.eq(true);
      });

      it('removing a field from selected_fields drops the dest column', async () => {
        await createColumn(context, sourceTable, {
          title: 'Note',
          uidt: UITypes.SingleLineText,
        });

        const created = await tableSyncCreate(
          context,
          destEnv,
          syncBody({
            title: 'FieldRemovalSync',
            selected_fields: ['Title', 'Note'],
          }),
        ).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTableId = mainDestTableId(settled);
        expect(await getDestCol(destTableId, 'Note')).to.exist;

        // Drop "Note" from the selection — PV stays.
        await tableSyncUpdate(context, destEnv, created.body.id, {
          selected_fields: ['Title'],
        }).expect(200);
        await waitForSyncSettled(destEnv, created.body.id);

        expect(
          await getDestCol(destTableId, 'Note'),
          'unselected field should be dropped from dest',
        ).to.not.exist;
        expect(
          await getDestCol(destTableId, 'Title'),
          'PV should always survive',
        ).to.exist;
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // PASTE-MODE PASSWORD
    // ──────────────────────────────────────────────────────────────────
    // Browse-mode (same-workspace) callers skip the source share password
    // check. Paste-mode (a share link pasted from elsewhere) must present
    // the correct share password at create time.
    describe('paste-mode password', () => {
      const SHARE_PW = 'sourceShareSecret';

      async function setSharePassword(viewId: string) {
        await request(context.app)
          .patch(`/api/v2/meta/views/${viewId}/share`)
          .set('xc-auth', context.token)
          .send({ password: SHARE_PW })
          .expect(200);
      }

      it('rejects paste-mode create with the wrong source share password', async () => {
        await setSharePassword(sourceView.id);

        const res = await tableSyncCreate(
          context,
          destEnv,
          syncBody({
            title: 'PasteWrongPw',
            source_input_mode: 'paste',
            password: 'totally-wrong',
          }),
        ).expect(403);
        const msg = res.body.message ?? res.body.msg ?? '';
        expect(msg).to.match(/password/i);
      });

      it('accepts paste-mode create with the correct source share password', async () => {
        await setSharePassword(sourceView.id);

        await tableSyncCreate(
          context,
          destEnv,
          syncBody({
            title: 'PasteRightPw',
            source_input_mode: 'paste',
            password: SHARE_PW,
          }),
        ).expect(200);
      });
    });

    // ──────────────────────────────────────────────────────────────────
    // BROWSE-MODE WORKSPACE RESTRICTION
    // ──────────────────────────────────────────────────────────────────
    // Browse mode trusts workspace ACL for source authorization, so it is
    // only valid when the source lives in the caller's own workspace. A
    // cross-workspace source must use paste mode (with the share password).
    describe('browse-mode workspace restriction', () => {
      it('rejects browse-mode create when the source is in another workspace', async () => {
        const res = await tableSyncCreate(
          context,
          destEnv,
          syncBody({
            title: 'CrossWsBrowse',
            source_input_mode: 'browse',
            source_workspace_id: 'ws_otherworkspace00',
          }),
        ).expect(403);
        const msg = res.body.message ?? res.body.msg ?? '';
        expect(msg).to.match(/workspace/i);
      });
    });
  });
}

export default tableSyncTests;
