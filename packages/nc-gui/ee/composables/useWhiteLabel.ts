import type { WhiteLabelConfig } from 'nocodb-sdk'

const ENDPOINT = '/api/v2/meta/white-label'

export const useWhiteLabel = createSharedComposable(() => {
  const { $state, $api } = useNuxtApp()

  const { appInfo } = useGlobal()

  const baseURL = $api.instance.defaults.baseURL

  const config = ref<WhiteLabelConfig | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)

  const request = <T = any>(opts: Record<string, any> = {}) =>
    $fetch<T>(ENDPOINT, {
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'xc-auth': $state.token.value as string,
      },
      ...opts,
    })

  const load = async () => {
    try {
      isLoading.value = true
      config.value = await request<WhiteLabelConfig>()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  const save = async (next: Partial<WhiteLabelConfig>) => {
    try {
      isSaving.value = true
      config.value = await request<WhiteLabelConfig>({ method: 'PUT', body: next })

      // Live-apply without a page reload: the admin PUT returns the same
      // signed-URL shape as `getPublicConfig()` (the source of
      // `appInfo.whiteLabel`), except it never nulls out — so mirror that
      // contract here. `useBranding` reads `appInfo.whiteLabel`, so this
      // cascades to the favicon, brand ramp, logos, and product name.
      if (appInfo.value) {
        appInfo.value.whiteLabel = config.value?.enabled ? config.value : null
      }

      return config.value
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      throw e
    } finally {
      isSaving.value = false
    }
  }

  return { config, isLoading, isSaving, load, save }
})
