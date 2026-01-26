# Sync Architecture Reference

Detailed architecture documentation for the NocoDB Sync feature.

## Database Schema

### nc_sync_configs

Main sync configuration table.

```sql
CREATE TABLE nc_sync_configs (
  id VARCHAR(20) PRIMARY KEY,
  fk_workspace_id VARCHAR(20),
  base_id VARCHAR(20) NOT NULL,
  fk_integration_id VARCHAR(20),           -- NULL for parent syncs
  fk_parent_sync_config_id VARCHAR(20),    -- NULL for parent/standalone syncs
  title VARCHAR(255),
  sync_category VARCHAR(50),               -- CRM, Ticketing, etc.
  sync_type VARCHAR(20) DEFAULT 'Full',    -- Full | Incremental
  sync_trigger VARCHAR(20) DEFAULT 'Manual', -- Manual | Schedule | Webhook
  sync_trigger_cron VARCHAR(50),           -- Cron expression for Schedule
  sync_trigger_secret VARCHAR(255),        -- Secret for Webhook
  sync_job_id VARCHAR(20),                 -- Current/last job ID
  on_delete_action VARCHAR(20) DEFAULT 'MarkDeleted', -- Delete | MarkDeleted
  last_sync_at DATETIME,
  next_sync_at DATETIME,
  meta JSON,                               -- Additional configuration
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW(),
  created_by VARCHAR(20),
  updated_by VARCHAR(20),

  INDEX idx_base_workspace (base_id, fk_workspace_id),
  INDEX idx_parent (fk_parent_sync_config_id),
  FOREIGN KEY (base_id) REFERENCES nc_bases(id),
  FOREIGN KEY (fk_integration_id) REFERENCES nc_integrations(id),
  FOREIGN KEY (fk_parent_sync_config_id) REFERENCES nc_sync_configs(id)
);
```

### nc_sync_mappings

Maps external tables to NocoDB models.

```sql
CREATE TABLE nc_sync_mappings (
  id VARCHAR(20) PRIMARY KEY,
  fk_workspace_id VARCHAR(20),
  base_id VARCHAR(20) NOT NULL,
  fk_sync_config_id VARCHAR(20) NOT NULL,
  target_table VARCHAR(255) NOT NULL,      -- External table key/name
  fk_model_id VARCHAR(20) NOT NULL,        -- NocoDB Model (table) ID
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW(),

  INDEX idx_base_workspace (base_id, fk_workspace_id),
  INDEX idx_sync_config (fk_sync_config_id),
  FOREIGN KEY (fk_sync_config_id) REFERENCES nc_sync_configs(id),
  FOREIGN KEY (fk_model_id) REFERENCES nc_models(id)
);
```

### Modified Tables

**nc_models** - Added column:
```sql
ALTER TABLE nc_models ADD COLUMN synced BOOLEAN DEFAULT FALSE;
```

**nc_columns** - Added column:
```sql
ALTER TABLE nc_columns ADD COLUMN readonly BOOLEAN DEFAULT FALSE;
```

## Data Models

### SyncConfig Model

```typescript
// packages/nocodb/src/ee/models/SyncConfig.ts

export enum SyncType {
  Full = 'Full',
  Incremental = 'Incremental',
}

export enum SyncTrigger {
  Manual = 'Manual',
  Schedule = 'Schedule',
  Webhook = 'Webhook',
}

export enum OnDeleteAction {
  Delete = 'Delete',
  MarkDeleted = 'MarkDeleted',
}

export enum SyncCategory {
  Ticketing = 'Ticketing',
  CRM = 'CRM',
  ProjectManagement = 'ProjectManagement',
  Communication = 'Communication',
  // ... more categories
}

export default class SyncConfig implements SyncConfigType {
  id: string
  fk_workspace_id?: string
  base_id: string
  fk_integration_id?: string
  fk_parent_sync_config_id?: string
  title?: string
  sync_category?: SyncCategory
  sync_type: SyncType
  sync_trigger: SyncTrigger
  sync_trigger_cron?: string
  sync_trigger_secret?: string
  sync_job_id?: string
  on_delete_action: OnDeleteAction
  last_sync_at?: string
  next_sync_at?: string
  meta?: Record<string, any>

  // Populated relations
  children?: SyncConfig[]
  integration?: Integration

  // Static methods
  static async get(id: string): Promise<SyncConfig>
  static async insert(data: Partial<SyncConfigType>): Promise<SyncConfig>
  static async update(id: string, data: Partial<SyncConfigType>): Promise<SyncConfig>
  static async delete(id: string): Promise<boolean>
  static async list(baseId: string): Promise<SyncConfig[]>
  static async listChildren(parentId: string): Promise<SyncConfig[]>
  static calculateNextSyncAt(cron: string): Date
}
```

