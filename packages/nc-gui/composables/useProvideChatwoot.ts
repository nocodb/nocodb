import { OrgUserRoles } from 'nocodb-sdk'

export const useProvideChatwoot = () => {
  const { setUser, setConversationCustomAttributes, setCustomAttributes } = useChatWoot()

  const { $api } = useNuxtApp()

  const { user, appInfo, signedIn } = useGlobal()

  const { orgRoles } = useRoles()
  const router = useRouter()
  const route = router.currentRoute

  const metaInfo = ref()

  const chatwootReady = ref(false)

  const isChatWootEnabled = computed(() => !appInfo.value.disableSupportChat)

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
