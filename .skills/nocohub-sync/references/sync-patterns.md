# Sync Code Patterns Reference

Complete code patterns for implementing sync features in NocoDB.

## SyncIntegration Implementation

Base pattern for creating a sync integration:

```typescript
// packages/noco-integrations/integrations/myservice/myservice.integration.ts

import { PassThrough, Readable } from 'stream'
import type {
  AuthIntegrationWrapper,
  DestinationSchema,
  DestinationTable,
  FetchDataOptions,
  SyncDataRecord,
} from '@noco-local-integrations/core'
import { SyncIntegration } from '@noco-local-integrations/core'

interface MyServiceConfig {
  workspaceId?: string
  // Add service-specific config
}

export class MyServiceSyncIntegration extends SyncIntegration<MyServiceConfig> {
  /**
   * Get available tables/schemas from external source
   */
  async getDestinationSchema(
    authWrapper: AuthIntegrationWrapper
  ): Promise<DestinationSchema> {
    const client = await this.getClient(authWrapper)
    const workspaces = await client.workspaces.list()

    const tables: DestinationTable[] = []

    for (const workspace of workspaces) {
      // Only fetch from configured workspace if specified
      if (this.config.workspaceId && workspace.id !== this.config.workspaceId) {
        continue
      }

      const boards = await client.boards.list(workspace.id)

      for (const board of boards) {
        tables.push({
          name: board.name,
          key: board.id,                    // Unique identifier
          namespace: workspace.id,           // For multi-tenant sources
          columns: await this.mapBoardColumns(client, board),
        })
      }
    }

    return { tables }
  }

  /**
   * Fetch data from external source as a stream
   */
  async fetchData(
    authWrapper: AuthIntegrationWrapper,
    options: FetchDataOptions
  ): Promise<Readable> {
    const client = await this.getClient(authWrapper)
    const stream = new PassThrough({ objectMode: true })

    // Process asynchronously
    this.streamData(client, options, stream).catch(err => {
      stream.destroy(err)
    })

    return stream
  }

  /**
   * Stream data for target tables
   */
  private async streamData(
    client: MyServiceClient,
    options: FetchDataOptions,
    stream: PassThrough
  ): Promise<void> {
    for (const targetTable of options.targetTables) {
      const boardId = targetTable.key

      // Get incremental value if available
      const lastSyncedAt = options.targetTableIncrementalValues?.[boardId]

      // Fetch items (with or without incremental filter)
      const items = lastSyncedAt
        ? await client.items.listUpdatedSince(boardId, lastSyncedAt)
        : await client.items.list(boardId)

      for (const item of items) {
        const record: SyncDataRecord = {
          tableName: boardId,
          data: {
            // Map external fields to standard format
            id: item.id,
            name: item.name,
            status: item.status,
            // ... map other fields
          },
          meta: {
            remoteId: item.id,
            remoteSyncedAt: new Date().toISOString(),
            remoteNamespace: targetTable.namespace,
            remoteUpdatedAt: item.updated_at,  // For incremental sync
          },
        }

        stream.push(record)
      }
    }

    stream.push(null)  // End stream
  }

  /**
   * Map external columns to NocoDB column definitions
   */
  private async mapBoardColumns(
    client: MyServiceClient,
    board: Board
  ): Promise<DestinationColumn[]> {
    const columns = await client.columns.list(board.id)

    return columns.map(col => ({
      title: col.title,
      key: col.id,
      uidt: this.mapColumnType(col.type),
      meta: {
        // Store original type for reference
        originalType: col.type,
      },
    }))
  }

  /**
   * Map external column types to NocoDB UITypes
   */
  private mapColumnType(externalType: string): UITypes {
    const typeMap: Record<string, UITypes> = {
      'text': UITypes.SingleLineText,
      'long_text': UITypes.LongText,
      'number': UITypes.Number,
      'date': UITypes.Date,
      'datetime': UITypes.DateTime,
      'checkbox': UITypes.Checkbox,
      'dropdown': UITypes.SingleSelect,
      'multi_select': UITypes.MultiSelect,
      'email': UITypes.Email,
      'url': UITypes.URL,
      'currency': UITypes.Currency,
      'rating': UITypes.Rating,
      // Default fallback
      'default': UITypes.SingleLineText,
    }

    return typeMap[externalType] || typeMap['default']
  }

  /**
   * Get authenticated client
   */
  private async getClient(authWrapper: AuthIntegrationWrapper): Promise<MyServiceClient> {
    const credentials = await authWrapper.getCredentials()
    return new MyServiceClient({
      apiKey: credentials.apiKey,
      // or OAuth token
      accessToken: credentials.access_token,
    })
  }
}
```