### SyncMapping Model

```typescript
// packages/nocodb/src/ee/models/SyncMapping.ts

export default class SyncMapping implements SyncMappingType {
  id: string
  fk_workspace_id?: string
  base_id: string
  fk_sync_config_id: string
  target_table: string      // External source table identifier
  fk_model_id: string       // NocoDB Model ID

  // Static methods
  static async get(id: string): Promise<SyncMapping>
  static async insert(data: Partial<SyncMappingType>): Promise<SyncMapping>
  static async update(id: string, data: Partial<SyncMappingType>): Promise<SyncMapping>
  static async delete(id: string): Promise<boolean>
  static async listBySyncConfig(syncConfigId: string): Promise<SyncMapping[]>
  static async listByModel(modelId: string): Promise<SyncMapping[]>
}
```

## Service Layer

### SyncModuleService

Core sync orchestration service.

```typescript
// packages/nocodb/src/ee/integrations/sync/module/services/sync.service.ts

@Injectable()
export class SyncModuleService {
  constructor(
    private readonly jobsService: JobsService,
    private readonly tablesService: TablesService,
    private readonly columnsService: ColumnsService,
  ) {}

  /**
   * Create a new sync configuration
   * - Creates Integration instances for sync sources
   * - Fetches destination schema from external source
   * - Creates NocoDB tables and columns
   * - Creates junction tables for M2M relationships
   * - Marks tables as synced=true, columns as readonly=true
   */
  async createSync(param: {
    baseId: string
    req: NcRequest
    body: CreateSyncDto
  }): Promise<SyncConfig>

  /**
   * Trigger sync job
   * - Prevents duplicate concurrent jobs
   * - Queues JobTypes.SyncModuleSyncData
   * - Updates SyncConfig with job ID
   */
  async triggerSync(param: {
    syncConfigId: string
    bulk?: boolean
    req: NcRequest
  }): Promise<{ jobId: string }>

  /**
   * Update sync configuration
   * - Handles schema changes (add/remove tables/columns)
   * - Manages namespace changes
   * - Triggers migration if needed
   */
  async updateSync(param: {
    syncConfigId: string
    body: UpdateSyncDto
    req: NcRequest
  }): Promise<SyncConfig>

  /**
   * Delete sync and all related data
   * - Hierarchical deletion (children first)
   * - Deletes mapped tables
   * - Cleans up SyncMapping records
   */
  async deleteSync(param: {
    syncConfigId: string
    req: NcRequest
  }): Promise<boolean>

  /**
   * Run schema migration
   * - Detects schema changes
   * - Adds/removes columns
   * - Re-parses existing data
   */
  async migrateSync(param: {
    syncConfigId: string
    req: NcRequest
  }): Promise<void>

  // Query methods
  async listSync(baseId: string): Promise<SyncConfig[]>
  async readSync(syncConfigId: string): Promise<SyncConfig>
}
```

### SyncModuleSyncDataProcessor

Data synchronization processor.

