---
name: nocohub-sync
description: |
  NocoDB Enterprise Sync feature development - data synchronization from external SaaS sources.
  MANDATORY TRIGGERS: sync, SyncConfig, SyncMapping, data sync, external sync, integration sync, scheduled sync
  Use when: (1) Adding new sync integrations, (2) Modifying sync logic, (3) Working with sync processors, (4) Sync job handling, (5) Sync schema/migrations
---

# NocoDB Sync Feature Development

> **📝 Skill Maintenance Note**
>
> While working on PRs, if you discover that any information in this skill is outdated, incorrect, or missing, **please update this skill as part of your PR**. Keeping these skills accurate helps the entire team work more efficiently with Claude. Update patterns, add new conventions, or correct any discrepancies you find.

## Overview

The Sync feature enables NocoDB to act as a central data hub by pulling data from external SaaS platforms (CRM, Ticketing, Project Management, etc.) into NocoDB tables. It's an **Enterprise Edition (EE) feature**.

### Key Capabilities

- **Full Sync**: Complete data replacement each sync cycle
- **Incremental Sync**: Only fetch changes since last sync
- **Scheduled Sync**: Cron-based automatic synchronization
- **Multi-Source Sync**: Parent-child hierarchy for syncing multiple sources to same tables
- **Schema Mapping**: Automatic table/column creation from external schemas
- **Soft Delete**: Mark deleted records instead of physical deletion

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SYNC ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐   │
│  │ SyncConfig   │───▶│ SyncMapping     │───▶│ NocoDB Tables │   │
│  │ (Parent)     │    │ (target_table   │    │ (synced=true) │   │
│  │              │    │  → fk_model_id) │    │               │   │
│  │ ┌──────────┐ │    └─────────────────┘    └───────────────┘   │
│  │ │ Children │ │                                                │
│  │ │ ┌──────┐ │ │    ┌─────────────────┐                        │
│  │ │ │ SC 1 │─┼─┼───▶│ Integration 1   │──▶ External Source 1   │
│  │ │ └──────┘ │ │    └─────────────────┘                        │
│  │ │ ┌──────┐ │ │    ┌─────────────────┐                        │
│  │ │ │ SC 2 │─┼─┼───▶│ Integration 2   │──▶ External Source 2   │
│  │ │ └──────┘ │ │    └─────────────────┘                        │
│  │ └──────────┘ │                                                │
│  └──────────────┘                                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    JOB SYSTEM                             │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────┐  │   │
│  │  │SyncModuleSync  │  │SyncModuleMigrate│  │Schedule    │  │   │
│  │  │DataProcessor   │  │SyncProcessor    │  │Processor   │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
packages/nocodb/src/
├── controllers/
│   └── sync.controller.ts           # CE REST endpoints
├── services/
│   └── sync.service.ts              # CE sync source service
├── models/
│   └── SyncSource.ts                # CE sync source model
└── ee/
    ├── controllers/
    │   └── internal.controller.ts   # EE internal operations
    ├── models/
    │   ├── SyncConfig.ts            # Main sync configuration
    │   └── SyncMapping.ts           # Table mapping
    └── integrations/sync/module/
        ├── sync.module.ts           # NestJS module
        └── services/
            ├── sync.service.ts      # Core sync logic
            ├── sync.processor.ts    # Data sync processor
            └── sync-schedule.processor.ts  # Cron scheduler

packages/nc-gui/
├── store/sync.ts                    # CE store (stubs)
├── ee/store/sync.ts                 # EE store implementation
└── utils/
    ├── syncUtils.ts                 # UI utilities
    └── syncDataUtils.ts             # Integration definitions