## Batch Processing Pattern

```typescript
// packages/nocodb/src/ee/integrations/sync/module/services/sync.processor.ts

const BATCH_SIZE = 100

async job(data: { syncConfigId: string; context: NcContext }) {
  const syncConfig = await SyncConfig.get(data.syncConfigId)
  const syncMappings = await SyncMapping.listBySyncConfig(syncConfig.id)

  // Generate unique run ID for this sync
  const syncRunId = nanoid()

  // Get integration wrapper
  const integration = await Integration.get(syncConfig.fk_integration_id)
  const wrapper = Integration.tempIntegrationWrapper<SyncIntegration>(
    integration.config
  )

  // Get auth
  const authIntegration = await Integration.get(integration.fk_auth_integration_id)
  const authWrapper = authIntegration.getIntegrationWrapper<AuthIntegration>()
  await authWrapper.authenticate()

  // Prepare target tables with incremental values
  const targetTables = syncMappings.map(m => ({
    key: m.target_table,
    namespace: syncConfig.meta?.namespace,
  }))

  const targetTableIncrementalValues = syncConfig.sync_type === SyncType.Incremental
    ? await this.getLastSyncedValues(syncMappings)
    : undefined

  // Fetch data stream
  const dataStream = await wrapper.fetchData(authWrapper, {
    targetTables,
    targetTableIncrementalValues,
  })

  // Process stream in batches
  let dataBuffer: SyncDataRecord[] = []

  const processBuffer = async () => {
    if (dataBuffer.length === 0) return

    await this.pushData(dataBuffer, {
      syncConfig,
      syncMappings,
      syncRunId,
      context: data.context,
    })

    dataBuffer = []
  }

  return new Promise((resolve, reject) => {
    dataStream.on('data', async (record: SyncDataRecord) => {
      dataBuffer.push(record)

      if (dataBuffer.length >= BATCH_SIZE) {
        dataStream.pause()
        await processBuffer()
        dataStream.resume()
      }
    })

    dataStream.on('end', async () => {
      // Process remaining records
      await processBuffer()

      // Handle deletions for full sync
      if (syncConfig.sync_type === SyncType.Full) {
        await this.deleteStaleRecords(syncConfig, syncRunId, syncMappings)
      }

      // Update sync timestamps
      await SyncConfig.update(syncConfig.id, {
        last_sync_at: new Date().toISOString(),
        next_sync_at: syncConfig.sync_trigger === SyncTrigger.Schedule
          ? SyncConfig.calculateNextSyncAt(syncConfig.sync_trigger_cron)
          : null,
        sync_job_id: null,
      })

      resolve()
    })

    dataStream.on('error', reject)
  })
}
```

## Upsert Pattern

```typescript
async pushData(
  batch: SyncDataRecord[],
  context: {
    syncConfig: SyncConfig
    syncMappings: SyncMapping[]
    syncRunId: string
    context: NcContext
  }
): Promise<void> {
  // Group records by table
  const recordsByTable = new Map<string, SyncDataRecord[]>()

  for (const record of batch) {
    const existing = recordsByTable.get(record.tableName) || []
    existing.push(record)
    recordsByTable.set(record.tableName, existing)
  }

  // Process each table
  for (const [tableName, records] of recordsByTable) {
    const mapping = context.syncMappings.find(m => m.target_table === tableName)
    if (!mapping) continue

    const model = await Model.get(mapping.fk_model_id)
    const columns = await model.getColumns()

    // Find system columns
    const remoteIdCol = columns.find(c => c.title === 'RemoteId')
    const syncConfigIdCol = columns.find(c => c.title === 'SyncConfigId')

    // Get remote IDs from batch
    const remoteIds = records.map(r => r.meta.remoteId)

    // Query existing records
    const existing = await model.dataList({
      filterArr: [
        {
          comparison_op: 'eq',
          value: context.syncConfig.id,
          fk_column_id: syncConfigIdCol!.id,
        },
        {
          comparison_op: 'in',
          value: remoteIds.join(','),
          fk_column_id: remoteIdCol!.id,
        },
      ],
      limit: records.length,
    })

    // Create lookup map
    const existingMap = new Map(
      existing.list.map(row => [row[remoteIdCol!.title], row])
    )

    const toInsert: any[] = []
    const toUpdate: any[] = []

    for (const record of records) {
      const rowData = {
        ...record.data,
        // System fields
        RemoteId: record.meta.remoteId,
        RemoteRaw: JSON.stringify(record.data),
        RemoteSyncedAt: record.meta.remoteSyncedAt,
        RemoteNamespace: record.meta.remoteNamespace,
        SyncRunId: context.syncRunId,
        SyncConfigId: context.syncConfig.id,
        SyncProvider: context.syncConfig.integration?.title,
        RemoteDeleted: false,
      }

      const existingRow = existingMap.get(record.meta.remoteId)

      if (existingRow) {
        toUpdate.push({
          ...rowData,
          Id: existingRow.Id,  // Include PK for update
        })
      } else {
        toInsert.push(rowData)
      }
    }

    // Bulk operations
    if (toInsert.length > 0) {
      await model.dataInsert(toInsert, {
        skipHooks: true,
        allowSystemColumn: true,
        typecast: true,
      })
    }

    if (toUpdate.length > 0) {
      await model.dataUpdate(toUpdate, {
        skipHooks: true,
        allowSystemColumn: true,
        typecast: true,
      })
    }
  }
}
```