```typescript
// packages/nocodb/src/ee/integrations/sync/module/services/sync.processor.ts

@Injectable()
export class SyncModuleSyncDataProcessor {
  /**
   * Main sync job handler
   * - Fetches data from external source
   * - Processes in batches (100 records)
   * - Upserts to NocoDB tables
   * - Handles M2M relationships
   * - Cleans up stale records
   */
  async job(data: {
    syncConfigId: string
    context: NcContext
  }): Promise<void>

  /**
   * Push data batch to database
   * - Maps external data to NocoDB schema
   * - Adds system fields
   * - Performs upsert (insert or update)
   */
  private async pushData(
    batch: SyncDataRecord[],
    context: SyncContext
  ): Promise<void>

  /**
   * Delete stale records
   * - Full sync: Deletes records not in current SyncRunId
   * - Respects on_delete_action setting
   */
  private async deleteStaleRecords(
    syncConfig: SyncConfig,
    syncRunId: string
  ): Promise<void>

  /**
   * Refresh data from RemoteRaw
   * - Re-parses stored raw data
   * - Updates readonly columns
   * - Used after schema changes
   */
  async refreshData(data: {
    syncConfigId: string
    context: NcContext
  }): Promise<void>

  /**
   * Migrate sync schema
   * - Detects column changes
   * - Adds/removes columns
   * - Updates existing data
   */
  async migrateSync(data: {
    syncConfigId: string
    oldMeta: any
    newMeta: any
    context: NcContext
  }): Promise<void>
}
```

### SyncModuleSyncScheduleProcessor

Scheduled sync handler.

```typescript
// packages/nocodb/src/ee/integrations/sync/module/services/sync-schedule.processor.ts

@Injectable()
export class SyncModuleSyncScheduleProcessor {
  /**
   * Runs every minute via cron
   * - Queries SyncConfigs where:
   *   - sync_trigger = Schedule
   *   - next_sync_at <= now()
   * - Processes up to 10 syncs per run
   * - Triggers sync for each eligible config
   */
  @Cron('* * * * *')
  async job(): Promise<void>
}
```

## Job System Integration

### Job Types

```typescript
// packages/nocodb/src/interface/Jobs.ts

enum JobTypes {
  SyncModuleSyncData = 'sync-module-sync-data',
  SyncModuleMigrateSync = 'sync-module-migrate-sync',
  SyncModuleRefreshData = 'sync-module-refresh-data',
  SyncModuleSchedule = 'sync-module-schedule',
}
```

### Job Registration

```typescript
// packages/nocodb/src/ee/modules/jobs/jobs-map.service.ts

const jobsMap = {
  [JobTypes.SyncModuleSyncData]: {
    processor: SyncModuleSyncDataProcessor,
    method: 'job',
  },
  [JobTypes.SyncModuleMigrateSync]: {
    processor: SyncModuleSyncDataProcessor,
    method: 'migrateSync',
  },
  [JobTypes.SyncModuleRefreshData]: {
    processor: SyncModuleSyncDataProcessor,
    method: 'refreshData',
  },
  [JobTypes.SyncModuleSchedule]: {
    processor: SyncModuleSyncScheduleProcessor,
    method: 'job',
    cron: '* * * * *',  // Every minute
  },
}
```

## Frontend Architecture

### Sync Store

```typescript
// packages/nc-gui/ee/store/sync.ts

export const useSyncStore = defineStore('syncStore', () => {
  // State
  const baseSyncs = ref<Map<string, SyncConfig[]>>(new Map())
  const isLoadingSync = ref(false)

  // Computed
  const isSyncFeatureEnabled = computed(() => {
    // Check EE license
  })

  const activeBaseSyncs = computed(() => {
    const baseId = useBase().baseId.value
    return baseSyncs.value.get(baseId) || []
  })

  // Actions
  async function loadSyncs(baseId: string, force = false) { ... }
  async function readSync(syncConfigId: string) { ... }
  async function createSync(baseId: string, payload: CreateSyncDto) { ... }
  async function updateSync(id: string, payload: UpdateSyncDto) { ... }
  async function deleteSync(baseId: string, syncConfigId: string) { ... }
  async function triggerSync(baseId: string, syncConfigId: string, bulk = false) { ... }

  // UI helpers
  function openNewSyncCreateModal(baseId: string) { ... }
  function openSyncProgressModal(baseId: string, jobId: string) { ... }

  return {
    baseSyncs,
    isLoadingSync,
    isSyncFeatureEnabled,
    activeBaseSyncs,
    loadSyncs,
    readSync,
    createSync,
    updateSync,
    deleteSync,
    triggerSync,
    openNewSyncCreateModal,
    openSyncProgressModal,
  }
})
```

### Sync Utilities

