import type { SyncConfig } from 'nocodb-sdk'
import { IntegrationCategoryType, SyncCategory } from 'nocodb-sdk'
import { Form } from 'ant-design-vue'

const [useProvideSyncForm, useSyncForm] = useInjectionState(
  (baseId: MaybeRef<string>, mode: 'create' | 'edit', syncId?: MaybeRef<string>) => {
    const { $api } = useNuxtApp()

    const { t } = useI18n()

    const {
      integrationsRefreshKey,
      getIntegrationForm,
      integrations,
      getIntegration,
      loadIntegrations,
      loadDynamicIntegrations,
    } = useIntegrationStore()

    const { activeWorkspaceId } = storeToRefs(useWorkspace())

    const syncStore = useSyncStore()

    const { createSync, readSync, updateSync: updateSyncStore, deleteSync, loadSyncs } = syncStore

    const { activeBaseSyncs } = storeToRefs(useSyncStore())

    const syncConfigForm = ref<Partial<SyncConfig>>(defaultSyncConfig(activeBaseSyncs.value || []))

    const isSyncCategoryAlreadyAddedOrBlank = computed(() => {
      if (mode === 'edit') {
        return {
          value: false,
          tooltip: '',
        }
      }

      // Custom syncs build their own (collision-resolved) tables, so multiple are allowed per base.
      const isCustomCategory = syncConfigForm.value.sync_category === SyncCategory.CUSTOM

      const isSyncCategoryAlreadySelected =
        !isCustomCategory &&
        activeBaseSyncs.value.some(
          (sync) => syncConfigForm.value.sync_category && sync.sync_category === syncConfigForm.value.sync_category,
        )
      return {
        value: !syncConfigForm.value.sync_category || isSyncCategoryAlreadySelected,
        tooltip: isSyncCategoryAlreadySelected ? t('tooltip.syncForThisCategoryAlreadyAdded') : t('tooltip.selectSyncCategory'),
      }
    })

    const isLoadingIntegrationConfigs = ref(true)

    const integrationConfigs = ref<IntegrationConfig[]>([])

    const deletedSyncConfigIds = ref<string[]>([])

    const syncConfigEditFormChanged = ref(false)

    const step = ref(SyncFormStep.SyncSettings)

    const isSaving = ref(false)

    const isUpdating = ref(false)

    const isLoadingSchema = ref(false)

    // Lets nested steps (e.g. the Category step's "upgrade to use Custom Sync"
    // flow) request the whole create/edit modal to close. The owning modal
    // component subscribes via `closeForm.on(...)`.
    const closeForm = createEventHook<void>()

    // Serializes schema reloads so a call issued while one is in flight re-checks staleness
    // after it settles — the latest table selection always wins.
    let pendingSchemaLoad: Promise<void> = Promise.resolve()

    const availableIntegrations = computed(() => {
      // eslint-disable-next-line no-unused-expressions
      integrationsRefreshKey.value

      return allIntegrations.filter((i) => {
        return i.type === IntegrationCategoryType.SYNC && i.sync_category === syncConfigForm.value.sync_category && !i.hidden
      })
    })

    const syncCategoryIntegrationMap = computed(() => {
      return Object.values(SyncCategory).reduce((acc, category) => {
        acc[category] = allIntegrations.filter(
          (i) => i.type === IntegrationCategoryType.SYNC && i.sync_category === category && !i.hidden,
        )
        return acc
      }, {} as Record<SyncCategory, IntegrationItemType[]>)
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

      if (errors?.length) {
        console.error('errors', errors)
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

        await loadIntegrations(null, unref(baseId))

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
        if (ncIsArray(integrationConfigs.value[0]?.config?.tables)) {
          await loadDestinationSchema()
        }

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
          config: integrationConfigs.value.map((config) => ({
            id: config.id, // Integration ID (if existing, for updates)
            type: config.type,
            sub_type: config.sub_type,
            config: config.config,
            title: config.title,
            syncConfigId: config.syncConfigId,
          })),
          meta: {
            sync_all_models: true,
            sync_excluded_models: [],
            ...parseProp(syncConfigForm.value.meta),
          },
        }

        const result = await updateSyncStore(_syncId, updateData, bsId)

        if (result?.syncConfig) {
          syncConfigForm.value = {
            ...(result.syncConfig as SyncConfig),
            meta: {
              ...(getDefaultSyncConfig().meta as Record<string, any>),
              ...parseProp(result.syncConfig.meta),
            },
          }
        }

        await loadIntegrations(null, unref(baseId))

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

    // Apply the sensible defaults for a freshly-fetched table (system fields, primary key,
    // exclude flags). Only used for tables we haven't configured yet.
    function buildTableDefaults(table?: CustomSyncSchema[string] | null) {
      if (!table?.columns) return

      if (!table.relations) {
        table.relations = []
      }

      if (!table.systemFields) {
        table.systemFields = { primaryKey: [] }
      }

      table.columns.forEach((column) => {
        column.exclude = !!column.exclude
      })

      if (table.systemFields.primaryKey.length === 0 && table.columns.length > 0) {
        const firstColumn = table.columns[0]
        if (firstColumn) {
          table.systemFields.primaryKey = [firstColumn.title]
        }
      }

      table.systemFields.primaryKey.forEach((pkColumn) => {
        const column = table.columns!.find((col) => col.title === pkColumn)
        if (column) {
          column.exclude = false
        }
      })
    }

    // Fetch the destination schema for the currently-selected source tables. We re-fetch
    // whenever the cached schema no longer matches the selected tables (e.g. the user went
    // back and (de)selected tables), but preserve any mapping already configured for tables
    // that are still selected — only newly-added tables get fresh defaults.
    async function reloadDestinationSchemaIfStale() {
      const mainIntegration = integrationConfigs.value[0]
      if (!mainIntegration) return

      if (!mainIntegration.config) {
        mainIntegration.config = {}
      }

      const existingSchema: CustomSyncSchema = mainIntegration.config.custom_schema || {}
      const existingKeys = Object.keys(existingSchema)

      // SQL sources expose an explicit table selection via `config.tables`. When present, the
      // cached schema is only valid if it covers exactly that selection.
      const hasTableSelection = Array.isArray(mainIntegration.config.tables)
      const selectedTables: string[] = hasTableSelection ? mainIntegration.config.tables : []
      const schemaMatchesSelection =
        selectedTables.length === existingKeys.length && existingKeys.every((key) => selectedTables.includes(key))

      if (hasTableSelection ? schemaMatchesSelection && existingKeys.length > 0 : existingKeys.length > 0) {
        return
      }

      isLoadingSchema.value = true
      try {
        const fetchedSchema: CustomSyncSchema = (await integrationFetchDestinationSchema(mainIntegration)) || {}

        const mergedSchema: CustomSyncSchema = {}
        for (const tableName of Object.keys(fetchedSchema)) {
          if (existingSchema[tableName]) {
            mergedSchema[tableName] = existingSchema[tableName]
          } else {
            buildTableDefaults(fetchedSchema[tableName])
            mergedSchema[tableName] = fetchedSchema[tableName]
          }
        }

        mainIntegration.config.custom_schema = mergedSchema
      } catch (error) {
        message.error(await extractSdkResponseErrorMsgv2(error as any))
      } finally {
        isLoadingSchema.value = false
      }
    }

    function loadDestinationSchema() {
      pendingSchemaLoad = pendingSchemaLoad.then(reloadDestinationSchemaIfStale)
      return pendingSchemaLoad
    }

    const supportedDocs = [
      {
        title: 'How syncs work',
        href: 'https://nocodb.com/docs/product-docs/noco-sync#how-sync-works',
      },
      {
        title: 'Choosing a sync type',
        href: 'https://nocodb.com/docs/product-docs/noco-sync#sync-types',
      },
      {
        title: 'Configure sync triggers',
        href: 'https://nocodb.com/docs/product-docs/noco-sync#sync-trigger',
      },
      {
        title: 'Select tables to sync',
        href: 'https://nocodb.com/docs/product-docs/noco-sync#add-new-sync',
      },
    ]

    onMounted(async () => {
      const bsId = unref(baseId)

      await Promise.all([loadDynamicIntegrations(), loadIntegrations(null, bsId)])

      // Load existing syncs for validation
      if (bsId) {
        await loadSyncs(bsId)
      }

      const _syncId = unref(syncId)
      if (mode === 'edit' && _syncId) {
        isLoadingIntegrationConfigs.value = true

        try {
          deletedSyncConfigIds.value = []
          const sync = await readSync(_syncId, bsId)
          if (!sync) return
          syncConfigForm.value = {
            ...(sync as SyncConfig),
            meta: {
              ...(getDefaultSyncConfig().meta as Record<string, any>),
              ...parseProp(sync.meta),
            },
          }

          const existingIntegrationConfigs = [sync, ...(sync?.children || [])]

          integrationConfigs.value = (
            await Promise.all(
              existingIntegrationConfigs.map(async (s) => {
                const integration = integrations.value.find((i) => i.id === s.fk_integration_id)

                if (!integration?.id) {
                  return null
                }

                const int = await getIntegration(integration, {
                  includeConfig: true,
                  baseId: unref(baseId),
                })

                if (!int) {
                  return null
                }

                return {
                  ...integration,
                  ...int,
                  syncConfigId: s.id,
                  parentSyncConfigId: s.fk_parent_sync_config_id,
                }
              }),
            )
          ).filter(Boolean) as IntegrationConfig[]

          for (const config of integrationConfigs.value) {
            if (!config.sub_type) continue
            await getIntegrationForm(IntegrationCategoryType.SYNC, config.sub_type)
          }
        } finally {
          isLoadingIntegrationConfigs.value = false
        }
      }
    })

    // Keep the edit form in sync with external changes (undo/redo, another
    // client) — the realtime `app_sync_update` handler updates the store
    // entry; mirror its scalar fields into the open form so the user never
    // saves from a stale snapshot.
    if (mode === 'edit') {
      const { baseSyncs } = storeToRefs(syncStore)

      watch(
        () => (baseSyncs.value.get(unref(baseId)) ?? []).find((sync) => sync.id === unref(syncId)),
        (updated) => {
          if (!updated) return
          syncConfigForm.value = {
            ...syncConfigForm.value,
            title: updated.title,
            sync_type: updated.sync_type,
            sync_trigger: updated.sync_trigger,
            sync_trigger_cron: updated.sync_trigger_cron,
            on_delete_action: updated.on_delete_action,
          }
        },
        { deep: true },
      )
    }

    return {
      mode,
      step,
      syncConfigForm,
      validateSyncConfig,
      validateInfosSyncConfig,
      syncConfigEditFormChanged,
      integrationConfigs,
      isLoadingIntegrationConfigs,
      activeBaseSyncs,
      addIntegrationConfig,
      removeIntegrationConfig,
      updateIntegrationConfig,
      availableIntegrations,
      syncCategoryIntegrationMap,
      integrationConfigValidationCallbacks,
      integrationFetchDestinationSchema,
      validateIntegrationConfigs,
      saveSyncConfig,
      updateSyncConfig,
      isSaving,
      isUpdating,
      isLoadingSchema,
      loadDestinationSchema,
      supportedDocs,
      isSyncCategoryAlreadyAddedOrBlank,
      closeForm,
    }
  },
)

export { useSyncForm, useProvideSyncForm }

export function useSyncFormOrThrow() {
  const syncForm = useSyncForm()
  if (syncForm == null) throw new Error('Please call `useProvideSyncForm` on the appropriate parent component')
  return syncForm
}
