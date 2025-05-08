import type { FunctionalComponent, SVGAttributes } from 'vue'
import type { FormDefinition, IntegrationCategoryType, IntegrationType, PaginatedType } from 'nocodb-sdk'
import { ClientType, IntegrationsType, SyncDataType } from 'nocodb-sdk'
import { getI18n } from '../../plugins/a.i18n'
import GeneralBaseLogo from '~/components/general/BaseLogo.vue'
import type { IntegrationItemType, IntegrationStoreEvents as IntegrationStoreEventsTypes } from '#imports'

enum IntegrationsPageMode {
  LIST,
  ADD,
  EDIT,
}

const integrationType: Record<'PostgreSQL' | 'MySQL' | 'OpenAI', ClientType | SyncDataType> = {
  PostgreSQL: ClientType.PG,
  MySQL: ClientType.MYSQL,
  OpenAI: SyncDataType.OPENAI,
}

type IntegrationsSubType = (typeof integrationType)[keyof typeof integrationType]

function getStaticInitializor(type: IntegrationsSubType) {
  const genericValues = {
    payload: {},
  }

  switch (type) {
    case integrationType.PostgreSQL:
      return {
        ...genericValues,
        type: integrationType.PostgreSQL,
        title: 'PostgreSQL',
        logo: h(GeneralBaseLogo, {
          'source-type': 'pg',
          'class': 'logo',
        }),
      }
    case integrationType.MySQL:
      return {
        ...genericValues,
        type: integrationType.MySQL,
        title: 'MySQL',
        logo: h(GeneralBaseLogo, {
          'source-type': 'mysql2',
          'class': 'logo',
        }),
      }
    case SyncDataType.NOCODB:
      return {
        ...allIntegrations.find((i) => i.sub_type === SyncDataType.NOCODB),
        title: 'NocoDB',
      }
  }
}

const integrationForms: Record<string, FormDefinition> = {}

