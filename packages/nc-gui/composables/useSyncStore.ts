import { Form } from 'ant-design-vue'
import { type FormDefinition, IntegrationsType, OnDeleteAction, SyncCategory, SyncTrigger, SyncType } from 'nocodb-sdk'
import rfdc from 'rfdc'

const deepClone = rfdc()

interface SyncConfig {
  title: string
  sync_type: SyncType
  sync_trigger: SyncTrigger
  sync_category: SyncCategory | null
  exclude_models: string[]
  on_delete_action: OnDeleteAction
  sync_trigger_cron: string | null
}

const defaultSyncConfig: SyncConfig = {
  title: 'New Source',
  sync_type: SyncType.Full,
  sync_trigger: SyncTrigger.Manual,
  sync_category: SyncCategory.TICKETING,
  exclude_models: [],
  on_delete_action: OnDeleteAction.MarkDeleted,
  sync_trigger_cron: null,
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

const defaultIntegrationConfig: IntegrationConfig = {
  type: IntegrationsType.Sync,
  sub_type: null,
  config: {},
}

// Use injection state helper to create provider and consumer hooks
const [useProvideSyncStore, useSyncStore] = useInjectionState(
  (workspaceId: MaybeRef<string | undefined>, baseId: MaybeRef<string | undefined>) => {
    const syncConfigForm = ref<SyncConfig>(defaultSyncConfig)

    const syncConfigEditForm = ref<Partial<SyncConfig & { id: string }>>()

    const syncConfigEditFormChanged = ref(false)

    const editTab = ref<'sync' | 'integrations' | 'sync-settings'>('sync')

    const editMode = ref(false)

    const editModeAddIntegration = ref(false)

    const editModeModified = ref(false)

    const editModeSync = ref<
      | (SyncConfig & {
          id: string
          fk_integration_id: string
          config: IntegrationConfig
          children: (SyncConfig & { id: string; fk_integration_id: string })[]
          last_sync_at: string | null
          next_sync_at: string | null
        })
      | null
    >(null)

    const { validate: validateSyncConfig, validateInfos: validateInfosSyncConfig } = Form.useForm(
      syncConfigForm,
      ref({
        title: [fieldRequiredValidator()],
        sync_type: [fieldRequiredValidator()],
        sync_trigger: [fieldRequiredValidator()],
      }),
    )

    // Store for integration configs
    const integrationConfigs = ref<IntegrationConfig[]>([deepClone(defaultIntegrationConfig)])

    // Store per sub_type
    const integrationFormMap = ref<Record<string, FormDefinition>>({})

    const selectedIntegrationIndex = ref(0)
    const activeIntegrationItemForm = ref<FormDefinition>()

    const { getIntegrationForm } = useIntegrationStore()

    const { $api } = useNuxtApp()

    // Use the form builder helper
    const { formState, isLoading, validate, clearValidate, validateInfos } = useProvideFormBuilderHelper({
      formSchema: activeIntegrationItemForm,
      fetchOptions: async (key: string) => {
        const wsId = unref(workspaceId)
        const bsId = unref(baseId)

        if (!key || !wsId || !bsId) return []

        const options = await $api.internal.postOperation(
          wsId,
          bsId,
          {
            operation: 'syncIntegrationFetchOptions',
          },
          {
            integration: formState.value,
            key,
          },
        )

        return options
      },
    })

    // Helper function to get deep reference value
    const deepReference = (path: string) => {
      return deepReferenceHelper(formState, path)
    }

    const changeIntegration = async (subType: string | null) => {
      if (!subType) {
        activeIntegrationItemForm.value = undefined
        return
      }

      const integrationForm = integrationFormMap.value[subType] || (await getIntegrationForm(IntegrationsType.Sync, subType))

      activeIntegrationItemForm.value = [...integrationForm]

      formState.value.type = IntegrationsType.Sync
      formState.value.sub_type = subType

      // Initialize config structure if needed
      if (!formState.value.config) {
        formState.value.config = {}
      }

      // Initialize sync structure if needed
      if (!formState.value.config.sync) {
        formState.value.config.sync = {}
      }

      // Set default sync trigger if not set
      if (!formState.value.config.sync.sync_trigger) {
        formState.value.config.sync.sync_trigger = SyncTrigger.Manual
      }
    }

    const removeConfig = (index: number) => {
      if (integrationConfigs.value[index]) {
        integrationConfigs.value[index] = deepClone(defaultIntegrationConfig)
        integrationConfigs.value.splice(index, 1)
      }

      if (integrationConfigs.value.length === 0) {
        integrationConfigs.value.push(deepClone(defaultIntegrationConfig))
      }
    }

    // Save current form state to integrationConfigs
    const saveCurrentFormState = async () => {
      if (integrationConfigs.value[selectedIntegrationIndex.value] !== undefined) {
        try {
          await validate()
        } catch (e) {
          return false
        }

        integrationConfigs.value[selectedIntegrationIndex.value] = deepClone(formState.value) as any

        return true
      }
    }

    const loadConfig = async (index: number) => {
      if (integrationConfigs.value[index]) {
        if (editMode.value) {
          if (integrationConfigs.value[index].id && !integrationConfigs.value[index].config) {
            const integration = await $api.integration.read(integrationConfigs.value[index].id, {
              includeConfig: true,
            })

            integrationConfigs.value[index].config = integration.config
          }
        }

        if (integrationConfigs.value[index]) {
          await changeIntegration(integrationConfigs.value[index].sub_type)
          formState.value = deepClone(integrationConfigs.value[index])
        }

        nextTick(() => {
          clearValidate()
          selectedIntegrationIndex.value = index
        })
      }
    }

    // Add a new integration config
    const addIntegrationConfig = async () => {
      // Save current form state before adding a new config
      if (!(await saveCurrentFormState())) {
        return
      }

      integrationConfigs.value.push(deepClone(defaultIntegrationConfig))

      await loadConfig(integrationConfigs.value.length - 1)

      if (editMode.value) {
        editModeAddIntegration.value = true
        editModeModified.value = true
      }
    }

    // Remove an integration config
    const removeIntegrationConfig = async (index: number) => {
      removeConfig(index)

      const newIndex = integrationConfigs.value.length - 1

      // Since we may have changed the selected index, load the correct configuration
      await loadConfig(newIndex)
    }

    // Switch to a different integration config
    const switchToIntegrationConfig = async (index: number) => {
      // Save current state before switching
      await saveCurrentFormState()

      await loadConfig(index)
    }

    // Reset the store to initial state
    const resetStore = () => {
      integrationConfigs.value = [deepClone(defaultIntegrationConfig)]

      activeIntegrationItemForm.value = undefined

      loadConfig(0)
    }

    // Calculate available integrations based on current category
    const availableIntegrations = computed(() => {
      return allIntegrations.filter((i) => {
        return (
          i.type === IntegrationCategoryType.SYNC &&
          (!deepReference('sync_category') || i.sync_category === deepReference('sync_category'))
        )
      })
    })

    const readSync = async (syncConfigId: string) => {
      const wsId = unref(workspaceId)
      const bsId = unref(baseId)

      if (!syncConfigId || !wsId || !bsId) {
        return
      }

      return (await $api.internal.getOperation(wsId, bsId, {
        operation: 'readSync',
        id: syncConfigId,
      })) as any
    }

    const createSync = async () => {
      const wsId = unref(workspaceId)
      const bsId = unref(baseId)

      if (!wsId || !bsId) {
        return
      }

      const syncData = await $api.internal.postOperation(
        wsId,
        bsId,
        {
          operation: 'createSync',
        },
        {
          title: syncConfigForm.value.title,
          sync_type: syncConfigForm.value.sync_type,
          sync_trigger: syncConfigForm.value.sync_trigger,
          sync_trigger_cron: syncConfigForm.value.sync_trigger_cron,
          on_delete_action: syncConfigForm.value.on_delete_action,
          sync_category: syncConfigForm.value.sync_category,
          exclude_models: syncConfigForm.value.exclude_models,
          configs: integrationConfigs.value,
        },
      )

      return syncData as { job: { id: string } }
    }

    const triggerSync = async (syncConfigId: string, bulk: boolean) => {
      const wsId = unref(workspaceId)
      const bsId = unref(baseId)

      if (!wsId || !bsId || !syncConfigId) {
        return
      }

      const syncData = await $api.internal.postOperation(
        wsId,
        bsId,
        {
          operation: 'triggerSync',
        },
        {
          syncConfigId,
          bulk: !!bulk,
        },
      )

      return syncData as { id: string }
    }

    const updateSync = async () => {
      const wsId = unref(workspaceId)
      const bsId = unref(baseId)

      if (!wsId || !bsId || !syncConfigEditForm.value) {
        return
      }

      try {
        await validate()
      } catch (e) {
        return
      }

      const { syncConfig, integration } = await $api.internal.postOperation(
        wsId,
        bsId,
        {
          operation: 'updateSync',
        },
        {
          syncConfigId: editTab.value === 'sync-settings' ? syncConfigEditForm.value?.id : formState.value.syncConfigId,
          ...(editTab.value === 'sync-settings' ? syncConfigEditForm.value : {}),
          ...(editTab.value === 'integrations'
            ? { syncConfigId: formState.value.syncConfigId ?? syncConfigEditForm.value?.id, config: formState.value }
            : {}),
        },
      )

      if (integration && integrationConfigs.value[selectedIntegrationIndex.value]) {
        formState.value.syncConfigId = syncConfig.id
        formState.value.parentSyncConfigId = syncConfig.fk_parent_sync_config_id

        Object.assign(formState.value, integration)
        Object.assign(integrationConfigs.value[selectedIntegrationIndex.value]!, formState.value)
      }

      if (formState.value.syncConfigId === syncConfig.id) {
        editModeSync.value = syncConfig
      }

      syncConfigEditFormChanged.value = false

      editModeModified.value = false

      await loadConfig(selectedIntegrationIndex.value)
    }

    const deleteSync = async (syncConfigId: string) => {
      const wsId = unref(workspaceId)
      const bsId = unref(baseId)

      if (!wsId || !bsId || !syncConfigId) {
        return
      }

      await $api.internal.postOperation(wsId, bsId, { operation: 'deleteSync' }, { syncConfigId })

      // remove integration config
      await removeIntegrationConfig(selectedIntegrationIndex.value)
    }

    const integrationFetchDestinationSchema = async (integration: IntegrationConfig) => {
      const wsId = unref(workspaceId)
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

    return {
      syncConfigForm,
      syncConfigEditForm,
      syncConfigEditFormChanged,
      validateSyncConfig,
      validateInfosSyncConfig,
      integrationConfigs,
      selectedIntegrationIndex,
      formState,
      activeIntegrationItemForm,
      isLoading,
      availableIntegrations,
      addIntegrationConfig,
      removeIntegrationConfig,
      switchToIntegrationConfig,
      loadConfig,
      changeIntegration,
      resetStore,
      deepReference,
      saveCurrentFormState,
      validateInfos,
      editMode,
      editModeSync,
      editModeModified,
      editModeAddIntegration,
      readSync,
      createSync,
      updateSync,
      triggerSync,
      deleteSync,
      editTab,
      integrationFetchDestinationSchema,
    }
  },
  'use-sync-store',
)

export { useProvideSyncStore }

export function useSyncStoreOrThrow() {
  const formBuilderStore = useSyncStore()
  if (formBuilderStore == null) throw new Error('Please call `useSyncStore` on the appropriate parent component')
  return formBuilderStore
}
