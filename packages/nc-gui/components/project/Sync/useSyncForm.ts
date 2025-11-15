import type { SyncConfig } from 'nocodb-sdk'
import { IntegrationCategoryType } from 'nocodb-sdk'
import { Form } from 'ant-design-vue'
import rfdc from 'rfdc'

const deepClone = rfdc()

const [useProvideSyncForm, useSyncForm] = useInjectionState(
  (baseId: MaybeRef<string>, mode: 'create' | 'edit', syncId?: MaybeRef<string>) => {
    const { $api } = useNuxtApp()

    const { t } = useI18n()

    const { integrationsRefreshKey, getIntegrationForm, integrations, getIntegration } = useIntegrationStore()

    const { activeWorkspaceId } = storeToRefs(useWorkspace())

    const syncStore = useSyncStore()

    const { createSync, readSync, updateSync: updateSyncStore, deleteSync, loadSyncs } = syncStore

    const { activeBaseSyncs } = storeToRefs(useSyncStore())

    const syncConfigForm = ref<Partial<SyncConfig>>(defaultSyncConfig(activeBaseSyncs.value || []))

    const integrationConfigs = ref<IntegrationConfig[]>([])

    const deletedSyncConfigIds = ref<string[]>([])

    const syncConfigEditFormChanged = ref(false)

    const step = ref(SyncFormStep.SyncSettings)

    const isSaving = ref(false)

    const isUpdating = ref(false)

    const availableIntegrations = computed(() => {
      // eslint-disable-next-line no-unused-expressions
      integrationsRefreshKey.value

      return allIntegrations.filter((i) => {
        return i.type === IntegrationCategoryType.SYNC && i.sync_category === syncConfigForm.value.sync_category
      })
    })

    const integrationConfigValidationCallbacks = ref<Record<number, () => void>>({})

    const { validate: validateSyncConfig, validateInfos: validateInfosSyncConfig } = Form.useForm(
      syncConfigForm,
      ref({
        title: [
          fieldRequiredValidator(),
          {
            validator: (_: unknown, value: string) => {
              return new Promise((resolve, reject) => {
                const currentSyncId = unref(syncId)
                const duplicate = activeBaseSyncs.value.find((sync) => sync.title === value && sync.id !== currentSyncId)

                if (duplicate) {
                  return reject(new Error(t('msg.error.syncTitleAlreadyExists')))
                }

                resolve(true)
              })
            },
          },
        ],
        sync_type: [fieldRequiredValidator()],
        sync_trigger: [fieldRequiredValidator()],
      }),
    )

    const addIntegrationConfig = async (subType: string) => {
      const config = {
        ...deepClone(defaultIntegrationConfig),
        sub_type: subType,
      }
      config.title = availableIntegrations.value.find((i) => i.sub_type === subType)?.title
      integrationConfigs.value.push(config as IntegrationConfig)
      await getIntegrationForm(IntegrationCategoryType.SYNC, subType)
    }

    const removeIntegrationConfig = (index: number) => {
      if (integrationConfigs.value.length === 1) return

      const config = integrationConfigs.value[index]

      if (!config) {
        return
      }

      // If this is an existing child sync (has syncConfigId and is not the parent), track it for deletion
      if (mode === 'edit' && config.syncConfigId && config.parentSyncConfigId) {
        deletedSyncConfigIds.value.push(config.syncConfigId)
      }

      integrationConfigs.value.splice(index, 1)
    }

    const updateIntegrationConfig = async (index: number, config: Partial<IntegrationConfig>) => {
      if (integrationConfigs.value[index]) {
        integrationConfigs.value[index] = { ...integrationConfigs.value[index], ...config }
      }
      if (!config.sub_type) return
      await getIntegrationForm(IntegrationCategoryType.SYNC, config.sub_type)
    }

    const validateIntegrationConfigs = async () => {
      if (integrationConfigs.value.length === 0) return false
      const errors = []

      for (const [index, config] of integrationConfigs.value.entries()) {
        if (!config.sub_type) {
          errors.push(`Integration config ${index} is invalid`)
          continue
        }

        const callback = integrationConfigValidationCallbacks.value[index]
        if (!callback) {
          errors.push(`Integration config ${index} is invalid`)
        }

        try {
          await callback?.()
        } catch (e) {
          errors.push(e)
        }
      }
      return errors?.length === 0
    }

    const saveSyncConfig = async () => {
      const bsId = unref(baseId)
      const syncConfig = {
        ...syncConfigForm.value,
        configs: integrationConfigs.value,
      }
      isSaving.value = true
      try {
        const res = await createSync(bsId, syncConfig)
        return res?.job.id
      } finally {
        isSaving.value = false
      }
    }

    const updateSyncConfig = async () => {
      const _syncId = unref(syncId)
      if (!_syncId) {
        throw new Error('Sync ID is required for update')
      }

      const bsId = unref(baseId)
      if (!bsId) {
        throw new Error('Base ID is required for update')
      }

      isUpdating.value = true
      try {
        // First, delete any child syncs that were marked for deletion
        if (deletedSyncConfigIds.value.length > 0) {
          await Promise.all(deletedSyncConfigIds.value.map((syncConfigId) => deleteSync(bsId, syncConfigId)))
          deletedSyncConfigIds.value = []
        }

        const updateData = {
          syncConfigId: _syncId,
          title: syncConfigForm.value.title,
          sync_type: syncConfigForm.value.sync_type,
          sync_trigger: syncConfigForm.value.sync_trigger,
          sync_trigger_cron: syncConfigForm.value.sync_trigger_cron,
          on_delete_action: syncConfigForm.value.on_delete_action,
          sync_category: syncConfigForm.value.sync_category,
          exclude_models: (syncConfigForm.value as any).exclude_models,
          config: integrationConfigs.value.map((config) => ({
            id: config.id, // Integration ID (if existing, for updates)
            type: config.type,
            sub_type: config.sub_type,
            config: config.config,
            title: config.title,
            syncConfigId: config.syncConfigId,
          })),
        }

        const result = await updateSyncStore(_syncId, updateData)

        if (result?.syncConfig) {
          syncConfigForm.value = result.syncConfig
        }

        message.success('Sync updated successfully')

        return result
      } finally {
        isUpdating.value = false
      }
    }

    const integrationFetchDestinationSchema = async (integration: IntegrationConfig) => {
      const wsId = activeWorkspaceId?.value
      const bsId = unref(baseId)

      if (!wsId || !bsId || !integration) {
        return
      }

      return await $api.internal.postOperation(
        wsId,
        bsId,
        { operation: 'syncIntegrationFetchDestinationSchema' },
        { integration },
      )
    }

    onMounted(async () => {
      const bsId = unref(baseId)

      // Load existing syncs for validation
      if (bsId) {
        await loadSyncs(bsId)
      }

      const _syncId = unref(syncId)
      if (mode === 'edit' && _syncId) {
        deletedSyncConfigIds.value = []
        const sync = await readSync(_syncId)
        if (!sync) return
        syncConfigForm.value = sync as SyncConfig

        const existingIntegrationConfigs = [sync, ...(sync?.children || [])]

        integrationConfigs.value = (
          await Promise.all(
            existingIntegrationConfigs.map(async (sync) => {
              const integration = integrations.value.find((i) => i.id === sync.fk_integration_id)

              if (!integration?.id) {
                return null
              }

              const int = await getIntegration(integration, {
                includeConfig: true,
              })

              if (!int) {
                return null
              }

              return {
                ...integration,
                ...int,
                syncConfigId: sync.id,
                parentSyncConfigId: sync.fk_parent_sync_config_id,
              }
            }),
          )
        ).filter(Boolean) as IntegrationConfig[]

        for (const config of integrationConfigs.value) {
          if (!config.sub_type) continue
          await getIntegrationForm(IntegrationCategoryType.SYNC, config.sub_type)
        }
      }
    })

    return {
      mode,
      step,
      syncConfigForm,
      validateSyncConfig,
      validateInfosSyncConfig,
      syncConfigEditFormChanged,
      integrationConfigs,
      activeBaseSyncs,
      addIntegrationConfig,
      removeIntegrationConfig,
      updateIntegrationConfig,
      availableIntegrations,
      integrationConfigValidationCallbacks,
      integrationFetchDestinationSchema,
      validateIntegrationConfigs,
      saveSyncConfig,
      updateSyncConfig,
      isSaving,
      isUpdating,
    }
  },
)

export { useSyncForm, useProvideSyncForm }

export function useSyncFormOrThrow() {
  const syncForm = useSyncForm()
  if (syncForm == null) throw new Error('Please call `useProvideSyncForm` on the appropriate parent component')
  return syncForm
}
