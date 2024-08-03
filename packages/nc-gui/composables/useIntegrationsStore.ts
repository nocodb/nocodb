import type { IntegrationType } from 'nocodb-sdk'
import { IntegrationsType } from 'nocodb-sdk'
import { ClientType } from '../lib/enums'
import GeneralBaseLogo from '~/components/general/BaseLogo.vue'
import type { IntegrationStoreEvents as IntegrationStoreEventsTypes } from '#imports'

enum IntegrationsPageMode {
  LIST,
  ADD,
  EDIT,
}

const integrationType: Record<'PostgreSQL' | 'MySQL', ClientType> = {
  PostgreSQL: ClientType.PG,
  MySQL: ClientType.MYSQL,
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
  }
}

const [useProvideIntegrationViewStore, _useIntegrationStore] = useInjectionState(() => {
  const { api } = useApi()
  const pageMode = ref<IntegrationsPageMode | null>(null)
  const activeIntegration = ref<IntegrationType | null>(null)

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const integrations = ref<IntegrationType[]>([])
  const deleteConfirmText = ref<string | null>()

  const isLoadingIntegrations = ref(false)

  const eventBus = useEventBus<IntegrationStoreEventsTypes>(Symbol('integrationStore'))

  const { $e } = useNuxtApp()

  const requestIntegration = ref({
    isOpen: false,
    msg: '',
    isLoading: false,
  })

  const loadIntegrations = async (databaseOnly = false) => {
    try {
      if (!activeWorkspaceId.value) return
      isLoadingIntegrations.value = true

      const response = await api.integration.list(
        databaseOnly
          ? {
              type: IntegrationsType.Database,
              includeDatabaseInfo: true,
            }
          : undefined,
      )

      integrations.value = response.list
    } catch (e) {
      await message.error(await extractSdkResponseErrorMsg(e))
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
    if (!integration.id) return

    try {
      await api.integration.delete(integration.id, {
        query: force ? { force: 'true' } : {},
      })

      $e('a:integration:delete')
      await loadIntegrations()

      // await message.success(`Connection ${integration.title} deleted successfully`)

      return true
    } catch (e) {
      const errMsg = await extractSdkResponseErrorMsg(e)
      if (!force && errMsg?.includes('Integration linked with')) {
        deleteConfirmText.value = `${errMsg.replace(
          /^Error:\s*/,
          '',
        )}. Do you want to delete it anyway, along with linked sources?`
        return
      }
      await message.error(errMsg)
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

      await loadIntegrations(loadDatasourceInfo)

      eventBus.emit(IntegrationStoreEvents.INTEGRATION_ADD, response)

      pageMode.value = null
      activeIntegration.value = null

      if (response?.title && mode === 'create') {
        await message.success(`Connection "${response.title}" created successfully`)
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

  const editIntegration = async (integration: IntegrationType) => {
    try {
      const integrationWithConfig = await api.integration.read(integration.id, {
        includeConfig: true,
      })
      activeIntegration.value = integrationWithConfig
      pageMode.value = IntegrationsPageMode.EDIT

      $e('c:integration:edit')
    } catch (e) {
      await message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveIntegraitonRequest = async (msg: string) => {
    if (!msg?.trim()) return

    requestIntegration.value.isLoading = true
    try {
      // Todo: api integration

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
    addIntegration,
    loadIntegrations,
    deleteIntegration,
    updateIntegration,
    saveIntegration,
    editIntegration,
    duplicateIntegration,
    eventBus,
    saveIntegraitonRequest,
    requestIntegration,
  }
}, 'integrations-store')

export { useProvideIntegrationViewStore }

export function useIntegrationStore() {
  const integrationStore = _useIntegrationStore()

  if (integrationStore == null) return useProvideIntegrationViewStore()

  return integrationStore
}