```

## Development Workflows

### Workflow 1: Add New Sync Integration

When adding support for a new external service (e.g., Monday.com):

1. **Create the integration package** (see nocohub-automations skill for integration patterns)
   ```
   packages/noco-integrations/integrations/monday/
   ├── index.ts
   ├── monday.integration.ts      # SyncIntegration implementation
   └── monday.auth.ts            # AuthIntegration if needed
   ```

2. **Implement SyncIntegration interface**
   ```typescript
   // monday.integration.ts
   import { SyncIntegration } from '@noco-local-integrations/core'

   export class MondaySyncIntegration extends SyncIntegration {
     // Required: Get available schemas from external source
     async getDestinationSchema(
       authWrapper: AuthIntegrationWrapper
     ): Promise<DestinationSchema> {
       const boards = await this.fetchBoards(authWrapper)
       return {
         tables: boards.map(board => ({
           name: board.name,
           key: board.id,
           columns: this.mapColumns(board.columns),
         })),
       }
     }

     // Required: Stream data from external source
     async fetchData(
       authWrapper: AuthIntegrationWrapper,
       options: FetchDataOptions
     ): Promise<Readable> {
       const stream = new PassThrough({ objectMode: true })

       for (const table of options.targetTables) {
         const data = await this.fetchBoardItems(authWrapper, table.key)

         for (const item of data) {
           stream.push({
             tableName: table.key,
             data: this.transformItem(item),
           })
         }
       }

       stream.push(null) // End stream
       return stream
     }

     // Optional: Support incremental sync
     async fetchIncrementalData(
       authWrapper: AuthIntegrationWrapper,
       options: FetchDataOptions
     ): Promise<Readable> {
       // Use options.targetTableIncrementalValues for last sync timestamps
       // Only fetch items updated since lastSyncedAt
     }
   }
   ```

3. **Register in integration index**
   ```typescript
   // packages/noco-integrations/integrations/index.ts
   export { MondaySyncIntegration } from './monday'
   ```

4. **Add to frontend integration list**
   ```typescript
   // packages/nc-gui/utils/syncDataUtils.ts
   export const syncIntegrationCategories = {
     'Project Management': [
       // ... existing
       {
         name: 'Monday',
         icon: 'monday',
         type: 'monday',
         enabled: true,
       },
     ],
   }
   ```

### Workflow 2: Modify Sync Processing Logic

When changing how data is synchronized:

1. **Understand the data flow**
   ```
   triggerSync() → Queue Job → SyncModuleSyncDataProcessor.job()
                                    │
                                    ├── Get auth credentials
                                    ├── Fetch data stream
                                    ├── Process in batches (100 records)
                                    │   ├── Map to NocoDB schema
                                    │   ├── Add system fields
                                    │   └── Upsert to database
                                    ├── Handle M2M relationships
                                    └── Delete stale records
   ```

2. **Key files to modify**
   - `sync.processor.ts` - Main data processing
   - `sync.service.ts` - Sync orchestration

3. **Batch processing pattern**
   ```typescript
   // sync.processor.ts
   const BATCH_SIZE = 100

   dataStream.on('data', async (data) => {
     dataBuffer.push(data)

     if (dataBuffer.length >= BATCH_SIZE) {
       dataStream.pause()
       await this.pushData(dataBuffer, context)
       dataBuffer = []
       dataStream.resume()
     }
   })
   ```

4. **Upsert pattern**
   ```typescript
   // Query existing by RemoteId + SyncConfigId
   const existing = await model.dataList({
     filterArr: [
       { comparison_op: 'eq', value: syncConfigId, fk_column_id: syncConfigIdCol.id },
       { comparison_op: 'in', value: remoteIds, fk_column_id: remoteIdCol.id },
     ],
   })

   // Separate insert vs update
   const existingMap = new Map(existing.map(r => [r[remoteIdCol.title], r]))

   for (const record of batch) {
     if (existingMap.has(record.RemoteId)) {
       toUpdate.push({ Id: existingMap.get(record.RemoteId).Id, ...record })
     } else {
       toInsert.push(record)
     }
   }

   // Bulk operations
   await model.dataInsert(toInsert, { skipHooks: true, allowSystemColumn: true })
   await model.dataUpdate(toUpdate, { skipHooks: true, allowSystemColumn: true })
   ```

### Workflow 3: Add New Sync Trigger Type

When adding a new sync trigger (e.g., Webhook):

1. **Update SyncTrigger enum**
   ```typescript
   // packages/nocodb/src/ee/models/SyncConfig.ts
   export enum SyncTrigger {
     Manual = 'Manual',
     Schedule = 'Schedule',
     Webhook = 'Webhook',  // Add new trigger
   }
   ```

2. **Create webhook endpoint** (if webhook trigger)
   ```typescript
   // packages/nocodb/src/ee/controllers/sync-webhook.controller.ts
   @Controller()
   export class SyncWebhookController {
     @Post('/api/v1/sync/:syncId/webhook/:secret')
     async handleWebhook(
       @Param('syncId') syncId: string,
       @Param('secret') secret: string,
     ) {
       const syncConfig = await SyncConfig.get(syncId)

       if (syncConfig.sync_trigger !== SyncTrigger.Webhook) {
         throw new BadRequestException('Sync is not configured for webhook trigger')
       }

       if (syncConfig.sync_trigger_secret !== secret) {
         throw new UnauthorizedException('Invalid webhook secret')
       }

       await this.syncService.triggerSync(syncId)
       return { success: true }
     }
   }
   ```

3. **Update frontend**
   ```typescript
   // packages/nc-gui/utils/syncUtils.ts
   export const syncTriggerOptions = [
     { value: 'Manual', label: 'Manual' },
     { value: 'Schedule', label: 'Scheduled' },
     { value: 'Webhook', label: 'Webhook' },  // Add option
   ]
   ```

### Workflow 4: Modify Sync Schema/Database

When adding new fields to sync configuration:

1. **Create migration**
   ```typescript
   // packages/nocodb/src/meta/migrations/v2/nc_XXX_sync_new_field.ts
   import type { Knex } from 'knex'
   import { MetaTable } from '~/utils/globals'

   const up = async (knex: Knex) => {
     await knex.schema.alterTable(MetaTable.SYNC_CONFIGS, (table) => {
       table.string('new_field').nullable()
       table.boolean('new_flag').defaultTo(false)
     })
   }

   const down = async (knex: Knex) => {
     await knex.schema.alterTable(MetaTable.SYNC_CONFIGS, (table) => {
       table.dropColumn('new_field')
       table.dropColumn('new_flag')
     })
   }

   export { up, down }
   ```

2. **Update SyncConfig model**
   ```typescript
   // packages/nocodb/src/ee/models/SyncConfig.ts
   export default class SyncConfig implements SyncConfigType {
     // ... existing fields
     new_field?: string
     new_flag?: boolean

     static async insert(syncConfig: Partial<SyncConfigType>, ncMeta = Noco.ncMeta) {
       const insertObj = extractProps(syncConfig, [
         // ... existing
         'new_field',
         'new_flag',
       ])
       // ...
     }
   }
   ```

3. **Update types**
   ```typescript
   // packages/nocodb-sdk/src/lib/types.ts
   export interface SyncConfigType {
     // ... existing
     new_field?: string
     new_flag?: boolean
   }
   ```

### Workflow 5: Debug Sync Issues

Common debugging approaches:

1. **Check sync job status**
   ```typescript
   // Get sync config with job info
   const syncConfig = await SyncConfig.get(syncId)
   console.log('Job ID:', syncConfig.sync_job_id)
   console.log('Last sync:', syncConfig.last_sync_at)
   console.log('Next sync:', syncConfig.next_sync_at)
   ```

2. **Trace data flow**
   ```typescript
   // In sync.processor.ts job()
   console.log('Processing sync:', syncConfig.id)
   console.log('Sync type:', syncConfig.sync_type)
   console.log('Target tables:', syncMappings.map(m => m.target_table))

   dataStream.on('data', (data) => {
     console.log('Received data for table:', data.tableName)
     console.log('Record count:', data.data.length)
   })
   ```

3. **Check system fields**
   ```sql
   -- Query synced records
   SELECT
     "RemoteId",
     "RemoteSyncedAt",
     "SyncRunId",
     "RemoteDeleted"
   FROM your_synced_table
   WHERE "SyncConfigId" = 'your-sync-config-id'
   ORDER BY "RemoteSyncedAt" DESC
   LIMIT 10;
   ```

## Key Patterns

### System Fields

Every synced table automatically gets these columns:

| Field | Type | Purpose |
|-------|------|---------|
| `RemoteId` | SingleLineText | Unique ID from external source |
| `RemoteRaw` | JSON | Raw data for re-processing |
| `RemoteSyncedAt` | DateTime | When record was synced |
| `RemoteDeleted` | Checkbox | Soft delete flag |
| `RemoteDeletedAt` | DateTime | When deletion detected |
| `RemoteNamespace` | SingleLineText | Source namespace (multi-tenant) |
| `SyncRunId` | SingleLineText | Unique per sync execution |
| `SyncConfigId` | SingleLineText | Which sync owns this record |
| `SyncProvider` | SingleLineText | Integration provider name |

### Integration Wrapper Pattern

```typescript
// Get integration wrapper
const tempIntegrationWrapper = Integration.tempIntegrationWrapper<SyncIntegration>(config)