const [useProvideIntegrationViewStore, _useIntegrationStore] = useInjectionState(() => {
  const router = useRouter()
  const route = router.currentRoute

  const { api } = useApi()
  const pageMode = ref<IntegrationsPageMode | null>(null)
  const activeIntegration = ref<(IntegrationType & { dynamic: boolean }) | null>(null)
  const activeIntegrationItem = ref<IntegrationItemType | null>(null)

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const { basesList } = storeToRefs(useBases())

  const integrations = ref<IntegrationType[]>([])

  const searchQuery = ref('')

  const integrationsCategoryFilter = ref<string[]>([])

  const integrationPaginationData = ref<PaginatedType>({ page: 1, pageSize: 25, totalRows: 0 })

  const deleteConfirmText = ref<string | null>()

  const isLoadingIntegrations = ref(false)

  const eventBus = useEventBus<IntegrationStoreEventsTypes>(Symbol('integrationStore'))

  const { $api, $e } = useNuxtApp()

  const t = (msg: string) => getI18n().global.t(msg)

  const { aiIntegrations } = useNocoAi()

  const isFromIntegrationPage = ref(false)

  const integrationsRefreshKey = ref(0)

  const requestIntegration = ref({
    isOpen: false,
    msg: '',
    isLoading: false,
  })

  const successConfirmModal = ref({
    isOpen: false,
    title: t('msg.success.connectionAdded'),
    connectionTitle: '',
    description: t('msg.success.connectionAddedDesc'),
  })

  const activeViewTab = computed({
    get() {
      return (route.value.query?.tab as string) ?? 'integrations'
    },
    set(tab: string) {
      if (requestIntegration.value.isOpen) {
        requestIntegration.value.isOpen = false
      }
      router.push({ query: { ...route.value.query, tab } })
    },
  })

  const loadIntegrations = async (type: IntegrationsType | null = null, baseId: string | undefined = undefined) => {
    try {
      if (!activeWorkspaceId.value) return
      isLoadingIntegrations.value = true

      const { list } = await api.integration.list(
        activeWorkspaceId.value,
        type
          ? {
              type,
              includeDatabaseInfo: type === IntegrationsType.Database,
              baseId,
            }
          : {
              ...(searchQuery.value.trim() ? { query: searchQuery.value } : {}),
            },
      )

      integrations.value = list

      integrations.value.unshift({
        id: 'nc-data-reflection',
        title: 'NocoDB',
        sub_type: SyncDataType.NOCODB,
        type: IntegrationsType.Database,
        fk_workspace_id: activeWorkspaceId.value,
        source_count: basesList.value.length,
      })

      if (!type) {
        integrationPaginationData.value.totalRows = list.filter((i) => ![IntegrationsType.Sync].includes(i.type)).length || 0
      }
    } catch (e) {
      await message.error(await extractSdkResponseErrorMsg(e))
      integrations.value = []
      integrationPaginationData.value.totalRows = 0
      integrationPaginationData.value.page = 1
    } finally {
      isLoadingIntegrations.value = false
    }
  }

  const getIntegrationForm = async (type: IntegrationCategoryType | IntegrationsType, subType: string) => {
    if (subType in integrationForms) {
      return integrationForms[subType]
    }

    const integrationInfo = await $api.integrations.info(type, subType)

    if (integrationInfo?.form) {
      integrationForms[subType] = integrationInfo.form
      return integrationInfo.form
    }

    return null
  }

  const addIntegration = async (integration: IntegrationItemType) => {
    activeIntegration.value = integration.dynamic ? integration : getStaticInitializor(integration.sub_type)
    activeIntegrationItem.value = integration

    if (integration.dynamic === true) {
      activeIntegrationItem.value.form = await getIntegrationForm(integration.type, integration.sub_type)
    }

    pageMode.value = IntegrationsPageMode.ADD
    $e('c:integration:add')
  }

  const deleteIntegration = async (integration: IntegrationType, force = false) => {
    if (!integration?.id) return

    $e('a:integration:delete')

    try {
      await api.integration.delete(integration.id, {
        query: force ? { force: 'true' } : {},
      })

      if (integration.type === IntegrationsType.Ai) {
        aiIntegrations.value = aiIntegrations.value.filter((i) => i.id !== integration.id)
      }

      await loadIntegrations()

      // await message.success(`Connection ${integration.title} deleted successfully`)

      return true
    } catch (e) {
      const error = await extractSdkResponseErrorMsgv2(e)

      if (error.error === NcErrorType.INTEGRATION_NOT_FOUND) {
        await message.error(error.message?.replace(integration.id, integration.title!))
        window.location.reload()
        return
      }

      await message.error(await extractSdkResponseErrorMsg(e))
    }
    deleteConfirmText.value = null
  }

  const updateIntegration = async (integration: IntegrationType) => {
    if (!integration.id) return

    $e('a:integration:update')

    try {
      await api.integration.update(integration.id, integration)

      if (integration.type === IntegrationsType.Ai) {
        aiIntegrations.value = aiIntegrations.value.map((i) => {
          if (i.id === integration.id) {
            i.title = integration.title
          }

          return i
        })
      }

      await loadIntegrations()

      pageMode.value = null
      activeIntegration.value = null

      await message.success(`Connection "${integration.title}" updated successfully`)
    } catch (e) {
      await message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const setDefaultIntegration = async (integration: IntegrationType) => {
    if (!integration.id) return

    $e('a:integration:set-default')

    try {
      await api.integration.setDefault(integration.id)

      if (integration.type === IntegrationsType.Ai) {
        aiIntegrations.value = aiIntegrations.value.map((i) => {
          if (i.id === integration.id) {
            i.is_default = true
          } else {
            i.is_default = false
          }

          return i
        })
      }

      await loadIntegrations()

      pageMode.value = null
      activeIntegration.value = null

      await message.success(`Connection "${integration.title}" set as default successfully`)
    } catch (e) {
      await message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveIntegration = async (
    integration: IntegrationType,
    mode: 'create' | 'duplicate' = 'create',
    loadDatasourceInfo = false,
    baseId: string | undefined = undefined,
  ) => {
    if (mode === 'create') {
      $e('a:integration:create')
    } else {
      $e('a:integration:duplicate')
    }

    try {
      const response = await api.integration.create(activeWorkspaceId.value, integration)

      if (response && response?.id) {
        if (!loadDatasourceInfo) {
          integrations.value.push(response)
        }

        if (response.type === IntegrationsType.Ai) {
          aiIntegrations.value.push({
            id: response.id,
            title: response.title,
            is_default: response.is_default,
            type: response.type,
            sub_type: response.sub_type,
          })
        }
      }

      await loadIntegrations(loadDatasourceInfo ? IntegrationsType.Database : null, baseId)

      if (mode === 'create') {
        eventBus.emit(IntegrationStoreEvents.INTEGRATION_ADD, response)
      }

      pageMode.value = null
      activeIntegration.value = null

      if (response?.title && mode === 'create') {
        if (isFromIntegrationPage.value) {
          activeViewTab.value = 'connections'

          if (response.type === IntegrationsType.Database) {
            successConfirmModal.value.connectionTitle = response.title ?? ''
            successConfirmModal.value.isOpen = true
          }
        } else {
          await message.success(`Connection "${response.title}" created successfully`)
        }
      }
    } catch (e) {
      await message.error(await extractSdkResponseErrorMsg(e))
    }
  }
  const duplicateIntegration = async (integration: IntegrationType) => {
    if (!integration?.id) return

    try {
      isLoadingIntegrations.value = true

      saveIntegration(
        {
          title: integration.title,
          config: {},
          type: integration.type,
          copy_from_id: integration.id,
        },
        'duplicate',
      )
    } catch (e) {
      await message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoadingIntegrations.value = false
    }
  }

  const getIntegration = async (
    integration: IntegrationType,
    options?: {
      includeConfig?: boolean
      includeSources?: boolean
    },
  ) => {
    if (!integration?.id) return

    try {
      const integrationWithConfig = await api.integration.read(integration.id, {
        ...(options || {}),
      })
      return integrationWithConfig
    } catch (e) {
      const error = await extractSdkResponseErrorMsgv2(e)

      if (error.error === NcErrorType.INTEGRATION_NOT_FOUND) {
        await message.error(error.message?.replace(integration.id!, integration.title!))
        window.location.reload()
        return
      }

      await message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const editIntegration = async (integration: IntegrationType) => {
    if (!integration?.id) return

    try {
      if (integration.sub_type === SyncDataType.NOCODB) {
        pageMode.value = IntegrationsPageMode.EDIT

        activeIntegration.value = integration

        const integrationItem = allIntegrations.find(
          (item) => item.type === integration.type && item.sub_type === integration.sub_type,
        )!

        activeIntegrationItem.value = integrationItem
        return
      }

      const integrationWithConfig = await getIntegration(integration, { includeConfig: true })
      activeIntegration.value = integrationWithConfig

      const integrationItem = allIntegrations.find(
        (item) => item.type === integration.type && item.sub_type === integration.sub_type,
      )!

      activeIntegrationItem.value = integrationItem

      if (integrationItem.dynamic === true && !(integrationItem.sub_type in integrationForms)) {
        const integrationInfo = await $api.integrations.info(integrationItem.type, integrationItem.sub_type)

        if (integrationInfo?.form) {
          integrationForms[integrationItem.sub_type] = integrationInfo.form

          activeIntegrationItem.value.form = integrationInfo.form
        }
      } else if (integrationItem.dynamic === true) {
        activeIntegrationItem.value.form = integrationForms[integrationItem.sub_type]
      }

      pageMode.value = IntegrationsPageMode.EDIT

      $e('c:integration:edit')
    } catch {}
  }

  const saveIntegrationRequest = async (msg: string) => {
    if (!msg?.trim()) return

    requestIntegration.value.isLoading = true
    try {
      $e('a:integration:new-request', {
        value: requestIntegration.value.msg,
      })

      requestIntegration.value.isLoading = false
      requestIntegration.value.isOpen = false
      requestIntegration.value.msg = ''

      await message.success('Your request has been successfully submitted')
    } catch (e) {
      requestIntegration.value.isLoading = false
      await message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const listIntegrationByType = async (type: IntegrationsType) => {
    if (!activeWorkspaceId.value) return

    const { list } = await $api.integration.list(activeWorkspaceId.value, {
      type,
    })

    return list
  }

  const loadDynamicIntegrations = async () => {
    if (integrationsInitialized.value) return

    integrationsInitialized.value = true

    try {
      const dynamicIntegrations = (await $api.integrations.list()) as {
        type: IntegrationsType
        sub_type: string
        manifest: {
          title?: string
          icon?: string
          iconStyle?: any
          description?: string
          order?: number
          hidden?: boolean
        }
      }[]

      dynamicIntegrations.sort((a, b) => (a.manifest.order ?? Infinity) - (b.manifest.order ?? Infinity))

      for (const di of dynamicIntegrations) {
        let icon: FunctionalComponent<SVGAttributes, {}, any, {}> | VNode

        if (di.manifest.icon) {
          if (di.manifest.icon in iconMap) {
            icon = iconMap[di.manifest.icon as keyof typeof iconMap]
          } else {
            if (isValidURL(di.manifest.icon)) {
              icon = h('img', {
                src: di.manifest.icon,
                alt: di.manifest.title || di.sub_type,
              })
            }
          }
        } else {
          icon = iconMap.puzzle
        }

        const integration: IntegrationItemType = {
          title: di.manifest.title || di.sub_type,
          sub_type: di.sub_type,
          icon,
          type: di.type,
          iconStyle: di.manifest.iconStyle,
          isAvailable: true,
          dynamic: true,
          hidden: di.manifest?.hidden ?? false,
        }

        allIntegrations.push(integration)

        integrationsRefreshKey.value++
      }
    } catch (e: any) {
      console.error('Error loading dynamic integrations', e)
    }
  }

  const integrationsIconMap = computed(() => {
    // eslint-disable-next-line no-unused-expressions
    integrationsRefreshKey.value

    const map: Record<string, any> = {}

    for (const integration of allIntegrations) {
      map[integration.sub_type] = integration.icon
    }

    return map
  })

  function updateDataReflectionIntegration() {
    const dataReflectionIntegration = integrations.value.find((i) => i.sub_type === SyncDataType.NOCODB)

    if (dataReflectionIntegration) {
      dataReflectionIntegration.source_count = basesList.value.length ?? 0
    }
  }

  watch(
    () => basesList.value?.length,
    () => {
      updateDataReflectionIntegration()
    },
  )

  return {
    IntegrationsPageMode,
    integrationType,
    pageMode,
    activeIntegration,
    activeIntegrationItem,
    integrationsRefreshKey,
    integrations,
    isLoadingIntegrations,
    deleteConfirmText,
    eventBus,
    requestIntegration,
    integrationPaginationData,
    activeViewTab,
    isFromIntegrationPage,
    successConfirmModal,
    searchQuery,
    integrationsCategoryFilter,
    addIntegration,
    loadIntegrations,
    deleteIntegration,
    updateIntegration,
    saveIntegration,
    editIntegration,
    duplicateIntegration,
    saveIntegrationRequest,
    getIntegration,
    setDefaultIntegration,
    integrationsIconMap,
    listIntegrationByType,
    loadDynamicIntegrations,
    getIntegrationForm,
  }
}, 'integrations-store')

export { useProvideIntegrationViewStore }

export function useIntegrationStore() {
  const integrationStore = _useIntegrationStore()

  if (integrationStore == null) return useProvideIntegrationViewStore()

  return integrationStore
}