## Delete Stale Records Pattern

```typescript
async deleteStaleRecords(
  syncConfig: SyncConfig,
  syncRunId: string,
  syncMappings: SyncMapping[]
): Promise<void> {
  for (const mapping of syncMappings) {
    const model = await Model.get(mapping.fk_model_id)
    const columns = await model.getColumns()

    const syncRunIdCol = columns.find(c => c.title === 'SyncRunId')
    const syncConfigIdCol = columns.find(c => c.title === 'SyncConfigId')

    // Find records from this sync config but NOT from current run
    const staleRecords = await model.dataList({
      filterArr: [
        {
          comparison_op: 'eq',
          value: syncConfig.id,
          fk_column_id: syncConfigIdCol!.id,
        },
        {
          comparison_op: 'neq',
          value: syncRunId,
          fk_column_id: syncRunIdCol!.id,
        },
        // Only non-deleted records
        {
          comparison_op: 'eq',
          value: false,
          fk_column_id: columns.find(c => c.title === 'RemoteDeleted')!.id,
        },
      ],
    })

    if (staleRecords.list.length === 0) continue

    const staleIds = staleRecords.list.map(r => r.Id)

    if (syncConfig.on_delete_action === OnDeleteAction.Delete) {
      // Physical delete
      await model.dataDelete(staleIds, {
        skipHooks: true,
      })
    } else {
      // Soft delete (MarkDeleted)
      await model.dataUpdate(
        staleIds.map(id => ({
          Id: id,
          RemoteDeleted: true,
          RemoteDeletedAt: new Date().toISOString(),
        })),
        {
          skipHooks: true,
          allowSystemColumn: true,
        }
      )
    }
  }
}
```

## Schema Migration Pattern

