---
name: nocohub-sync
description: Data sync feature — pulling data from external SaaS sources into NocoDB tables. Use when adding sync integrations, modifying sync processing, working with SyncConfig/SyncMapping, or debugging sync jobs.
---

# Sync Feature Development

Sync is an **EE-only feature** that pulls data from external SaaS platforms (CRM, ticketing, project management) into NocoDB tables.

## Architecture

```
SyncConfig (parent) ──→ SyncMapping ──→ NocoDB Tables (synced=true)
    │
    ├── Child SC 1 ──→ Integration 1 ──→ External Source 1
    └── Child SC 2 ──→ Integration 2 ──→ External Source 2

Job System:
  SyncModuleSyncDataProcessor      — main data sync + schema migration (.migrateSync())
  SyncModuleSyncScheduleProcessor  — cron scheduler
```

## File Structure

```
packages/nocodb/src/
├── controllers/sync.controller.ts          # CE REST endpoints
├── services/sync.service.ts                # CE sync source service
├── models/SyncSource.ts                    # CE model
└── ee/
    ├── models/SyncConfig.ts                # EE sync configuration
    ├── models/SyncMapping.ts               # EE table mapping
    └── integrations/sync/module/
        ├── sync.module.ts                  # NestJS module
        └── services/
            ├── sync.service.ts             # Core sync logic
            ├── sync.processor.ts           # Data processor
            └── sync-schedule.processor.ts  # Cron scheduler

packages/nc-gui/
├── store/sync.ts                           # CE store (stubs)
├── ee/store/sync.ts                        # EE store
└── utils/syncDataUtils.ts                  # Integration definitions
```

## Adding a New Sync Integration

1. **Create integration package** extending `SyncIntegration`:

```typescript
export class ProviderSyncIntegration extends SyncIntegration {
  // Required: return schema of tables/columns from external source
  async getDestinationSchema(auth: AuthIntegration): Promise<SyncSchema | CustomSyncSchema> { ... }

  // Required: stream data as DataObjects (handles both full + incremental via args)
  async fetchData(auth: AuthIntegration, args: {
    targetTables?: string[];
    targetTableIncrementalValues?: Record<string, string | number>;  // for incremental sync
  }): Promise<DataObjectStream<SyncRecord>> { ... }
}
```

**For a complete working example, read an existing integration in** `packages/noco-integrations/packages/`

2. **Export `IntegrationEntry`** from package `src/index.ts` (type: `IntegrationType.Sync`)

3. **Add to frontend** in `packages/nc-gui/utils/syncDataUtils.ts` → `integrationCategories`

## Data Flow

```
triggerSync() → Queue Job → SyncModuleSyncDataProcessor.job()
  → Get auth credentials
  → Fetch data stream
  → Process in batches (100 records)
      → Map to NocoDB schema
      → Add system fields
      → Upsert: query by RemoteId + SyncConfigId, separate insert/update
  → Handle M2M relationships
  → Delete stale records (soft or hard based on on_delete_action)
```

### Batch Stream Pattern

```typescript
// sync.processor.ts — backpressure-aware batching
// BATCH_SIZE defaults to wrapper.batchSize (100 unless overridden by integration)
if (dataBuffer.length >= BATCH_SIZE) {
  dataStream.pause();
  await this.pushData(context, syncConfig, model, dataBuffer.splice(0), req);
  dataStream.resume();
}
```

### Integration Wrapper Pattern

```typescript
// Get sync wrapper (for data operations)
const wrapper = await integration.getIntegrationWrapper<SyncIntegration>();

// Get auth wrapper (for authenticated API calls)
const authWrapper = await authIntegration.getIntegrationWrapper<AuthIntegration>();
await authWrapper.authenticate();

const schema = await wrapper.getDestinationSchema(authWrapper);
const dataStream = await wrapper.fetchData(authWrapper, options);

// Temp wrapper (metadata only — e.g. getTitle(), getNamespaces())
const temp = Integration.tempIntegrationWrapper<SyncIntegration>(config);
```

## System Fields

Every synced table gets these columns automatically:

| Field | UIType | Purpose |
|-------|--------|---------|
| `RemoteId` | SingleLineText | Unique ID from external source |
| `RemoteCreatedAt` | DateTime | Creation time in external source |
| `RemoteUpdatedAt` | DateTime | Last update time in external source |
| `RemoteDeletedTime` | DateTime | When deletion detected |
| `RemoteDeleted` | Checkbox | Soft delete flag |
| `RemoteRaw` | LongText | Raw data for re-processing |
| `RemoteSyncedAt` | DateTime | When record was synced |
| `RemoteNamespace` | SingleLineText | Source namespace |
| `SyncConfigId` | SingleLineText | Which sync owns this record |
| `SyncRunId` | SingleLineText | Unique per sync execution |
| `SyncProvider` | SingleLineText | Integration provider name |

> Note: TypeScript interface uses `RemoteDeletedAt` but column title is `RemoteDeletedTime` (codebase inconsistency).

## Key Enums

```typescript
enum SyncType { Full, Incremental }
enum SyncTrigger { Manual, Schedule, Webhook }
enum OnDeleteAction { Delete, MarkDeleted }
enum JobTypes {
  SyncModuleSyncData = 'sync-module-sync-data',
  SyncModuleMigrateSync = 'sync-module-migrate-sync',
  SyncModuleRefreshData = 'sync-module-refresh-data',
  SyncModuleSchedule = 'sync-module-schedule',
}
```

## Modifying Sync Schema

1. Create migration in `src/meta/migrations/v0/` (NOT v1/v2/v3 — those are deprecated)
2. Update `SyncConfig` model in `src/ee/models/SyncConfig.ts`
3. Update SDK types in `packages/nocodb-sdk`
4. Rebuild SDK

## Parent-Child Sync

Parent SyncConfig has no integration — it groups children. Each child has its own integration. Triggering parent syncs all children: `syncService.triggerSync(parentId, { bulk: true })`

## Delete Handling

Controlled by `on_delete_action` on SyncConfig:
- `Delete` — physical delete of stale records
- `MarkDeleted` — sets `RemoteDeleted=true`, `RemoteDeletedAt=now`

## Database Schema

```
nc_sync_configs: id, fk_workspace_id, base_id, fk_integration_id, fk_parent_sync_config_id,
  title, sync_category, sync_type, sync_trigger, sync_trigger_cron, sync_trigger_secret,
  sync_job_id, on_delete_action, last_sync_at, next_sync_at, meta (JSON)

nc_sync_mappings: id, fk_workspace_id, base_id, fk_sync_config_id, target_table, fk_model_id
```

Synced tables get: `nc_models.synced = true`, `nc_columns.readonly = true` (for mapped columns).

## ACL

```
owner, creator         → createSync, updateSync, deleteSync, triggerSync
owner, creator, editor, viewer, commenter → listSync, readSync
```

## Scaffolding

```bash
python .claude/skills/nocohub-sync/scripts/scaffold-sync-integration.py monday --category "Project Management"
```
