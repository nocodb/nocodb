import type { IntegrationType, PaginatedType } from 'nocodb-sdk'
import { IntegrationsType } from 'nocodb-sdk'
import { ClientType } from '../lib/enums'
import GeneralBaseLogo from '~/components/general/BaseLogo.vue'
import type { IntegrationStoreEvents as IntegrationStoreEventsTypes } from '#imports'

enum IntegrationsPageMode {
  LIST,
  ADD,
  EDIT,
}

const integrationType: Record<'PostgreSQL' | 'MySQL' | 'SQLITE', ClientType> = {
  PostgreSQL: ClientType.PG,
  MySQL: ClientType.MYSQL,
  SQLITE: ClientType.SQLITE,
}

type IntegrationsSubType = (typeof integrationType)[keyof typeof integrationType]

function defaultValues(type: IntegrationsSubType) {
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
    case integrationType.SQLITE:
      return {
        ...genericValues,
        type: integrationType.SQLITE,
        title: 'SQLite',
        logo: h(GeneralBaseLogo, {
          'source-type': 'sqlite3',
          'class': 'logo',
        }),
      }
  }
}

const [useProvideIntegrationViewStore, _useIntegrationStore] = useInjectionState(() => {
  const router = useRouter()
  const route = router.currentRoute

  const { api } = useApi()
  const pageMode = ref<IntegrationsPageMode | null>(null)
  const activeIntegration = ref<IntegrationType | null>(null)

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const integrations = ref<IntegrationType[]>([])

  const searchQuery = ref('')

  const integrationPaginationData = ref<PaginatedType>({ page: 1, pageSize: 25, totalRows: 0 })

  const deleteConfirmText = ref<string | null>()

  const isLoadingIntegrations = ref(false)

  const eventBus = useEventBus<IntegrationStoreEventsTypes>(Symbol('integrationStore'))

  const { $e } = useNuxtApp()

  const { t } = useI18n()

  const isFromIntegrationPage = ref(false)

  const successConfirmModal = ref({
    isOpen: false,
    title: t('msg.success.connectionAdded'),
    connectionTitle: '',
    description: t('msg.success.connectionAddedDesc'),
  })

  const requestIntegration = ref({
    isOpen: false,
    msg: '',
    isLoading: false,
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

  const loadIntegrations = async (
    databaseOnly = false,
    baseId = undefined,
    page: number = integrationPaginationData.value.page!,
    limit: number = integrationPaginationData.value.pageSize!,
  ) => {
    try {
      if (!activeWorkspaceId.value) return
      isLoadingIntegrations.value = true

      if (!databaseOnly && limit * (page - 1) > integrationPaginationData.value.totalRows!) {
        integrationPaginationData.value.page = 1
        page = 1
      }

      const { list, pageInfo } = await api.integration.list(
        databaseOnly
          ? {
              type: IntegrationsType.Database,
              includeDatabaseInfo: true,
              baseId,
            }
          : {
              offset: limit * (page - 1),
              limit,
              ...(searchQuery.value.trim() ? { query: searchQuery.value } : {}),
            },
      )

      integrations.value = list
      if (!databaseOnly) {
        integrationPaginationData.value.totalRows = pageInfo.totalRows ?? 0
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
  const addIntegration = (type: IntegrationsSubType) => {
    activeIntegration.value = defaultValues(type)
    pageMode.value = IntegrationsPageMode.ADD
    $e('c:integration:add')
  }

  const deleteIntegration = async (integration: IntegrationType, force = false) => {
    if (!integration?.id) return

    try {
      await api.integration.delete(integration.id, {
        query: force ? { force: 'true' } : {},
      })

      $e('a:integration:delete')
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

    try {
      await api.integration.update(integration.id, integration)

      $e('a:integration:update')
      await loadIntegrations()

      pageMode.value = null
      activeIntegration.value = null

      await message.success(`Connection "${integration.title}" updated successfully`)
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
    try {
      const response = await api.integration.create(integration)
      if (mode === 'create') {
        $e('a:integration:create')
      } else {
        $e('a:integration:duplicate')
      }

      if (response && response?.id) {
        if (!loadDatasourceInfo) {
          integrations.value.push(response)
        }
      }

      await loadIntegrations(loadDatasourceInfo, baseId)

      if (mode === 'create') {
        eventBus.emit(IntegrationStoreEvents.INTEGRATION_ADD, response)
      }

      pageMode.value = null
      activeIntegration.value = null

      if (response?.title && mode === 'create') {
        if (isFromIntegrationPage.value) {
          activeViewTab.value = 'connections'

          successConfirmModal.value.connectionTitle = response.title ?? ''
          successConfirmModal.value.isOpen = true
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
      const integrationWithConfig = await getIntegration(integration, { includeConfig: true })
      activeIntegration.value = integrationWithConfig
      pageMode.value = IntegrationsPageMode.EDIT

      $e('c:integration:edit')
    } catch {}
  }

  const saveIntegraitonRequest = async (msg: string) => {
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

  return {
    IntegrationsPageMode,
    integrationType,
    pageMode,
    activeIntegration,
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
    addIntegration,
    loadIntegrations,
    deleteIntegration,
    updateIntegration,
    saveIntegration,
    editIntegration,
    duplicateIntegration,
    saveIntegraitonRequest,
    getIntegration,
  }
}, 'integrations-store')

export { useProvideIntegrationViewStore }

export function useIntegrationStore() {
  const integrationStore = _useIntegrationStore()

  if (integrationStore == null) return useProvideIntegrationViewStore()

  return integrationStore
}