```typescript
async migrateSync(data: {
  syncConfigId: string
  oldMeta: SchemaConfig
  newMeta: SchemaConfig
  context: NcContext
}): Promise<void> {
  const { oldMeta, newMeta } = data
  const syncMappings = await SyncMapping.listBySyncConfig(data.syncConfigId)

  for (const mapping of syncMappings) {
    const model = await Model.get(mapping.fk_model_id)
    const existingColumns = await model.getColumns()

    const oldTable = oldMeta.tables.find(t => t.key === mapping.target_table)
    const newTable = newMeta.tables.find(t => t.key === mapping.target_table)

    if (!oldTable || !newTable) continue

    // Find added columns
    const addedColumns = newTable.columns.filter(
      newCol => !oldTable.columns.find(oldCol => oldCol.key === newCol.key)
    )

    // Find removed columns
    const removedColumns = oldTable.columns.filter(
      oldCol => !newTable.columns.find(newCol => newCol.key === oldCol.key)
    )

    // Find changed columns
    const changedColumns = newTable.columns.filter(newCol => {
      const oldCol = oldTable.columns.find(c => c.key === newCol.key)
      return oldCol && (
        oldCol.uidt !== newCol.uidt ||
        oldCol.title !== newCol.title
      )
    })

    // Add new columns
    for (const col of addedColumns) {
      await this.columnsService.columnAdd({
        tableId: model.id,
        column: {
          title: col.title,
          uidt: col.uidt,
          readonly: true,
          meta: col.meta,
        },
      })
    }

    // Remove columns
    for (const col of removedColumns) {
      const existingCol = existingColumns.find(c =>
        c.meta?.originalKey === col.key || c.title === col.title
      )

      if (existingCol) {
        await this.columnsService.columnDelete({
          columnId: existingCol.id,
        })
      }
    }

    // Update changed columns
    for (const col of changedColumns) {
      const existingCol = existingColumns.find(c =>
        c.meta?.originalKey === col.key || c.title === col.title
      )

      if (existingCol) {
        await this.columnsService.columnUpdate({
          columnId: existingCol.id,
          column: {
            title: col.title,
            uidt: col.uidt,
            meta: { ...existingCol.meta, ...col.meta },
          },
        })
      }
    }

    // Re-parse existing data if columns changed
    if (addedColumns.length > 0 || changedColumns.length > 0) {
      await this.refreshTableData(model, data.syncConfigId)
    }
  }
}

async refreshTableData(model: Model, syncConfigId: string): Promise<void> {
  const columns = await model.getColumns()
  const remoteRawCol = columns.find(c => c.title === 'RemoteRaw')
  const syncConfigIdCol = columns.find(c => c.title === 'SyncConfigId')

  // Get all records for this sync config
  let offset = 0
  const pageSize = 100

  while (true) {
    const records = await model.dataList({
      filterArr: [{
        comparison_op: 'eq',
        value: syncConfigId,
        fk_column_id: syncConfigIdCol!.id,
      }],
      offset,
      limit: pageSize,
    })

    if (records.list.length === 0) break

    const updates = records.list.map(record => {
      const rawData = JSON.parse(record[remoteRawCol!.title] || '{}')

      return {
        Id: record.Id,
        ...rawData,  // Re-map all fields from raw
      }
    })

    await model.dataUpdate(updates, {
      skipHooks: true,
      allowSystemColumn: true,
      typecast: true,
    })

    offset += pageSize
  }
}
```

## Parent-Child Sync Pattern

```typescript
// Create multi-source sync
async createMultiSourceSync(param: {
  baseId: string
  sources: Array<{ integrationId: string; namespace?: string }>
  config: CreateSyncDto
}): Promise<SyncConfig> {
  // Create parent sync (no integration)
  const parentSync = await SyncConfig.insert({
    base_id: param.baseId,
    title: param.config.title,
    sync_type: param.config.sync_type,
    sync_trigger: param.config.sync_trigger,
    sync_trigger_cron: param.config.sync_trigger_cron,
    on_delete_action: param.config.on_delete_action,
    meta: param.config.meta,
  })

  // Create child syncs (one per source)
  const children: SyncConfig[] = []

  for (const source of param.sources) {
    const childSync = await SyncConfig.insert({
      fk_parent_sync_config_id: parentSync.id,
      fk_integration_id: source.integrationId,
      base_id: param.baseId,
      meta: {
        namespace: source.namespace,
      },
    })
    children.push(childSync)
  }

  // Fetch combined schema from all sources
  const combinedSchema = await this.getCombinedSchema(children)

  // Create tables (shared across all child syncs)
  for (const table of combinedSchema.tables) {
    const model = await this.tablesService.tableCreate({
      baseId: param.baseId,
      table: {
        title: table.name,
        columns: table.columns,
      },
    })

    // Mark as synced
    await Model.update(model.id, { synced: true })

    // Create mapping for EACH child sync
    for (const child of children) {
      await SyncMapping.insert({
        fk_sync_config_id: child.id,
        base_id: param.baseId,
        target_table: table.key,
        fk_model_id: model.id,
      })
    }
  }

  return parentSync
}

// Trigger parent sync (processes all children)
async triggerParentSync(parentSyncId: string): Promise<void> {
  const children = await SyncConfig.listChildren(parentSyncId)

  // Sync children sequentially or in parallel
  for (const child of children) {
    await this.triggerSync({ syncConfigId: child.id })
  }

  // Update parent timestamps
  const parentSync = await SyncConfig.get(parentSyncId)
  await SyncConfig.update(parentSyncId, {
    last_sync_at: new Date().toISOString(),
    next_sync_at: parentSync.sync_trigger === SyncTrigger.Schedule
      ? SyncConfig.calculateNextSyncAt(parentSync.sync_trigger_cron)
      : null,
  })
}
```

## Schedule Processor Pattern

