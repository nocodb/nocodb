import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { ViewTypes } from 'nocodb-sdk';
import init from '~test/init';
import { isEE } from '~test/utils/helpers';
import { createProject } from '~test/factory/base';
import { createTable } from '~test/factory/table';
import { createView } from '~test/factory/view';
import {
  tableSyncCreate,
  tableSyncDelete,
  tableSyncFreeze,
  tableSyncGet,
  tableSyncList,
  tableSyncResume,
  tableSyncUpdate,
} from '~test/factory/tableSync';
import View from '~/models/View';
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

      it('deletes the sync', async () => {
        await tableSyncDelete(context, destEnv, syncId).expect(200);

        const deleted = await TableSync.get(
          { workspace_id: workspaceId, base_id: destBase.id },
          syncId,
        );
        expect(deleted, 'sync should be removed').to.be.null;
      });
    });
  });
}

export default tableSyncTests;
