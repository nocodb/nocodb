export const useProvideChatwoot = () => {
  const { setUser, setConversationCustomAttributes, setCustomAttributes } = useChatWoot()

  const { $api } = useNuxtApp()

  const { user, appInfo } = useGlobal()
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
    if (ncIsIframe()) return
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

  onMounted(() => {
    loadAggMetaInfo()
  })

  return {
    chatwootInit,
    isChatWootEnabled,
  }
}