```typescript
// packages/nocodb/src/ee/integrations/sync/module/services/sync-schedule.processor.ts

@Injectable()
export class SyncModuleSyncScheduleProcessor {
  private static MAX_SYNCS_PER_RUN = 10

  @Cron('* * * * *')  // Every minute
  async job(): Promise<void> {
    const now = new Date()

    // Find scheduled syncs that are due
    const dueSyncs = await SyncConfig.list({
      where: {
        sync_trigger: SyncTrigger.Schedule,
        next_sync_at: { lte: now },
        // Not already running
        sync_job_id: null,
      },
      limit: SyncModuleSyncScheduleProcessor.MAX_SYNCS_PER_RUN,
      orderBy: { next_sync_at: 'asc' },
    })

    for (const syncConfig of dueSyncs) {
      try {
        // Check if it's a parent or child sync
        if (syncConfig.fk_parent_sync_config_id) {
          // Skip children - they're triggered by parent
          continue
        }

        const hasChildren = await SyncConfig.listChildren(syncConfig.id)

        if (hasChildren.length > 0) {
          // Trigger parent (which triggers all children)
          await this.syncService.triggerSync({
            syncConfigId: syncConfig.id,
            bulk: true,
          })
        } else {
          // Trigger standalone sync
          await this.syncService.triggerSync({
            syncConfigId: syncConfig.id,
          })
        }
      } catch (error) {
        console.error(`Failed to trigger scheduled sync ${syncConfig.id}:`, error)

        // Still update next_sync_at to avoid repeated failures
        await SyncConfig.update(syncConfig.id, {
          next_sync_at: SyncConfig.calculateNextSyncAt(syncConfig.sync_trigger_cron),
        })
      }
    }
  }
}

// Calculate next sync time from cron expression
static calculateNextSyncAt(cronExpression: string): Date {
  const parser = require('cron-parser')
  const interval = parser.parseExpression(cronExpression)
  return interval.next().toDate()
}
```

## Frontend Store Pattern

```typescript
// packages/nc-gui/ee/store/sync.ts

export const useSyncStore = defineStore('syncStore', () => {
  const { api } = useApi()
  const { base } = useBase()

  // State
  const baseSyncs = ref<Map<string, SyncConfig[]>>(new Map())
  const isLoadingSync = ref(false)
  const currentSyncJob = ref<{ id: string; status: string } | null>(null)

  // Computed
  const activeBaseSyncs = computed(() => {
    if (!base.value?.id) return []
    return baseSyncs.value.get(base.value.id) || []
  })

  const isSyncFeatureEnabled = computed(() => {
    // Check EE feature flag
    return useGlobal().appInfo.value?.ee === true
  })

  // Actions
  async function loadSyncs(baseId: string, force = false) {
    if (!force && baseSyncs.value.has(baseId)) return

    isLoadingSync.value = true
    try {
      const syncs = await api.internal.call('listSync', { baseId })
      baseSyncs.value.set(baseId, syncs)
    } finally {
      isLoadingSync.value = false
    }
  }

  async function createSync(baseId: string, payload: CreateSyncDto) {
    const sync = await api.internal.call('createSync', { baseId, ...payload })

    // Update local state
    const existing = baseSyncs.value.get(baseId) || []
    baseSyncs.value.set(baseId, [...existing, sync])

    return sync
  }

  async function triggerSync(baseId: string, syncConfigId: string, bulk = false) {
    const result = await api.internal.call('triggerSync', {
      syncConfigId,
      bulk,
    })

    currentSyncJob.value = { id: result.jobId, status: 'running' }

    // Poll for completion
    pollJobStatus(result.jobId)

    return result
  }

  async function pollJobStatus(jobId: string) {
    const poll = async () => {
      const job = await api.jobs.status(jobId)
      currentSyncJob.value = { id: jobId, status: job.status }

      if (job.status === 'completed' || job.status === 'failed') {
        // Reload syncs to get updated timestamps
        await loadSyncs(base.value!.id, true)
      } else {
        // Continue polling
        setTimeout(poll, 2000)
      }
    }

    poll()
  }

  async function deleteSync(baseId: string, syncConfigId: string) {
    await api.internal.call('deleteSync', { syncConfigId })

    // Update local state
    const existing = baseSyncs.value.get(baseId) || []
    baseSyncs.value.set(
      baseId,
      existing.filter(s => s.id !== syncConfigId)
    )
  }

  return {
    baseSyncs,
    isLoadingSync,
    currentSyncJob,
    activeBaseSyncs,
    isSyncFeatureEnabled,
    loadSyncs,
    createSync,
    triggerSync,
    deleteSync,
  }
})
```
