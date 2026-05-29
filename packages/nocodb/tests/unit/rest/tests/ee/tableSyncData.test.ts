import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import {
  isLinksOrLTAR,
  NOCO_SERVICE_USERS,
  ServiceUserType,
  TableSyncOnDeleteAction,
  TableSyncStatus,
  TableSyncTrigger,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import init from '~test/init';
import { isEE } from '~test/utils/helpers';
import { createProject } from '~test/factory/base';
import { createTable } from '~test/factory/table';
import { createView } from '~test/factory/view';
import { createColumn, createLtarColumn2 } from '~test/factory/column';
import { createRow, listRow } from '~test/factory/row';
import {
  tableSyncCreate,
  tableSyncDelete,
  tableSyncUpdate,
  waitForSyncSettled,
} from '~test/factory/tableSync';
import { internalPost } from '~test/factory/internal';
import { randomUUID } from 'crypto';
import View from '~/models/View';
import Model from '~/models/Model';
import TableSync from '~/models/TableSync';
import Noco from '~/Noco';
import { acquireLock, releaseLock } from '~/helpers/lockHelpers';
import {
  bufferPendingIncrementalIds,
  drainPendingIncrementalIds,
} from '~/modules/table-sync/table-sync.helpers';
import { TableSyncProcessor } from '~/modules/table-sync/table-sync.processor';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobTypes } from '~/interface/Jobs';

/**
 * Table Sync data-replication tests
 *
 * Each test wires up a source table + grid view with `allow_sync` enabled
 * (auto-shares the view) and exercises one slice of the replication
 * contract: schema mirror, row copy, update propagation, delete actions
 * (MarkDeleted / Delete), view-filter scope, selected_fields, and LTAR
 * handling (comma-separated text vs. shadow-table).
 */
