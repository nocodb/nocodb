import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { OnDeleteAction, SyncType } from 'nocodb-sdk';
import init from '~test/init';
import { isPgData } from '~test/init/db';
import { isEE } from '~test/utils/helpers';
import { createProject } from '~test/factory/base';
import { internalPost } from '~test/factory/internal';
import { listRow } from '~test/factory/row';
import {
  buildSyncIntegrationConfig,
  createCustomSync,
  createPgAuthIntegration,
  fetchDestinationSchema,
  readSyncConfig,
  sourceKnex,
  triggerSyncAndWait,
  waitForSyncRun,
} from '~test/factory/customSync';
import type { Knex } from 'knex';
import Integration from '~/models/Integration';
import Model from '~/models/Model';
import View from '~/models/View';

/**
 * Custom Sync (external-DB app sync) E2E tests.
 *
 * The "external" source is a throwaway schema in the unit-test PG itself,
 * reached through a real postgres-auth integration, so the full production
 * pipeline runs: introspection (incl. updated-at auto-detection) → createSync
 * table creation (system fields) → job-based data sync → stale-record
 * deletion semantics → incremental cursor → mapping suspension.
 *
 * PG-only: custom DB sync introspects/queries a postgres source.
 */
function customSyncDataTests() {
  if (!isEE()) {
    return;
  }

  describe('Custom Sync — external postgres source', function () {
    let context: Awaited<ReturnType<typeof init>>;
    let workspaceId: string;
    let base: any;
    let env: { workspaceId: string; baseId: string };
    let db: Knex;
    let authIntegrationId: string;
    let prevSsrfEnv: string | undefined;

    const createdSchemas: string[] = [];
    let schemaSeq = 0;

    /** Fresh, empty source schema for a single test. */
    async function createSourceSchema(): Promise<string> {
      const name = `cs_src_${Date.now()}_${schemaSeq++}`;
      await db.raw('create schema ??', [name]);
      createdSchemas.push(name);
      return name;
    }

    /** Introspect via the UI's internal op and create the sync, mirroring
     *  the production create flow (custom_schema persisted on the config). */
    async function setupSync(args: {
      schema: string;
      tables: string[];
      sync_type: SyncType;
      on_delete_action: OnDeleteAction;
      title: string;
    }) {
      const integration = buildSyncIntegrationConfig({
        authIntegrationId,
        schema: args.schema,
        tables: args.tables,
      });

      const customSchema = await fetchDestinationSchema(
        context,
        env,
        integration,
      );

      const created = await createCustomSync(context, env, {
        title: args.title,
        sync_type: args.sync_type,
        on_delete_action: args.on_delete_action,
        integration: buildSyncIntegrationConfig({
          authIntegrationId,
          schema: args.schema,
          tables: args.tables,
          custom_schema: customSchema,
        }),
      });

      await waitForSyncRun(env, created.syncConfig.id, null);

      const sync = await readSyncConfig(context, env, created.syncConfig.id);

      return { sync, customSchema };
    }

    function mappingFor(sync: any, targetTable: string) {
      const mapping = (sync.mappings ?? []).find(
        (m: any) => m.target_table === targetTable,
      );
      expect(mapping, `mapping for "${targetTable}" should exist`).to.exist;
      return mapping;
    }

    async function destModel(fkModelId: string): Promise<Model> {
      const ctx = { workspace_id: workspaceId, base_id: base.id };
      const model = await Model.get(ctx, fkModelId);
      expect(model, `dest model ${fkModelId} should exist`).to.exist;
      await model.getColumns(ctx);
      return model;
    }

    async function destRows(model: Model): Promise<any[]> {
      return (await listRow({
        base,
        table: model,
        options: { limit: 100 },
      })) as any[];
    }

    before(async function () {
      context = await init();
      if (!isPgData(context)) {
        this.skip();
      }

      // The postgres-auth SSRF guard rejects localhost — the unit-test PG IS
      // local, so allow local external DBs for the duration of the suite.
      prevSsrfEnv = process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS;
      process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS = 'true';

      workspaceId = context.fk_workspace_id!;
      base = await createProject(context, { title: 'CustomSyncBase' });
      env = { workspaceId, baseId: base.id };

      db = sourceKnex(context);

      const auth = await createPgAuthIntegration(context);
      authIntegrationId = auth.id;
    });

    after(async function () {
      if (prevSsrfEnv === undefined) {
        delete process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS;
      } else {
        process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS = prevSsrfEnv;
      }

      if (db) {
        for (const schema of createdSchemas) {
          await db.raw('drop schema if exists ?? cascade', [schema]);
        }
        await db.destroy();
      }
    });

    it('syncs schema and data from the source', async () => {
      const schema = await createSourceSchema();

      await db.schema.withSchema(schema).createTable('customer', (t) => {
        t.integer('customer_id').primary();
        t.text('full_name');
        t.specificType('last_update', 'timestamptz');
      });
      await db
        .withSchema(schema)
        .table('customer')
        .insert([
          { customer_id: 1, full_name: 'Alice', last_update: '2024-01-01T00:00:00Z' },
          { customer_id: 2, full_name: 'Bob', last_update: '2024-01-02T00:00:00Z' },
          { customer_id: 3, full_name: 'Carol', last_update: '2024-01-03T00:00:00Z' },
        ]);

      const { sync, customSchema } = await setupSync({
        schema,
        tables: ['customer'],
        sync_type: SyncType.Full,
        on_delete_action: OnDeleteAction.MarkDeleted,
        title: 'CS basic',
      });

      // Introspection auto-detects the primary key AND the updated-at cursor
      // column (detectUpdatedAtColumn) — the UI shows both pre-selected.
      expect(customSchema.customer.systemFields.primaryKey).to.deep.equal([
        'customer_id',
      ]);
      expect(customSchema.customer.systemFields.updatedAt).to.equal(
        'last_update',
      );

      const mapping = mappingFor(sync, 'customer');
      const model = await destModel(mapping.fk_model_id);

      // Sync system fields are marked `system` so every view hides them and
      // the field list filters them — same contract as table sync.
      for (const title of ['RemoteId', 'RemoteDeleted', 'RemoteDeletedTime', 'SyncRunId']) {
        const col = model.columns.find((c) => c.title === title);
        expect(col, `system column ${title} should exist`).to.exist;
        expect(!!col!.system, `${title} should be a system column`).to.equal(true);
      }

      // ... and they are hidden in the default view.
      const ctx = { workspace_id: workspaceId, base_id: base.id };
      const defaultView = await View.getFirstCollaborativeView(ctx, model.id);
      const viewColumns = await defaultView.getColumns(ctx);
      const remoteIdCol = model.columns.find((c) => c.title === 'RemoteId')!;
      const remoteIdViewCol = viewColumns.find(
        (vc) => vc.fk_column_id === remoteIdCol.id,
      );
      expect(remoteIdViewCol, 'RemoteId view column should exist').to.exist;
      expect(!!remoteIdViewCol!.show, 'RemoteId should be hidden').to.equal(false);

      // Data landed.
      const rows = await destRows(model);
      expect(rows).to.have.length(3);
      expect(rows.map((r) => r.full_name).sort()).to.deep.equal([
        'Alice',
        'Bob',
        'Carol',
      ]);
      for (const row of rows) {
        expect(row.RemoteId, 'RemoteId should be stamped').to.be.ok;
      }
    });

    it('creates and syncs tables added to an existing sync via updateSync', async () => {
      const schema = await createSourceSchema();

      await db.schema.withSchema(schema).createTable('customer', (t) => {
        t.integer('customer_id').primary();
        t.text('full_name');
      });
      await db.schema.withSchema(schema).createTable('staff', (t) => {
        t.integer('staff_id').primary();
        t.text('staff_name');
      });
      await db
        .withSchema(schema)
        .table('customer')
        .insert([{ customer_id: 1, full_name: 'Alice' }]);
      await db
        .withSchema(schema)
        .table('staff')
        .insert([
          { staff_id: 1, staff_name: 'Mike' },
          { staff_id: 2, staff_name: 'Jon' },
        ]);

      // Initial sync covers only `customer`.
      const { sync } = await setupSync({
        schema,
        tables: ['customer'],
        sync_type: SyncType.Full,
        on_delete_action: OnDeleteAction.MarkDeleted,
        title: 'CS update-adds-table',
      });
      expect((sync.mappings ?? []).map((m: any) => m.target_table)).to.deep.equal(
        ['customer'],
      );

      // The user adds `staff` — the UI re-derives custom_schema to cover the
      // new selection and sends both tables.
      const bothSchema = await fetchDestinationSchema(
        context,
        env,
        buildSyncIntegrationConfig({
          authIntegrationId,
          schema,
          tables: ['customer', 'staff'],
        }),
      );

      await internalPost(
        context,
        env,
        { operation: 'updateSync' },
        {
          syncConfigId: sync.id,
          title: sync.title,
          sync_type: sync.sync_type,
          sync_trigger: sync.sync_trigger,
          on_delete_action: sync.on_delete_action,
          sync_category: sync.sync_category,
          config: [
            {
              id: sync.fk_integration_id,
              type: 'sync',
              sub_type: 'postgres',
              title: sync.title,
              syncConfigId: sync.id,
              config: {
                authIntegrationId,
                schema,
                tables: ['customer', 'staff'],
                custom_schema: bothSchema,
              },
            },
          ],
          meta: { sync_all_models: true, sync_excluded_models: [] },
        },
      ).expect(200);

      // The new table + mapping exist right after the update…
      const updated = await readSyncConfig(context, env, sync.id);
      const staffMapping = mappingFor(updated, 'staff');
      const staffModel = await destModel(staffMapping.fk_model_id);

      const staffSystemCol = staffModel.columns.find(
        (c) => c.title === 'RemoteId',
      );
      expect(!!staffSystemCol?.system).to.equal(true);

      // … and a manual sync fills it with data.
      await triggerSyncAndWait(context, env, sync.id);

      const staffRows = await destRows(staffModel);
      expect(staffRows.map((r) => r.staff_name).sort()).to.deep.equal([
        'Jon',
        'Mike',
      ]);
    });

    it('hard-deletes stale records on a full sync with on_delete_action=delete', async () => {
      const schema = await createSourceSchema();

      await db.schema.withSchema(schema).createTable('orders', (t) => {
        t.integer('order_id').primary();
        t.text('item');
      });
      await db
        .withSchema(schema)
        .table('orders')
        .insert([
          { order_id: 1, item: 'keep-1' },
          { order_id: 2, item: 'remove-me' },
          { order_id: 3, item: 'keep-2' },
        ]);

      const { sync } = await setupSync({
        schema,
        tables: ['orders'],
        sync_type: SyncType.Full,
        on_delete_action: OnDeleteAction.Delete,
        title: 'CS full delete',
      });

      const model = await destModel(mappingFor(sync, 'orders').fk_model_id);
      expect(await destRows(model)).to.have.length(3);

      await db.withSchema(schema).table('orders').where('order_id', 2).delete();

      await triggerSyncAndWait(context, env, sync.id);

      const rows = await destRows(model);
      expect(rows).to.have.length(2);
      expect(rows.map((r) => r.item).sort()).to.deep.equal(['keep-1', 'keep-2']);
    });

    it('marks stale records (RemoteDeleted + RemoteDeletedTime) on a full sync with on_delete_action=mark_deleted', async () => {
      const schema = await createSourceSchema();

      await db.schema.withSchema(schema).createTable('tickets', (t) => {
        t.integer('ticket_id').primary();
        t.text('subject');
      });
      await db
        .withSchema(schema)
        .table('tickets')
        .insert([
          { ticket_id: 1, subject: 'stays' },
          { ticket_id: 2, subject: 'deleted-at-source' },
        ]);

      const { sync } = await setupSync({
        schema,
        tables: ['tickets'],
        sync_type: SyncType.Full,
        on_delete_action: OnDeleteAction.MarkDeleted,
        title: 'CS full mark-deleted',
      });

      const model = await destModel(mappingFor(sync, 'tickets').fk_model_id);

      await db
        .withSchema(schema)
        .table('tickets')
        .where('ticket_id', 2)
        .delete();

      await triggerSyncAndWait(context, env, sync.id);

      const rows = await destRows(model);
      expect(rows, 'mark_deleted keeps the record').to.have.length(2);

      const deleted = rows.find((r) => r.subject === 'deleted-at-source');
      const kept = rows.find((r) => r.subject === 'stays');

      expect(!!deleted.RemoteDeleted, 'RemoteDeleted should be set').to.equal(
        true,
      );
      // Regression: the processor used to write `RemoteDeletedAt`, which the
      // alias mapper silently dropped — the timestamp must actually persist.
      expect(
        deleted.RemoteDeletedTime,
        'RemoteDeletedTime should be stamped',
      ).to.be.ok;

      expect(!!kept.RemoteDeleted).to.equal(false);
      expect(kept.RemoteDeletedTime).to.not.be.ok;
    });

    it('still deletes stale records on an incremental sync when the table has no updated-at cursor', async () => {
      const schema = await createSourceSchema();

      // No updated-at candidate column → no cursor → every run is a full
      // fetch, so the stale diff is valid even though sync_type=incremental.
      await db.schema.withSchema(schema).createTable('gadgets', (t) => {
        t.integer('gadget_id').primary();
        t.text('label');
      });
      await db
        .withSchema(schema)
        .table('gadgets')
        .insert([
          { gadget_id: 1, label: 'a' },
          { gadget_id: 2, label: 'b' },
          { gadget_id: 3, label: 'c' },
        ]);

      const { sync, customSchema } = await setupSync({
        schema,
        tables: ['gadgets'],
        sync_type: SyncType.Incremental,
        on_delete_action: OnDeleteAction.Delete,
        title: 'CS incremental no-cursor',
      });

      expect(customSchema.gadgets.systemFields.updatedAt).to.equal(undefined);

      const model = await destModel(mappingFor(sync, 'gadgets').fk_model_id);
      expect(await destRows(model)).to.have.length(3);

      await db
        .withSchema(schema)
        .table('gadgets')
        .where('gadget_id', 2)
        .delete();

      await triggerSyncAndWait(context, env, sync.id);

      const rows = await destRows(model);
      expect(rows).to.have.length(2);
      expect(rows.map((r) => r.label).sort()).to.deep.equal(['a', 'c']);
    });

    it('applies the incremental cursor — only changed records re-sync, stale deletion is skipped', async () => {
      const schema = await createSourceSchema();

      await db.schema.withSchema(schema).createTable('inventory', (t) => {
        t.integer('inv_id').primary();
        t.text('label');
        t.specificType('last_update', 'timestamptz');
      });
      await db
        .withSchema(schema)
        .table('inventory')
        .insert([
          { inv_id: 1, label: 'one', last_update: '2024-01-01T00:00:00Z' },
          { inv_id: 2, label: 'two', last_update: '2024-01-02T00:00:00Z' },
          { inv_id: 3, label: 'three', last_update: '2024-01-03T00:00:00Z' },
        ]);

      const { sync, customSchema } = await setupSync({
        schema,
        tables: ['inventory'],
        sync_type: SyncType.Incremental,
        on_delete_action: OnDeleteAction.Delete,
        title: 'CS incremental cursor',
      });

      expect(customSchema.inventory.systemFields.updatedAt).to.equal(
        'last_update',
      );

      const model = await destModel(mappingFor(sync, 'inventory').fk_model_id);

      const firstRun = await destRows(model);
      expect(firstRun).to.have.length(3);
      const runIdByInvId = new Map(
        firstRun.map((r) => [r.inv_id, r.SyncRunId]),
      );

      // Change record 1 (bumping the cursor column), delete record 3.
      await db
        .withSchema(schema)
        .table('inventory')
        .where('inv_id', 1)
        .update({ label: 'one-updated', last_update: '2030-01-01T00:00:00Z' });
      await db
        .withSchema(schema)
        .table('inventory')
        .where('inv_id', 3)
        .delete();

      await triggerSyncAndWait(context, env, sync.id);

      const rows = await destRows(model);
      const byInvId = new Map(rows.map((r) => [r.inv_id, r]));

      // Changed record was re-fetched…
      expect(byInvId.get(1).label).to.equal('one-updated');
      expect(byInvId.get(1).SyncRunId).to.not.equal(runIdByInvId.get(1));

      // …unchanged record was NOT touched (cursor applied → partial fetch)…
      expect(byInvId.get(2).SyncRunId).to.equal(runIdByInvId.get(2));

      // …and the source-deleted record survives: a partial fetch can't be
      // diffed, so stale deletion is (correctly) skipped despite
      // on_delete_action=delete.
      expect(rows).to.have.length(3);
      expect(!!byInvId.get(3).RemoteDeleted).to.equal(false);
    });

    it('hard-deletes a table removed from the sync; re-adding creates a fresh table', async () => {
      const schema = await createSourceSchema();

      await db.schema.withSchema(schema).createTable('alpha', (t) => {
        t.integer('alpha_id').primary();
        t.text('alpha_name');
      });
      await db.schema.withSchema(schema).createTable('beta', (t) => {
        t.integer('beta_id').primary();
        t.text('beta_name');
      });
      await db
        .withSchema(schema)
        .table('alpha')
        .insert([{ alpha_id: 1, alpha_name: 'a1' }]);
      await db
        .withSchema(schema)
        .table('beta')
        .insert([
          { beta_id: 1, beta_name: 'b1' },
          { beta_id: 2, beta_name: 'b2' },
        ]);

      const { sync } = await setupSync({
        schema,
        tables: ['alpha', 'beta'],
        sync_type: SyncType.Full,
        on_delete_action: OnDeleteAction.MarkDeleted,
        title: 'CS remove detaches',
      });

      const betaMapping = mappingFor(sync, 'beta');
      const betaModelId = betaMapping.fk_model_id;
      const ctx = { workspace_id: workspaceId, base_id: base.id };

      function updateSyncPayload(tables: string[], customSchema: any) {
        return {
          syncConfigId: sync.id,
          title: sync.title,
          sync_type: sync.sync_type,
          sync_trigger: sync.sync_trigger,
          on_delete_action: sync.on_delete_action,
          sync_category: sync.sync_category,
          config: [
            {
              id: sync.fk_integration_id,
              type: 'sync',
              sub_type: 'postgres',
              title: sync.title,
              syncConfigId: sync.id,
              config: {
                authIntegrationId,
                schema,
                tables,
                custom_schema: customSchema,
              },
            },
          ],
          meta: { sync_all_models: true, sync_excluded_models: [] },
        };
      }

      // Remove `beta` from the sync — the sync owns its dest tables, so the
      // unselected table is hard-deleted (no trash) along with its mapping.
      const alphaOnlySchema = await fetchDestinationSchema(
        context,
        env,
        buildSyncIntegrationConfig({
          authIntegrationId,
          schema,
          tables: ['alpha'],
        }),
      );

      await internalPost(
        context,
        env,
        { operation: 'updateSync' },
        updateSyncPayload(['alpha'], alphaOnlySchema),
      ).expect(200);

      const removed = await Model.get(ctx, betaModelId);
      expect(removed, 'unselected table is hard-deleted').to.not.exist;

      const afterRemove = await readSyncConfig(context, env, sync.id);
      expect(
        (afterRemove.mappings ?? []).filter(
          (m: any) => m.target_table === 'beta',
        ),
      ).to.have.length(0);

      // Re-adding the source table creates a FRESH destination table.
      const bothSchema = await fetchDestinationSchema(
        context,
        env,
        buildSyncIntegrationConfig({
          authIntegrationId,
          schema,
          tables: ['alpha', 'beta'],
        }),
      );

      await internalPost(
        context,
        env,
        { operation: 'updateSync' },
        updateSyncPayload(['alpha', 'beta'], bothSchema),
      ).expect(200);

      const afterReAdd = await readSyncConfig(context, env, sync.id);
      const betaMappings = (afterReAdd.mappings ?? []).filter(
        (m: any) => m.target_table === 'beta',
      );
      expect(betaMappings).to.have.length(1);
      expect(betaMappings[0].fk_model_id).to.not.equal(betaModelId);

      await triggerSyncAndWait(context, env, sync.id);

      const fresh = await destModel(betaMappings[0].fk_model_id);
      expect((await destRows(fresh)).map((r) => r.beta_name).sort()).to.deep.equal(
        ['b1', 'b2'],
      );
    });

    it('blocks deleting a synced table until it is converted to a regular table', async () => {
      const schema = await createSourceSchema();

      await db.schema.withSchema(schema).createTable('vendors', (t) => {
        t.integer('vendor_id').primary();
        t.text('vendor_name');
      });
      await db
        .withSchema(schema)
        .table('vendors')
        .insert([{ vendor_id: 1, vendor_name: 'Acme' }]);

      const { sync } = await setupSync({
        schema,
        tables: ['vendors'],
        sync_type: SyncType.Full,
        on_delete_action: OnDeleteAction.MarkDeleted,
        title: 'CS detach op',
      });

      const mapping = mappingFor(sync, 'vendors');
      const ctx = { workspace_id: workspaceId, base_id: base.id };

      // Synced tables never enter trash — delete is blocked.
      await request(context.app)
        .delete(`/api/v2/meta/tables/${mapping.fk_model_id}`)
        .set('xc-auth', context.token)
        .expect(400);

      // Convert to regular table (detach op).
      await internalPost(
        context,
        env,
        { operation: 'detachSyncTable' },
        { modelId: mapping.fk_model_id },
      ).expect(200);

      const after = await readSyncConfig(context, env, sync.id);
      expect(
        (after.mappings ?? []).filter(
          (m: any) => m.target_table === 'vendors',
        ),
      ).to.have.length(0);

      const model = await Model.get(ctx, mapping.fk_model_id);
      expect(!!model!.synced).to.equal(false);
      await model!.getColumns(ctx);
      expect(model!.columns.some((c) => c.readonly)).to.equal(false);

      // The integration's selection no longer references the table.
      const integration = await Integration.get(ctx, sync.fk_integration_id);
      const config = await integration.getConfig();
      expect(config.tables).to.not.include('vendors');
      expect(Object.keys(config.custom_schema ?? {})).to.not.include('vendors');

      // Now it's a regular table — deleting works.
      await request(context.app)
        .delete(`/api/v2/meta/tables/${mapping.fk_model_id}`)
        .set('xc-auth', context.token)
        .expect(200);
    });

    it('deleteSync keeps tables as regular tables by default and drops them with dropTables', async () => {
      const schema = await createSourceSchema();
      const ctx = { workspace_id: workspaceId, base_id: base.id };

      // Default: deleting the sync detaches its tables (data preserved).
      await db.schema.withSchema(schema).createTable('keep_me', (t) => {
        t.integer('keep_id').primary();
        t.text('keep_name');
      });
      await db
        .withSchema(schema)
        .table('keep_me')
        .insert([{ keep_id: 1, keep_name: 'k1' }]);

      const { sync } = await setupSync({
        schema,
        tables: ['keep_me'],
        sync_type: SyncType.Full,
        on_delete_action: OnDeleteAction.MarkDeleted,
        title: 'CS delete keeps',
      });
      const keepModelId = mappingFor(sync, 'keep_me').fk_model_id;

      await internalPost(
        context,
        env,
        { operation: 'deleteSync' },
        { id: sync.id, dropTables: false },
      ).expect(200);

      const kept = await Model.get(ctx, keepModelId);
      expect(kept, 'table survives sync deletion').to.exist;
      expect(!!kept!.synced).to.equal(false);
      await kept!.getColumns(ctx);
      expect(kept!.columns.some((c) => c.readonly)).to.equal(false);
      expect(await destRows(kept!)).to.have.length(1);

      // dropTables: the destination table goes away with the sync.
      await db.schema.withSchema(schema).createTable('drop_me', (t) => {
        t.integer('drop_id').primary();
        t.text('drop_name');
      });
      await db
        .withSchema(schema)
        .table('drop_me')
        .insert([{ drop_id: 1, drop_name: 'd1' }]);

      const { sync: sync2 } = await setupSync({
        schema,
        tables: ['drop_me'],
        sync_type: SyncType.Full,
        on_delete_action: OnDeleteAction.MarkDeleted,
        title: 'CS delete drops',
      });
      const dropModelId = mappingFor(sync2, 'drop_me').fk_model_id;

      await internalPost(
        context,
        env,
        { operation: 'deleteSync' },
        { id: sync2.id, dropTables: true },
      ).expect(200);

      expect(
        await Model.get(ctx, dropModelId),
        'dropped table is gone',
      ).to.not.exist;
    });
  });
}

export default customSyncDataTests;
