import type { WhiteLabelConfig } from 'nocodb-sdk'

const ENDPOINT = '/api/v2/meta/white-label'

export const useWhiteLabel = createSharedComposable(() => {
  const { $state, $api } = useNuxtApp()

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