function tableSyncDataTests() {
  if (!isEE()) {
    return;
  }

  describe('Table Sync — data replication', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let workspaceId: string;
    let sourceBase: any;
    let destBase: any;
    let sourceTable: Model;
    let sourceView: View;
    let sourceEnv: { workspaceId: string; baseId: string };
    let destEnv: { workspaceId: string; baseId: string };

    async function enableAllowSync(viewId: string, baseId: string) {
      await request(context.app)
        .patch(`/api/v2/meta/views/${viewId}`)
        .set('xc-auth', context.token)
        .send({ allow_sync: true })
        .expect(200);

      return View.get({ workspace_id: workspaceId, base_id: baseId }, viewId);
    }

    async function updateRow(table: Model, rowId: string | number, body: any) {
      await request(context.app)
        .patch(`/api/v1/db/data/noco/${sourceBase.id}/${table.id}/${rowId}`)
        .set('xc-auth', context.token)
        .send(body)
        .expect(200);
    }

    async function deleteRow(table: Model, rowId: string | number) {
      await request(context.app)
        .delete(`/api/v1/db/data/noco/${sourceBase.id}/${table.id}/${rowId}`)
        .set('xc-auth', context.token)
        .expect(200);
    }

    async function v3LinkAdd(
      table: Model,
      linkColId: string,
      rowId: number,
      refRowIds: number[],
    ) {
      await request(context.app)
        .post(
          `/api/v3/data/${sourceBase.id}/${table.id}/links/${linkColId}/${rowId}`,
        )
        .set('xc-auth', context.token)
        .send(refRowIds.map((id) => ({ id })))
        .expect(200);
    }

    async function addContainsFilter(viewId: string, columnId: string, value: string) {
      await request(context.app)
        .post(`/api/v1/db/meta/views/${viewId}/filters`)
        .set('xc-auth', context.token)
        .send({
          fk_column_id: columnId,
          comparison_op: 'eq',
          value,
          logical_op: 'and',
        })
        .expect(200);
    }

    async function resync(syncId: string) {
      await internalPost(context, destEnv, {
        operation: 'tableSyncResync',
        tableSyncId: syncId,
      }).expect(200);
      return waitForSyncSettled(destEnv, syncId);
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

    async function destRows(destTable: Model): Promise<any[]> {
      return (await listRow({
        base: destBase,
        table: destTable,
      })) as any[];
    }

    async function destTitles(destTable: Model): Promise<string[]> {
      const rows = await destRows(destTable);
      return rows.map((r) => r.Title).sort();
    }

    beforeEach(async function () {
      context = await init();
      workspaceId = context.fk_workspace_id!;

      sourceBase = await createProject(context, { title: 'DataSyncSourceBase' });
      destBase = await createProject(context, { title: 'DataSyncDestBase' });
      sourceEnv = { workspaceId, baseId: sourceBase.id };
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

    describe('initial copy + schema', () => {
      it('copies pre-existing source rows into the destination on initial sync', async () => {
        await createRow(context, { base: sourceBase, table: sourceTable, index: 0 });
        await createRow(context, { base: sourceBase, table: sourceTable, index: 1 });
        await createRow(context, { base: sourceBase, table: sourceTable, index: 2 });

        const created = await tableSyncCreate(context, destEnv, {
          title: 'CopySync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);

        const settled = await waitForSyncSettled(destEnv, created.body.id);
        expect(settled.status).to.eq(TableSyncStatus.Active);

        const destTable = await loadDestModel(mainDestTableId(settled));
        expect(await destTitles(destTable)).to.deep.eq([
          'test-0',
          'test-1',
          'test-2',
        ]);
      });

      it('mirrors the destination schema from the source columns', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'SchemaSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);

        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTable = await loadDestModel(mainDestTableId(settled));

        const destColumns = await destTable.getColumns({
          workspace_id: workspaceId,
          base_id: destBase.id,
        });
        const destTitles = destColumns.map((c) => c.title);

        const sourceColumns = await sourceTable.getColumns({
          workspace_id: workspaceId,
          base_id: sourceBase.id,
        });
        const expected = sourceColumns
          .filter((c) => !c.system)
          .map((c) => c.title);

        for (const title of expected) {
          expect(destTitles, `dest missing source column "${title}"`).to.include(
            title,
          );
        }
      });
    });

    describe('concurrent incremental — no id loss', () => {
      // The core safety property: while one incremental run is in flight (holds
      // the per-sync lock), any incremental runs that fire concurrently must
      // park their ids in the buffer rather than drop them — so a delete that
      // arrives mid-run is never lost. Here we hold the lock ourselves to
      // stand in for an in-flight run, fire several real incremental jobs
      // through the processor, then assert every id survives.
      it('buffers ids from runs blocked by an in-flight run, losing none', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'ConcurrentSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);
        const syncId = created.body.id;
        const settled = await waitForSyncSettled(destEnv, syncId);
        expect(settled.status).to.eq(TableSyncStatus.Active);

        const processor = Noco.nestApp.get(TableSyncProcessor);
        const destCtx = { workspace_id: workspaceId, base_id: destBase.id };
        const lockKey = `lock:tableSync:incremental:${syncId}`;

        // An in-flight run holds the lock; nobody else can take it.
        const holderId = randomUUID();
        expect(await acquireLock(lockKey, holderId, 0, 600)).to.eq(true);
        expect(await acquireLock(lockKey, randomUUID(), 0, 600)).to.eq(false);

        // Fire real incremental jobs while the lock is held. Each bails on the
        // lock and buffers its ids. The bail path returns before it touches
        // job.id / logging, so a minimal job object is enough — no mocking of
        // the processor itself.
        const runIncremental = (ids: string[]) =>
          processor.job({
            data: {
              context: destCtx,
              syncId,
              mode: 'incremental',
              affectedIdsBySource: { [sourceTable.id]: ids },
              req: {},
            },
          } as any);

        await runIncremental(['s1', 's2']);
        await runIncremental(['s2', 's3']); // s2 overlaps — must dedupe
        await runIncremental(['s4']);

        // The in-flight run finishes; the lock frees for the next run.
        await releaseLock(lockKey, holderId);
        const nextId = randomUUID();
        expect(await acquireLock(lockKey, nextId, 0, 600)).to.eq(true);
        await releaseLock(lockKey, nextId);

        // Every id from every blocked run survived (deduped) — none dropped.
        const drained = await drainPendingIncrementalIds(destCtx, syncId);
        expect(drained, 'buffered ids should survive the contention').to.exist;
        expect([...drained![sourceTable.id]].sort()).to.deep.eq([
          's1',
          's2',
          's3',
          's4',
        ]);
        // Draining clears the buffer.
        expect(await drainPendingIncrementalIds(destCtx, syncId)).to.eq(
          undefined,
        );
      });

      // The trailing path: a run that finishes with a non-empty buffer drains
      // it and schedules a follow-up run (into the sync's free slot) that must
      // replicate the buffered ids. Two things have to hold for r1 to land:
      // (1) the queue cleanly runs the scheduled follow-up, and (2) the
      // follow-up fetches by its explicit affectedIds — NOT the LMT cursor,
      // which a prior run (r0) advances to the same second and would drop r1
      // via a strict `>` filter. Manual trigger keeps source writes from
      // auto-scheduling, so the ONLY thing that can replicate r1 is this
      // trailing run. No stubs: real queue, real processor, real DB.
      it('finishes, drains its buffer, and re-runs itself to replicate the buffered ids', async function () {
        this.timeout(40000);

        await createRow(context, { base: sourceBase, table: sourceTable, index: 0 }); // test-0
        await createRow(context, { base: sourceBase, table: sourceTable, index: 1 }); // test-1

        const created = await tableSyncCreate(context, destEnv, {
          title: 'TrailingSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          sync_trigger: TableSyncTrigger.Manual,
        }).expect(200);
        const syncId = created.body.id;
        const settled = await waitForSyncSettled(destEnv, syncId);
        const destTable = await loadDestModel(mainDestTableId(settled));
        expect(await destTitles(destTable)).to.deep.eq(['test-0', 'test-1']);

        const srcRows = (await listRow({
          base: sourceBase,
          table: sourceTable,
        })) as any[];
        const r0 = srcRows.find((r) => r.Title === 'test-0');
        const r1 = srcRows.find((r) => r.Title === 'test-1');

        // Manual trigger ⇒ these writes schedule no incremental job.
        await updateRow(sourceTable, r0.Id, { Title: 'CHANGED0' });
        await updateRow(sourceTable, r1.Id, { Title: 'TRAILING' });

        // r1's id is parked in the buffer (as if it arrived mid-run). Nothing
        // else will replicate it.
        const destCtx = { workspace_id: workspaceId, base_id: destBase.id };
        await bufferPendingIncrementalIds(destCtx, syncId, {
          [sourceTable.id]: [String(r1.Id)],
        });

        // One real incremental job for r0. On completion it drains [r1] and
        // schedules a follow-up run for it; that run replicates r1. If the
        // follow-up never runs, or runs but fetches by the (now-advanced)
        // cursor instead of its affectedIds, r1 stays 'test-1'.
        const jobs = Noco.nestApp.get(NocoJobsService);
        await jobs.add(
          JobTypes.TableSyncRun,
          {
            context: destCtx,
            syncId,
            mode: 'incremental',
            affectedIdsBySource: { [sourceTable.id]: [String(r0.Id)] },
            req: {
              user: NOCO_SERVICE_USERS[ServiceUserType.SYNC_USER],
              ncWorkspaceId: workspaceId,
              ncBaseId: destBase.id,
              ncSiteUrl: '',
              dashboardUrl: '',
              headers: {},
              query: {},
              body: {},
              params: {},
            },
          },
          {
            jobId: `tableSync:${syncId}:incremental`,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );

        // Wait for the direct run (r0 → CHANGED0) and the trailing re-run
        // (r1 → TRAILING, reachable only via the self-remove path).
        const deadline = Date.now() + 30000;
        let titles: string[] = [];
        do {
          titles = await destTitles(destTable);
          if (titles.includes('CHANGED0') && titles.includes('TRAILING')) break;
          await new Promise((r) => setTimeout(r, 500));
        } while (Date.now() < deadline);

        expect(
          titles,
          'trailing re-run should replicate the buffered id',
        ).to.deep.eq(['CHANGED0', 'TRAILING']);

        // Buffer fully drained by the re-run.
        expect(await drainPendingIncrementalIds(destCtx, syncId)).to.eq(
          undefined,
        );
      });
    });

    describe('manual resync', () => {
      it('starts empty when source is empty, then picks up new rows via tableSyncResync', async () => {
        const created = await tableSyncCreate(context, destEnv, {
          title: 'ResyncFlow',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);

        const initial = await waitForSyncSettled(destEnv, created.body.id);
        const destTable = await loadDestModel(mainDestTableId(initial));
        expect(await destTitles(destTable)).to.deep.eq([]);

        await createRow(context, { base: sourceBase, table: sourceTable, index: 0 });
        await createRow(context, { base: sourceBase, table: sourceTable, index: 1 });

        await resync(created.body.id);
        expect(await destTitles(destTable)).to.deep.eq(['test-0', 'test-1']);
      });

      it('propagates source row updates after a resync', async () => {
        const row = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });

        const created = await tableSyncCreate(context, destEnv, {
          title: 'UpdateSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);

        const initial = await waitForSyncSettled(destEnv, created.body.id);
        const destTable = await loadDestModel(mainDestTableId(initial));
        expect(await destTitles(destTable)).to.deep.eq(['test-0']);

        await updateRow(sourceTable, row.Id, { Title: 'renamed' });

        await resync(created.body.id);
        expect(await destTitles(destTable)).to.deep.eq(['renamed']);
      });
    });

    describe('delete propagation', () => {
      it('marks dest rows RemoteDeleted=true when source row is removed (MarkDeleted, the default)', async () => {
        const keep = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });
        const drop = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 1,
        });

        const created = await tableSyncCreate(context, destEnv, {
          title: 'MarkDeletedSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          // on_delete_action omitted → defaults to MarkDeleted server-side.
        }).expect(200);

        await waitForSyncSettled(destEnv, created.body.id);

        await deleteRow(sourceTable, drop.Id);
        const settled = await resync(created.body.id);
        expect(settled.on_delete_action).to.eq(
          TableSyncOnDeleteAction.MarkDeleted,
        );

        const destTable = await loadDestModel(mainDestTableId(settled));
        const rows = await destRows(destTable);

        // Both rows still exist on dest; the dropped one is flagged.
        expect(rows).to.have.lengthOf(2);
        const dropped = rows.find((r) => r.RemoteId === String(drop.Id));
        const kept = rows.find((r) => r.RemoteId === String(keep.Id));
        expect(dropped?.RemoteDeleted, 'dropped row should be tombstoned').to.eq(
          true,
        );
        expect(dropped?.RemoteDeletedTime, 'tombstone time should be set').to.be
          .a('string');
        expect(kept?.RemoteDeleted, 'kept row should not be tombstoned').to.not.eq(
          true,
        );
      });

      it('hard-deletes dest rows when on_delete_action is Delete', async () => {
        const keep = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });
        const drop = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 1,
        });

        const created = await tableSyncCreate(context, destEnv, {
          title: 'HardDeleteSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          on_delete_action: TableSyncOnDeleteAction.Delete,
        }).expect(200);

        await waitForSyncSettled(destEnv, created.body.id);

        await deleteRow(sourceTable, drop.Id);
        const settled = await resync(created.body.id);
        expect(settled.on_delete_action).to.eq(TableSyncOnDeleteAction.Delete);

        const destTable = await loadDestModel(mainDestTableId(settled));
        const rows = await destRows(destTable);

        expect(rows).to.have.lengthOf(1);
        expect(rows[0].RemoteId).to.eq(String(keep.Id));
      });
    });

    describe('source view filter scope', () => {
      it('only mirrors rows that match the source view filter', async () => {
        await createRow(context, { base: sourceBase, table: sourceTable, index: 0 });
        await createRow(context, { base: sourceBase, table: sourceTable, index: 1 });
        await createRow(context, { base: sourceBase, table: sourceTable, index: 2 });

        // Restrict the source view to `Title = "test-1"`.
        const sourceCols = await sourceTable.getColumns({
          workspace_id: workspaceId,
          base_id: sourceBase.id,
        });
        const titleCol = sourceCols.find((c) => c.title === 'Title');
        expect(titleCol, 'source Title column should exist').to.exist;
        await addContainsFilter(sourceView.id, titleCol!.id, 'test-1');

        const created = await tableSyncCreate(context, destEnv, {
          title: 'FilteredSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);

        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTable = await loadDestModel(mainDestTableId(settled));
        expect(await destTitles(destTable)).to.deep.eq(['test-1']);
      });
    });

    describe('selected_fields', () => {
      it('only mirrors selected columns (plus the primary value) into the destination', async () => {
        // Add an extra source column we will deliberately NOT select.
        await createColumn(context, sourceTable, {
          column_name: 'Note',
          title: 'Note',
          uidt: UITypes.SingleLineText,
        });
        // Refresh the source model so subsequent createRow sees the new column.
        sourceTable = (await Model.get(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          sourceTable.id,
        ))!;

        await createRow(context, { base: sourceBase, table: sourceTable, index: 0 });

        const created = await tableSyncCreate(context, destEnv, {
          title: 'SelectedFieldsSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          // PV (Title) is always synced; Note is the gated field.
          selected_fields: ['Title'],
        }).expect(200);

        const settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTable = await loadDestModel(mainDestTableId(settled));

        const destCols = await destTable.getColumns({
          workspace_id: workspaceId,
          base_id: destBase.id,
        });
        const destColTitles = destCols.map((c) => c.title);
        expect(destColTitles).to.include('Title');
        expect(destColTitles).to.not.include('Note');
      });
    });

    describe('LTAR replication', () => {
      let ordersTable: Model;
      let ltarColumnTitle: string;

      /**
       * Build a Customers ⇄ Orders relation, then create the Customers sync
       * view fresh so the new LTAR column is visible from the start. The
       * top-level beforeEach already made a view — we rebuild it here.
       */
      async function setupLtar() {
        ordersTable = await createTable(context, sourceBase, {
          table_name: 'Orders',
          title: 'Orders',
        });

        ltarColumnTitle = 'Orders';
        await createLtarColumn2(context, {
          title: ltarColumnTitle,
          parentTable: sourceTable,
          childTable: ordersTable,
          type: 'mm',
        });

        sourceTable = (await Model.getWithInfo(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          { id: sourceTable.id },
        ))!;

        sourceView = await createView(context, {
          title: `LtarFeed-${Date.now()}`,
          table: sourceTable,
          type: ViewTypes.GRID,
        });
        sourceView = (await enableAllowSync(sourceView.id, sourceBase.id))!;
      }

      async function ltarColumnId(): Promise<string> {
        const cols = await sourceTable.getColumns({
          workspace_id: workspaceId,
          base_id: sourceBase.id,
        });
        const col = cols.find((c) => c.title === ltarColumnTitle);
        expect(col, 'LTAR column should exist').to.exist;
        return col!.id;
      }

      it('flattens LTAR to a comma-separated SingleLineText column when all-fields mode is used', async () => {
        await setupLtar();

        const customer = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });
        const o1 = await createRow(context, {
          base: sourceBase,
          table: ordersTable,
          index: 0,
        });
        const o2 = await createRow(context, {
          base: sourceBase,
          table: ordersTable,
          index: 1,
        });
        await v3LinkAdd(sourceTable, await ltarColumnId(), customer.Id, [
          o1.Id,
          o2.Id,
        ]);

        const created = await tableSyncCreate(context, destEnv, {
          title: 'LtarTextSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          // selected_fields omitted → all-fields mode → LTAR forced to text.
        }).expect(200);

        const settled = await waitForSyncSettled(destEnv, created.body.id);

        // No LinkedShadow mapping should have been created.
        const linkedShadows = (settled.mappings ?? []).filter(
          (m: any) => m.role === 'linked_shadow',
        );
        expect(
          linkedShadows,
          'no shadow tables expected in all-fields mode',
        ).to.have.lengthOf(0);

        const destTable = await loadDestModel(mainDestTableId(settled));
        const destCols = await destTable.getColumns({
          workspace_id: workspaceId,
          base_id: destBase.id,
        });
        const ordersDestCol = destCols.find((c) => c.title === ltarColumnTitle);
        expect(ordersDestCol, 'dest LTAR column should exist').to.exist;
        expect(
          ordersDestCol!.uidt,
          'LTAR should be flattened to SingleLineText on dest',
        ).to.eq(UITypes.SingleLineText);
        expect(
          isLinksOrLTAR(ordersDestCol!),
          'flattened col should not be a real relation',
        ).to.eq(false);

        const rows = await destRows(destTable);
        expect(rows).to.have.lengthOf(1);
        // Orders PVs are their `Title` values, comma-separated.
        const linkedText = String(rows[0][ltarColumnTitle] ?? '');
        const parts = linkedText.split(', ').sort();
        expect(parts).to.deep.eq(['test-0', 'test-1']);
      });

      it('creates a shadow table and junction rows when linkViewByColumn picks a sync-enabled view', async () => {
        await setupLtar();

        // The linked table needs its own sync-enabled grid view.
        const ordersView = await createView(context, {
          title: 'OrdersFeed',
          table: ordersTable,
          type: ViewTypes.GRID,
        });
        await enableAllowSync(ordersView.id, sourceBase.id);

        const customer = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });
        const o1 = await createRow(context, {
          base: sourceBase,
          table: ordersTable,
          index: 0,
        });
        const o2 = await createRow(context, {
          base: sourceBase,
          table: ordersTable,
          index: 1,
        });
        await v3LinkAdd(sourceTable, await ltarColumnId(), customer.Id, [
          o1.Id,
          o2.Id,
        ]);

        const created = await tableSyncCreate(context, destEnv, {
          title: 'LtarShadowSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          // Specific mode: Title is the PV (auto-synced); Orders is selected
          // AND a sync-enabled linked view is picked — triggers shadow path.
          selected_fields: ['Title', ltarColumnTitle],
          link_view_by_column: { [ltarColumnTitle]: ordersView.id },
        }).expect(200);

        const settled = await waitForSyncSettled(destEnv, created.body.id);

        // A LinkedShadow mapping should now exist for Orders.
        const linkedShadows = (settled.mappings ?? []).filter(
          (m: any) => m.role === 'linked_shadow',
        );
        expect(
          linkedShadows,
          'shadow mapping should be created for the linked table',
        ).to.have.lengthOf(1);
        const shadowMapping = linkedShadows[0];
        expect(shadowMapping.source_table_id).to.eq(ordersTable.id);
        expect(shadowMapping.source_view_id).to.eq(ordersView.id);

        const destMain = await loadDestModel(mainDestTableId(settled));
        const destShadow = await loadDestModel(shadowMapping.dest_table_id);

        // Shadow table should have the Orders rows.
        const shadowRows = await destRows(destShadow);
        expect(shadowRows.map((r) => r.Title).sort()).to.deep.eq([
          'test-0',
          'test-1',
        ]);

        // Main table's LTAR column should now be a real relation.
        const mainCols = await destMain.getColumns({
          workspace_id: workspaceId,
          base_id: destBase.id,
        });
        const ltarOnMain = mainCols.find((c) => c.title === ltarColumnTitle);
        expect(ltarOnMain, 'main dest should have an LTAR column').to.exist;
        expect(
          isLinksOrLTAR(ltarOnMain!),
          'LTAR column on main should be a real relation',
        ).to.eq(true);

        // Confirm the junction (MM) table has the two link rows. The
        // junction is keyed on RemoteId (source PK), not on the dest's
        // own auto-id — see processor line 480 in table-sync.processor.ts.
        const ltarColOptions = await (
          ltarOnMain as any
        ).getColOptions?.({
          workspace_id: workspaceId,
          base_id: destBase.id,
        });
        const mmModelId = ltarColOptions?.fk_mm_model_id;
        expect(mmModelId, 'LTAR column should expose its junction model id').to
          .be.a('string');

        const junction = await loadDestModel(mmModelId!);
        const junctionRows = await destRows(junction);
        expect(
          junctionRows,
          'junction should hold one row per linked Order',
        ).to.have.lengthOf(2);
      });

      /**
       * Regression: adding an LTAR with a picked view via `updateSync` (not at
       * create time) goes through `reconcileFields` → `addSyncedField`. Before
       * the fix, `reconcileFields` walked the STALE `oldSync.mappings` to
       * write column-mappings, so the new LinkedShadow mapping inserted
       * inside `addSyncedField` was skipped and its dest cols got zero
       * column-mapping rows. The processor's `buildColumnPlan` then produced
       * empty `forwardFields`, and the shadow rows landed with only
       * system fields populated.
       *
       * This test asserts (a) the LinkedShadow's column-mappings DO get
       * written when an LTAR is added via update, and (b) the resulting
       * shadow rows carry real data (PV value), not just system fields.
       */
      it('writes column-mappings for the shadow when an LTAR is added via updateSync', async () => {
        await setupLtar();

        const ordersView = await createView(context, {
          title: 'OrdersFeed',
          table: ordersTable,
          type: ViewTypes.GRID,
        });
        await enableAllowSync(ordersView.id, sourceBase.id);

        const customer = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });
        const o1 = await createRow(context, {
          base: sourceBase,
          table: ordersTable,
          index: 0,
        });
        const o2 = await createRow(context, {
          base: sourceBase,
          table: ordersTable,
          index: 1,
        });
        await v3LinkAdd(sourceTable, await ltarColumnId(), customer.Id, [
          o1.Id,
          o2.Id,
        ]);

        // 1) Create sync WITHOUT the shadow path — LTAR is excluded from
        //    selected_fields, so no LinkedShadow / Junction mapping yet.
        const created = await tableSyncCreate(context, destEnv, {
          title: 'LtarAddedViaUpdate',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title'],
        }).expect(200);

        const initial = await waitForSyncSettled(destEnv, created.body.id);
        const initialShadows = (initial.mappings ?? []).filter(
          (m: any) => m.role === 'linked_shadow',
        );
        expect(
          initialShadows,
          'no shadow mapping at create time',
        ).to.have.lengthOf(0);

        // 2) Update the sync to include the LTAR + pick the Orders view.
        //    This is the path that hits `reconcileFields` → `addSyncedField`
        //    which inserts a new LinkedShadow mapping.
        await tableSyncUpdate(context, destEnv, created.body.id, {
          selected_fields: ['Title', ltarColumnTitle],
          link_view_by_column: { [ltarColumnTitle]: ordersView.id },
        }).expect(200);

        const settled = await waitForSyncSettled(destEnv, created.body.id);

        // (a) LinkedShadow mapping should now exist.
        const linkedShadows = (settled.mappings ?? []).filter(
          (m: any) => m.role === 'linked_shadow',
        );
        expect(
          linkedShadows,
          'shadow mapping should be created by updateSync',
        ).to.have.lengthOf(1);
        const shadowMapping = linkedShadows[0];

        // (b) The bug: shadow rows must carry the source PV, not just
        //     system fields. If `writeColumnMappingsForTableMapping` skipped
        //     the new mapping, `forwardFields` would be empty and Title
        //     would be undefined on each row.
        const destShadow = await loadDestModel(shadowMapping.dest_table_id);
        const shadowRows = await destRows(destShadow);
        expect(shadowRows, 'shadow rows should be populated').to.have.lengthOf(
          2,
        );
        const titles = shadowRows.map((r) => r.Title).sort();
        expect(
          titles,
          'each shadow row should carry the source Title (not just system fields)',
        ).to.deep.eq(['test-0', 'test-1']);
      });

      /**
       * Regression: dropTables on an LTAR sync must drop main + shadow +
       * junction with no orphan left behind. Before the fix, dropping the
       * main first left a dangling COL_RELATIONS row, and deleting the
       * junction null-deref'd in tableDelete (the MM-reference guard) — caught
       * as a warning, so the junction table lingered. delete() now passes
       * forceDeleteRelations + skips already-gone tables.
       */
      it('dropTables=true on an LTAR sync drops main + shadow + junction with no orphans', async () => {
        await setupLtar();

        const ordersView = await createView(context, {
          title: 'OrdersFeed',
          table: ordersTable,
          type: ViewTypes.GRID,
        });
        await enableAllowSync(ordersView.id, sourceBase.id);

        const customer = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });
        const o1 = await createRow(context, {
          base: sourceBase,
          table: ordersTable,
          index: 0,
        });
        await v3LinkAdd(sourceTable, await ltarColumnId(), customer.Id, [o1.Id]);

        const created = await tableSyncCreate(context, destEnv, {
          title: 'DropLtarSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          selected_fields: ['Title', ltarColumnTitle],
          link_view_by_column: { [ltarColumnTitle]: ordersView.id },
        }).expect(200);
        const settled = await waitForSyncSettled(destEnv, created.body.id);

        const tableIds = (settled.mappings ?? []).map(
          (m: any) => m.dest_table_id,
        );
        // main + shadow + junction
        expect(
          tableIds.length,
          'expected main + shadow + junction mappings',
        ).to.be.greaterThan(2);

        await tableSyncDelete(context, destEnv, created.body.id, {
          dropTables: true,
        }).expect(200);

        // Sync row gone.
        expect(
          await TableSync.get(
            { workspace_id: workspaceId, base_id: destBase.id },
            created.body.id,
          ),
        ).to.be.null;

        // Every mapped dest table gone — including the junction that used to
        // linger after the null-deref.
        for (const tid of tableIds) {
          expect(
            await Model.get(
              { workspace_id: workspaceId, base_id: destBase.id },
              tid,
            ),
            `dest table ${tid} should be dropped`,
          ).to.not.exist;
        }
      });
    });

    describe('tombstone and delete-action edge cases', () => {
      /**
       * `on_delete_action` is editable via updateSync. Switching
       * MarkDeleted → Delete should change behaviour on the NEXT resync:
       * a row that was tombstoned while the sync was in MarkDeleted mode
       * (and is still missing from the source) gets hard-deleted once the
       * action flips to Delete.
       */
      it('switching on_delete_action MarkDeleted→Delete hard-deletes a previously-tombstoned row on the next resync', async () => {
        const keep = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });
        const drop = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 1,
        });

        const created = await tableSyncCreate(context, destEnv, {
          title: 'DeleteActionTransition',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
          // default → MarkDeleted
        }).expect(200);
        await waitForSyncSettled(destEnv, created.body.id);

        // Delete the source row → resync → tombstoned (still present).
        await deleteRow(sourceTable, drop.Id);
        let settled = await resync(created.body.id);
        expect(settled.on_delete_action).to.eq(
          TableSyncOnDeleteAction.MarkDeleted,
        );
        const destTable = await loadDestModel(mainDestTableId(settled));
        let rows = await destRows(destTable);
        expect(rows).to.have.lengthOf(2);
        expect(
          rows.find((r) => r.RemoteId === String(drop.Id))?.RemoteDeleted,
          'dropped row should be tombstoned under MarkDeleted',
        ).to.eq(true);

        // Flip to hard-delete, resync — the still-missing tombstoned row
        // should now be physically removed.
        await tableSyncUpdate(context, destEnv, created.body.id, {
          on_delete_action: TableSyncOnDeleteAction.Delete,
        }).expect(200);
        settled = await resync(created.body.id);
        expect(settled.on_delete_action).to.eq(TableSyncOnDeleteAction.Delete);

        rows = await destRows(destTable);
        expect(rows, 'tombstoned row should be hard-deleted after the switch').to.have.lengthOf(
          1,
        );
        expect(rows[0].RemoteId).to.eq(String(keep.Id));
      });

      /**
       * Un-tombstone path: a row that left the source view (tombstoned via
       * MarkDeleted) and later re-enters it should be re-upserted with
       * RemoteDeleted reset to false — matched by RemoteId, so it's the
       * SAME dest row, not a duplicate.
       */
      it('a row re-entering the source view is un-tombstoned (RemoteDeleted reset to false)', async () => {
        await createColumn(context, sourceTable, {
          title: 'Status',
          uidt: UITypes.SingleLineText,
        });
        sourceTable = (await Model.get(
          { workspace_id: workspaceId, base_id: sourceBase.id },
          sourceTable.id,
        ))!;

        const r0 = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 0,
        });
        const r1 = await createRow(context, {
          base: sourceBase,
          table: sourceTable,
          index: 1,
        });
        await updateRow(sourceTable, r0.Id, { Status: 'Active' });
        await updateRow(sourceTable, r1.Id, { Status: 'Inactive' });

        const created = await tableSyncCreate(context, destEnv, {
          title: 'ResurfaceSync',
          source_workspace_id: workspaceId,
          source_base_id: sourceBase.id,
          source_table_id: sourceTable.id,
          source_view_id: sourceView.id,
        }).expect(200);
        let settled = await waitForSyncSettled(destEnv, created.body.id);
        const destTable = await loadDestModel(mainDestTableId(settled));
        expect(await destRows(destTable)).to.have.lengthOf(2);

        // Filter source view to Active only → r1 leaves the view.
        const statusCol = (
          await sourceTable.getColumns({
            workspace_id: workspaceId,
            base_id: sourceBase.id,
          })
        ).find((c) => c.title === 'Status');
        await addContainsFilter(sourceView.id, statusCol!.id, 'Active');

        settled = await resync(created.body.id);
        let rows = await destRows(destTable);
        const tombstoned = rows.find((r) => r.RemoteId === String(r1.Id));
        expect(
          tombstoned?.RemoteDeleted,
          'r1 should be tombstoned after leaving the view',
        ).to.eq(true);

        // r1 matches the filter again → re-enters the view.
        await updateRow(sourceTable, r1.Id, { Status: 'Active' });
        settled = await resync(created.body.id);
        rows = await destRows(destTable);
        const resurfaced = rows.find((r) => r.RemoteId === String(r1.Id));
        expect(resurfaced, 'r1 dest row should still exist (same RemoteId)').to.exist;
        expect(
          resurfaced?.RemoteDeleted,
          'r1 should be un-tombstoned after re-entering the view',
        ).to.not.eq(true);
      });
    });
  });
}

export default tableSyncDataTests;
