import { OrgUserRoles } from 'nocodb-sdk'
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

  const { user, appInfo, appInfoStatus, signedIn } = useGlobal()

  const { orgRoles } = useRoles()
  const router = useRouter()
  const route = router.currentRoute

  const metaInfo = ref()

  const chatwootReady = ref(false)

  const { isDark } = useTheme()

  // The widget is created light; keep it in step with the app theme
  const syncColorScheme = () => {
    if (!chatwootReady.value) return
    syncChatwootColorScheme(isDark.value)
  }

  watch(isDark, syncColorScheme)

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
    syncColorScheme()
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
   * `undefined`, which is why the SDK may not be requested earlier.
   */
  watch(
    () => appInfoStatus.value === 'loaded' && isChatWootEnabled.value,
    (isEnabled) => {
      if (!isEnabled) return

      injectChatwootSdk()
    },
    { immediate: true },
  )

  router.afterEach(() => {
    initUserCustomerAttributes()
  })

  // `/api/v1/aggregated-meta-info` enumerates every base on the instance with a
  // per-source row COUNT, and since it was put behind GlobalGuard + an ACL that
  // only the SUPER_ADMIN wildcard grants, it answers 401 when signed out and 403
  // for everyone else. It was still being fired on mount for every visitor, and
  // the signed-out 401 fed the axios interceptor, whose token refresh then
  // force-signed-out the session.
  //
  // Fetch it only when the call can actually succeed. This has to be reactive,
  // not `onMounted`: the composable is instantiated from app.vue at app start,
  // which always precedes sign-in, so a mount-time guard would never fire.
  watch(
    [signedIn, () => !!orgRoles.value?.[OrgUserRoles.SUPER_ADMIN], () => appInfo.value.disableSupportChat],
    ([isSignedIn, isSuperAdmin, disableSupportChat]) => {
      if (disableSupportChat || !isSignedIn || !isSuperAdmin || metaInfo.value) return

      loadAggMetaInfo()
    },
    { immediate: true },
  )

  return {
    chatwootInit,
    isChatWootEnabled,
  }
}
