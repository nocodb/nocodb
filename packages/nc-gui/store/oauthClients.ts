import type { OAuthClient } from 'nocodb-sdk'
import { NO_SCOPE } from 'nocodb-sdk'

export const useOAuthClients = defineStore('oauthClientsStore', () => {
  const { $api, $e } = useNuxtApp()

  const oauthClients = ref<OAuthClient[]>([])

  const isOauthClientsLoading = ref(false)

  const loadOAuthClients = async ({ force = false }: { force?: boolean } = {}) => {
    if (oauthClients.value.length > 0 && !force) {
      return oauthClients.value
    }

    try {
      const response = (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
        operation: 'oAuthClientList',
      })) as OAuthClient[]

      oauthClients.value = response
      return response
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return []
    }
  }

  const loadOAuthClient = async (clientId: string) => {
    if (!clientId) return null

    let client: null | OAuthClient = null

    // Check if client exists in cache
    client = oauthClients.value.find((c) => c.client_id === clientId) || null

    try {
      if (!client) {
        client = (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
          operation: 'oAuthClientGet',
          clientId,
        })) as unknown as OAuthClient

        const filtered = oauthClients.value.filter((c) => c.client_id !== clientId)
        filtered.push(client)
        oauthClients.value = filtered
      }

      return client
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const createOAuthClient = async (clientData: Partial<OAuthClient>) => {
    try {
      const created = await $api.internal.postOperation(
        NO_SCOPE,
        NO_SCOPE,
        {
          operation: 'oAuthClientCreate',
        },
        clientData,
      )

      oauthClients.value.push({
        ...created,
        ___is_new: true,
      } as any)

      $e('a:oauth-client:create')

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const updateOAuthClient = async (
    clientId: string,
    updates: Partial<OAuthClient>,
    options?: {
      skipNetworkCall?: boolean
    },
  ) => {
    try {
      const client = oauthClients.value.find((c) => c.client_id === clientId)
      const updated = options?.skipNetworkCall
        ? {
            ...client,
            ...updates,
          }
        : await $api.internal.postOperation(
            NO_SCOPE,
            NO_SCOPE,
            {
              operation: 'oAuthClientUpdate',
              clientId,
            },
            updates,
          )

      const index = oauthClients.value.findIndex((c) => c.client_id === clientId)

      if (index !== -1) {
        oauthClients.value[index] = updated as any
      }

      $e('a:oauth-client:update')

      return updated
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const deleteOAuthClient = async (clientId: string) => {
    try {
      await $api.internal.postOperation(
        NO_SCOPE,
        NO_SCOPE,
        {
          operation: 'oAuthClientDelete',
          clientId,
        },
        {},
      )

      // Update local state
      oauthClients.value = oauthClients.value.filter((c) => c.client_id !== clientId)

      $e('a:oauth-client:delete')

      return true
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return false
    }
  }

  return {
    oauthClients,
    isOauthClientsLoading,
    loadOAuthClients,
    loadOAuthClient,
    createOAuthClient,
    updateOAuthClient,
    deleteOAuthClient,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useOAuthClients as any, import.meta.hot))
}