// Get auth wrapper
const authWrapper = authIntegration.getIntegrationWrapper<AuthIntegration>()
await authWrapper.authenticate()

// Use wrappers
const schema = await wrapper.getDestinationSchema(authWrapper)
const dataStream = await wrapper.fetchData(authWrapper, options)
```

### Parent-Child Sync Pattern

```typescript
// Create parent sync (no integration)
const parentSync = await SyncConfig.insert({
  base_id: baseId,
  title: 'Multi-Source Sync',
  sync_trigger: SyncTrigger.Schedule,
  sync_trigger_cron: '0 * * * *',
})

// Create child syncs (each with integration)
for (const source of sources) {
  await SyncConfig.insert({
    fk_parent_sync_config_id: parentSync.id,
    fk_integration_id: source.integrationId,
    base_id: baseId,
  })
}

// Trigger syncs all children
await syncService.triggerSync(parentSync.id, { bulk: true })
```

### Delete Handling Pattern

```typescript
// Controlled by on_delete_action
if (syncConfig.on_delete_action === OnDeleteAction.Delete) {
  // Physical delete
  await model.dataDelete(staleRowIds)
} else {
  // Soft delete (MarkDeleted)
  await model.dataUpdate(
    staleRowIds.map(id => ({
      Id: id,
      RemoteDeleted: true,
      RemoteDeletedAt: new Date().toISOString(),
    }))
  )
}
```

## API Endpoints

### CE Endpoints (Basic)

```
GET    /api/v1/db/meta/projects/:baseId/syncs
POST   /api/v1/db/meta/projects/:baseId/syncs
PATCH  /api/v1/db/meta/syncs/:syncId
DELETE /api/v1/db/meta/syncs/:syncId
```

### EE Internal Operations

```typescript
// Via internal controller
operation: 'listSync'       // List all syncs for base
operation: 'readSync'       // Get sync config details
operation: 'createSync'     // Create new sync
operation: 'triggerSync'    // Manually trigger sync
operation: 'updateSync'     // Update sync configuration
operation: 'deleteSync'     // Delete sync and related data
operation: 'migrateSync'    // Run schema migration
```

## Job Types

```typescript
enum JobTypes {
  SyncModuleSyncData = 'sync-module-sync-data',        // Main data sync
  SyncModuleMigrateSync = 'sync-module-migrate-sync',  // Schema migration
  SyncModuleRefreshData = 'sync-module-refresh-data',  // Re-parse raw data
  SyncModuleSchedule = 'sync-module-schedule',         // Cron scheduler
}
```

## Reference Files

- **Architecture**: See [references/sync-architecture.md](references/sync-architecture.md)
- **Code Patterns**: See [references/sync-patterns.md](references/sync-patterns.md)

## Quick Scaffolding

```bash
# Create new sync integration
python .skills/nocohub-sync/scripts/scaffold-sync-integration.py monday --category "Project Management"
```
