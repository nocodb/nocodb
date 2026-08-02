import { createChatWoot } from '@productdevbook/chatwoot/vue'
import type { OptionPlugin } from '@productdevbook/chatwoot/vue'

/**
 * Tracks whether the chatwoot SDK script has already been injected. `useProvideChatwoot` is called
 * from more than one component, so the guard has to live outside of it.
 */
let isChatwootSdkInjected = false

export const useProvideChatwoot = () => {
  const { setUser, setConversationCustomAttributes, setCustomAttributes } = useChatWoot()

  const nuxtApp = useNuxtApp()

  const { $api } = nuxtApp

  const { chatwoot: chatwootConfig } = useRuntimeConfig().public

  const { user, appInfo, appInfoStatus } = useGlobal()
  const router = useRouter()
  const route = router.currentRoute

  const metaInfo = ref()

  const chatwootReady = ref(false)

  const isChatWootEnabled = computed(() => !appInfo.value.disableSupportChat)

  /**
   * Injects the chatwoot SDK script. Deferred until `appInfo` is loaded so that an instance started
   * with `NC_DISABLE_SUPPORT_CHAT=true` makes no request to chatwoot at all - `disableSupportChat` is
   * only known once the backend has answered, and the SDK starts talking to `baseUrl` as soon as it
   * is on the page.
   */
  const injectChatwootSdk = () => {
    if (isChatwootSdkInjected) return

    isChatwootSdkInjected = true

    // runtime config widens the literal types it is declared with (`darkMode: string`), hence the cast
    nuxtApp.vueApp.use(createChatWoot(chatwootConfig as OptionPlugin))
  }

  const initUserCustomerAttributes = () => {
    if (!chatwootReady.value || ncIsPlaywright() || !user.value?.id || appInfo.value.disableSupportChat) {
      return
    }

    const baseId = route.value?.params?.baseId as string

    const userId = user.value?.id as string
    const identity_hash = (user.value as any)?.identity_hash as string

    // userId has to be string for chatwoot sdk
    setUser(userId, {
      email: user.value?.email,
      name: user.value?.display_name || '',
      identifier_hash: identity_hash,
    })

    setCustomAttributes({
      is_oss: true as any,
    })

    setConversationCustomAttributes({
      user_id: String(userId),
      email: user.value?.email || '',
      base_id: baseId || '',
      user_count: metaInfo.value?.userCount || 0,
      bases_count: metaInfo.value?.baseCount || 0,
    })
  }

  const chatwootInit = async () => {
    if (ncIsIframe() || appInfo.value.disableSupportChat) return
    chatwootReady.value = true
    initUserCustomerAttributes()
  }

  const loadAggMetaInfo = async () => {
    try {
      metaInfo.value = await $api.utils.aggregatedMetaInfo()
    } catch (e) {}
  }

  watch(
    [() => user.value?.email, () => user.value?.id, () => appInfo.value.disableSupportChat, () => metaInfo.value],
    () => {
      initUserCustomerAttributes()
    },
    { immediate: true },
  )

  /**
   * `disableSupportChat` is only meaningful once `appInfo` has been fetched - until then it reads as
   * `undefined`, which is why neither the SDK nor the metadata it reports on may be requested earlier.
   */
  watch(
    () => appInfoStatus.value === 'loaded' && isChatWootEnabled.value,
    (isEnabled) => {
      if (!isEnabled) return

      injectChatwootSdk()
      loadAggMetaInfo()
    },
    { immediate: true },
  )

  router.afterEach(() => {
    initUserCustomerAttributes()
  })

  return {
    chatwootInit,
    isChatWootEnabled,
  }
}
