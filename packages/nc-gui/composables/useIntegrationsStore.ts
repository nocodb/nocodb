import type { SourceType } from 'nocodb-sdk'
import { IntegrationsType } from 'nocodb-sdk'
import { ClientType } from '../lib/enums'
import GeneralBaseLogo from '~/components/general/BaseLogo.vue'

enum IntegrationsPageMode {
  LIST,
  ADD,
  EDIT,
}

const integrationType: Record<'PostgreSQL' | 'MySQL', ClientType> = {
  PostgreSQL: ClientType.PG,
  MySQL: ClientType.MYSQL,
}

type IntegrationType = (typeof integrationType)[keyof typeof integrationType]

function defaultValues(type: IntegrationType) {
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
  const pageMode = ref(IntegrationsPageMode.LIST)
  const activeIntegration = ref<Integration | null>(null)

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const integrations = ref<Integration[]>([])
  const deleteConfirmText = ref<string>()

  const { $e } = useNuxtApp()

  const loadIntegrations = async (databaseOnly = false) => {
    try {
      if (!activeWorkspaceId.value) return

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
    }
  }
  const addIntegration = (type: IntegrationType) => {
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
      pageMode.value = IntegrationsPageMode.LIST
      activeIntegration.value = null
    } catch (e) {
      await message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveIntegration = async (integration: IntegrationType) => {
    try {
      const response = await api.integration.create(integration)
      $e('a:integration:create')
      integrations.value = response.data
      await loadIntegrations()
      pageMode.value = IntegrationsPageMode.LIST
      activeIntegration.value = null
    } catch (e) {
      await message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const editIntegration = async (integration: SourceType) => {
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

  return {
    IntegrationsPageMode,
    integrationType,
    pageMode,
    addIntegration,
    activeIntegration,
    integrations,
    loadIntegrations,
    deleteIntegration,
    updateIntegration,
    saveIntegration,
    editIntegration,
    deleteConfirmText,
  }
}, 'integrations-store')

export function useIntegrationStore() {
  const integrationStore = _useIntegrationStore()

  if (integrationStore == null) return useProvideIntegrationViewStore()

  return integrationStore
}
