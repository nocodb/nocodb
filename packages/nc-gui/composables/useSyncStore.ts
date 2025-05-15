import { Form } from 'ant-design-vue'
import { type FormDefinition, IntegrationsType, OnDeleteAction, SyncCategory, SyncTrigger, SyncType } from 'nocodb-sdk'
import rfdc from 'rfdc'

const deepClone = rfdc()

interface SyncConfig {
  title: string
  sync_type: SyncType
  sync_trigger: SyncTrigger
  sync_category: SyncCategory
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

interface IntegrationConfig {
  type: IntegrationsType.Sync
  sub_type: string | null
  config: Record<string, any>
}

const defaultIntegrationConfig: IntegrationConfig = {
  type: IntegrationsType.Sync,
  sub_type: null,
  config: {},
}

// Use injection state helper to create provider and consumer hooks
const [useProvideSyncStore, useSyncStore] = useInjectionState(() => {
  const baseStore = useBase()

  const syncConfigForm = ref<SyncConfig>(defaultSyncConfig)

  const { validate: validateSyncConfig, validateInfos: validateInfosSyncConfig } = Form.useForm(syncConfigForm, {
    title: [fieldRequiredValidator()],
    sync_type: [fieldRequiredValidator()],
    sync_trigger: [fieldRequiredValidator()],
  })

  // Store for integration configs
  const integrationConfigs = ref<IntegrationConfig[]>([defaultIntegrationConfig])

  // Store per sub_type
  const integrationFormMap = ref<Record<string, FormDefinition>>({})

  const selectedIntegrationIndex = ref(0)
  const activeIntegrationItemForm = ref<FormDefinition>()

  // Use the form builder helper
  const { formState, isLoading, validate, validateInfos } = useProvideFormBuilderHelper({
    formSchema: activeIntegrationItemForm,
  })

  const { getIntegrationForm } = useIntegrationStore()

  const { $api } = useNuxtApp()

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
    integrationConfigs.value.splice(index, 1)

    if (integrationConfigs.value.length === 0) {
      integrationConfigs.value.push(defaultIntegrationConfig)
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
      await changeIntegration(integrationConfigs.value[index].sub_type)
      formState.value = deepClone(integrationConfigs.value[index])
    }
  }

  // Add a new integration config
  const addIntegrationConfig = async () => {
    // Save current form state before adding a new config
    if (!(await saveCurrentFormState())) {
      return
    }

    integrationConfigs.value.push(defaultIntegrationConfig)

    // Set index to new config
    selectedIntegrationIndex.value = integrationConfigs.value.length - 1

    loadConfig(selectedIntegrationIndex.value)
  }

  // Remove an integration config
  const removeIntegrationConfig = (index: number) => {
    // If removing the current config, no need to save its state
    if (index !== selectedIntegrationIndex.value) {
      // Save current state before removing
      saveCurrentFormState()
    }

    removeConfig(index)

    // Adjust selected index if needed
    if (selectedIntegrationIndex.value >= integrationConfigs.value.length) {
      selectedIntegrationIndex.value = integrationConfigs.value.length - 1
    }

    // Since we may have changed the selected index, load the correct configuration
    loadConfig(selectedIntegrationIndex.value)
  }

  // Switch to a different integration config
  const switchToIntegrationConfig = async (index: number) => {
    // Save current state before switching
    saveCurrentFormState()

    // Set the new index
    selectedIntegrationIndex.value = index

    loadConfig(index)
  }

  // Reset the store to initial state
  const resetStore = () => {
    integrationConfigs.value = [defaultIntegrationConfig]

    selectedIntegrationIndex.value = 0
    activeIntegrationItemForm.value = undefined

    loadConfig(selectedIntegrationIndex.value)
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

  const createSync = async () => {
    if (!baseStore.base) {
      return
    }

    const syncData = await $api.internal.postOperation(
      baseStore.base.fk_workspace_id!,
      baseStore.base.id!,
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

    return syncData as { job: { id: string }; table: { id: string } }
  }

  return {
    syncConfigForm,
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
    changeIntegration,
    resetStore,
    deepReference,
    saveCurrentFormState,
    validateInfos,
    createSync,
  }
}, 'use-sync-store')

export { useProvideSyncStore }

export function useSyncStoreOrThrow() {
  const formBuilderStore = useSyncStore()
  if (formBuilderStore == null) throw new Error('Please call `useSyncStore` on the appropriate parent component')
  return formBuilderStore
}
