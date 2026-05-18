import type { PublicDocContentResponse, PublicDocMetaResponse } from 'nocodb-sdk'

/**
 * Public reader composable for shared docs. Sibling to useSharedView — owns:
 *   - manifest fetch (root + subtree titles), gated by optional password
 *   - per-doc content fetch on navigation
 *   - password handshake (HTTP 403 → reveal password input)
 *
 * Not exported as createSharedComposable: each public-doc page mount gets a
 * fresh instance so navigating between two shared links doesn't leak state.
 */
export function useSharedDoc() {
  const { appInfo } = useGlobal()

  const meta = useState<PublicDocMetaResponse | null>('shared-doc-meta', () => null)
  const activeContent = useState<PublicDocContentResponse | null>('shared-doc-content', () => null)
  const isLoading = ref(false)
  const requiresPassword = ref(false)
  const password = useState<string | undefined>('shared-doc-password', () => undefined)

  const setPassword = (val: string | undefined) => {
    password.value = val
  }

  const baseUrl = computed(
    () => appInfo.value?.ncSiteUrl?.replace(/\/$/, '') ?? '',
  )

  const buildHeaders = () =>
    password.value ? { 'xc-password': password.value } : undefined

  const loadMeta = async (uuid: string): Promise<boolean> => {
    isLoading.value = true
    try {
      const res = await $fetch<PublicDocMetaResponse>(
        `${baseUrl.value}/api/v2/public/shared-doc/${uuid}/meta`,
        { headers: buildHeaders() as any },
      )
      meta.value = res
      requiresPassword.value = false
      return true
    } catch (e: any) {
      // Backend signals password requirement via the InvalidSharedViewPassword
      // error — surface as a flag to the UI rather than a thrown error.
      const status = e?.response?.status ?? e?.status
      const body = e?.response?._data ?? e?.data
      if (
        status === 403 ||
        body?.error === 'ERR_INVALID_SHARED_VIEW_PASSWORD' ||
        /password/i.test(body?.message ?? '')
      ) {
        requiresPassword.value = true
        return false
      }
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const loadDoc = async (uuid: string, docId: string): Promise<boolean> => {
    isLoading.value = true
    try {
      const res = await $fetch<PublicDocContentResponse>(
        `${baseUrl.value}/api/v2/public/shared-doc/${uuid}/doc/${docId}/content`,
        { headers: buildHeaders() as any },
      )
      activeContent.value = res
      return true
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status
      const body = e?.response?._data ?? e?.data
      if (
        status === 403 ||
        body?.error === 'ERR_INVALID_SHARED_VIEW_PASSWORD'
      ) {
        requiresPassword.value = true
        return false
      }
      throw e
    } finally {
      isLoading.value = false
    }
  }

  return {
    meta,
    activeContent,
    isLoading,
    requiresPassword,
    password,
    setPassword,
    loadMeta,
    loadDoc,
  }
}
