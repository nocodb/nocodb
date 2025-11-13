import type { SyncConfig } from 'nocodb-sdk'
import { IntegrationsType, OnDeleteAction, SyncCategory, SyncTrigger, SyncType } from 'nocodb-sdk'

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

const defaultSyncConfig: Partial<SyncConfig> & Record<string, unknown> = {
  title: 'New Source',
  sync_type: SyncType.Full,
  sync_trigger: SyncTrigger.Schedule,
  sync_category: SyncCategory.TICKETING,
  exclude_models: [],
  on_delete_action: OnDeleteAction.MarkDeleted,
  sync_trigger_cron: '0 * * * *',
}

enum SyncFormStep {
  SyncSettings = 0,
  Integration = 1,
  DestinationSchema = 2,
  Create = 3,
}

export interface IntegrationConfig {
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
  [SyncType.Full]: 'Full',
  [SyncType.Incremental]: 'Incremental',
  [SyncTrigger.Manual]: 'Manual ',
  [SyncTrigger.Schedule]: 'Scheduled',
  [SyncTrigger.Webhook]: 'Webhook',
  [OnDeleteAction.Delete]: 'Delete',
  [OnDeleteAction.MarkDeleted]: 'Mark as Delete',
}

export { getSyncFrequency, defaultSyncConfig, SyncFormStep, defaultIntegrationConfig, syncEntityToReadableMap }
