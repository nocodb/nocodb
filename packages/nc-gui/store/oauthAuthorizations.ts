import { NO_SCOPE } from 'nocodb-sdk'
import type { OAuthAuthorization } from '#imports'

export const useOAuthAuthorizations = defineStore('oauthAuthorizationsStore', () => {
  const { $api, $e } = useNuxtApp()

  const authorizations = ref<OAuthAuthorization[]>([])
  const isLoading = ref(false)

  const loadAuthorizations = async ({ force = false }: { force?: boolean } = {}) => {
    if (authorizations.value.length > 0 && !force) {
      return authorizations.value
    }

    try {
      isLoading.value = true
      const response = await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
        operation: 'oAuthAuthorizationList',
      })

      authorizations.value = response as OAuthAuthorization[]
      return response as OAuthAuthorization[]
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return []
    } finally {
      isLoading.value = false
    }
  }

  const revokeAuthorization = async (tokenId: string) => {
    try {
      await $api.internal.postOperation(
        NO_SCOPE,
        NO_SCOPE,
        {
          operation: 'oAuthAuthorizationRevoke',
        },
        { tokenId },
      )

      authorizations.value = authorizations.value.filter((auth) => auth.id !== tokenId)

      $e('a:oauth-authorization:revoke')

      return true
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return false
    }
  }

  return {
    authorizations,
    isLoading,
    loadAuthorizations,
    revokeAuthorization,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useOAuthAuthorizations as any, import.meta.hot))
}