```typescript
// packages/nc-gui/utils/syncUtils.ts

// Parse sync frequency to human-readable string
export function getSyncFrequency(syncConfig: SyncConfig): string

// Default configuration for new syncs
export function getDefaultSyncConfig(): Partial<CreateSyncDto>

// Human-readable labels
export const syncEntityToReadableMap = {
  [SyncType.Full]: 'Full Sync',
  [SyncType.Incremental]: 'Incremental Sync',
  [SyncTrigger.Manual]: 'Manual',
  [SyncTrigger.Schedule]: 'Scheduled',
  [OnDeleteAction.Delete]: 'Delete Records',
  [OnDeleteAction.MarkDeleted]: 'Mark as Deleted',
}

// Form step navigation
export enum SyncFormStep {
  SelectSource = 1,
  ConfigureAuth = 2,
  SelectTables = 3,
  MapSchema = 4,
  ConfigureSync = 5,
}
```

## System Fields

Automatically added to every synced table:

```typescript
const SYSTEM_FIELDS = [
  {
    title: 'RemoteId',
    uidt: UITypes.SingleLineText,
    system: true,
    meta: { isSystemField: true },
  },
  {
    title: 'RemoteRaw',
    uidt: UITypes.JSON,
    system: true,
    meta: { isSystemField: true },
  },
  {
    title: 'RemoteSyncedAt',
    uidt: UITypes.DateTime,
    system: true,
    meta: { isSystemField: true },
  },
  {
    title: 'RemoteDeleted',
    uidt: UITypes.Checkbox,
    system: true,
    meta: { isSystemField: true },
  },
  {
    title: 'RemoteDeletedAt',
    uidt: UITypes.DateTime,
    system: true,
    meta: { isSystemField: true },
  },
  {
    title: 'RemoteNamespace',
    uidt: UITypes.SingleLineText,
    system: true,
    meta: { isSystemField: true },
  },
  {
    title: 'SyncRunId',
    uidt: UITypes.SingleLineText,
    system: true,
    meta: { isSystemField: true },
  },
  {
    title: 'SyncConfigId',
    uidt: UITypes.SingleLineText,
    system: true,
    meta: { isSystemField: true },
  },
  {
    title: 'SyncProvider',
    uidt: UITypes.SingleLineText,
    system: true,
    meta: { isSystemField: true },
  },
]
```

## Caching Strategy

```typescript
// SyncConfig uses NocoCache

// Cache key patterns
const CACHE_KEY = `${CacheScope.SYNC_CONFIG}:${id}`
const LIST_CACHE_KEY = `${CacheScope.SYNC_CONFIG}:${baseId}:list`
const CHILDREN_CACHE_KEY = `${CacheScope.SYNC_CONFIG}:${parentId}:children`

// Cache operations
await NocoCache.set(CACHE_KEY, syncConfig)
await NocoCache.get(CACHE_KEY)
await NocoCache.del(CACHE_KEY)
await NocoCache.delAll(CacheScope.SYNC_CONFIG, `${baseId}:*`)
```

## Error Handling

```typescript
// Sync creation with rollback
async createSync(param) {
  const createdTables: Model[] = []
  const createdMappings: SyncMapping[] = []

  try {
    // Create tables and mappings
    for (const table of schema.tables) {
      const model = await this.tablesService.tableCreate(...)
      createdTables.push(model)

      const mapping = await SyncMapping.insert(...)
      createdMappings.push(mapping)
    }

    return syncConfig
  } catch (error) {
    // Rollback on failure
    for (const mapping of createdMappings) {
      await SyncMapping.delete(mapping.id)
    }
    for (const table of createdTables) {
      await this.tablesService.tableDelete({ tableId: table.id })
    }

    throw error
  }
}
```

## Security & ACL

```typescript
// ACL permissions for sync operations
const syncAclMap = {
  syncSourceList: ['owner', 'creator', 'viewer', 'editor', 'commenter'],
  syncSourceCreate: ['owner', 'creator'],
  syncSourceDelete: ['owner', 'creator'],
  syncSourceUpdate: ['owner', 'creator'],

  // EE operations
  listSync: ['owner', 'creator', 'viewer', 'editor', 'commenter'],
  readSync: ['owner', 'creator', 'viewer', 'editor', 'commenter'],
  createSync: ['owner', 'creator'],
  triggerSync: ['owner', 'creator'],
  updateSync: ['owner', 'creator'],
  deleteSync: ['owner', 'creator'],
}
```
