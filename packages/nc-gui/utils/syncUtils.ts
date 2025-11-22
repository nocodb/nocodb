import type { SyncConfig } from 'nocodb-sdk'
import {
  IntegrationsType,
  OnDeleteAction,
  OnDeleteActionMeta,
  SyncCategory,
  SyncTrigger,
  SyncTriggerMeta,
  SyncType,
  SyncTypeMeta,
  generateUniqueCopyName,
} from 'nocodb-sdk'

const getSyncFrequency = (trigger: SyncTrigger, cron?: string) => {
  if (trigger === SyncTrigger.Manual) return 'Manual'
  if (trigger === SyncTrigger.Schedule && cron) {
    if (cron.includes('hourly')) return 'Hourly'
    if (cron.includes('daily')) return 'Daily'
    if (cron.includes('* * * *')) return 'Hourly'
    if (cron.includes('* * *')) return 'Daily'
    return cron
  }
  return 'Unknown'
}

const _defaultSyncConfig: Partial<SyncConfig> & Record<string, unknown> = {
  title: 'New Source',
  sync_type: SyncType.Incremental,
  sync_trigger: SyncTrigger.Manual,
  sync_category: SyncCategory.TICKETING,
  on_delete_action: OnDeleteAction.MarkDeleted,
  sync_trigger_cron: '0 * * * *',
  meta: {
    sync_all_models: true,
    sync_excluded_models: [],
  },
}

const defaultSyncConfig = (configs: SyncConfig[]) => {
  const newTitle = generateUniqueCopyName('New Sync Source', configs, {
    accessor: (c) => c.title,
    prefix: null,
  })

  const isDefaultSyncCategoryAlreadyAdded = configs.some((config) => config.sync_category === _defaultSyncConfig.sync_category)

  return {
    ..._defaultSyncConfig,
    title: newTitle,
    sync_category: isDefaultSyncCategoryAlreadyAdded ? undefined : _defaultSyncConfig.sync_category,
  }
}

enum SyncFormStep {
  SyncSettings = 0,
  Integration = 1,
  DestinationSchema = 2,
  Create = 3,
}

interface IntegrationConfig {
  id?: string
  title?: string
  type: IntegrationsType.Sync
  sub_type: string | null
  config: Record<string, any>
  syncConfigId?: string
  parentSyncConfigId?: string
}

const defaultIntegrationConfig: Partial<IntegrationConfig> = {
  type: IntegrationsType.Sync,
  sub_type: null,
}

const syncEntityToReadableMap = {
  [SyncType.Full]: SyncTypeMeta[SyncType.Full].label,
  [SyncType.Incremental]: SyncTypeMeta[SyncType.Incremental].label,
  [SyncTrigger.Manual]: SyncTriggerMeta[SyncTrigger.Manual].label,
  [SyncTrigger.Schedule]: SyncTriggerMeta[SyncTrigger.Schedule].label,
  [SyncTrigger.Webhook]: SyncTriggerMeta[SyncTrigger.Webhook].label,
  [OnDeleteAction.Delete]: OnDeleteActionMeta[OnDeleteAction.Delete].label,
  [OnDeleteAction.MarkDeleted]: OnDeleteActionMeta[OnDeleteAction.MarkDeleted].label,
}

interface CustomSyncSchema {
  [key: string]: {
    title: string
    columns: {
      title: string
      uidt: string
      abstractType: string
      exclude?: boolean
    }[]
    relations: any[]
    systemFields?: {
      primaryKey: string[]
      createdAt?: string
      updatedAt?: string
    }
  }
}

export {
  getSyncFrequency,
  defaultSyncConfig,
  SyncFormStep,
  defaultIntegrationConfig,
  syncEntityToReadableMap,
  _defaultSyncConfig,
}

export type { IntegrationConfig, CustomSyncSchema }
