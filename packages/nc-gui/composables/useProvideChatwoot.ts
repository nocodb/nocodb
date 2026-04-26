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

    // When support chat is disabled, hide the widget immediately and prevent
    // any further SDK activity. The @productdevbook/chatwoot nuxt module always
    // injects the Chatwoot script at build time, so we must opt-out at runtime.
    if (appInfo.value.disableSupportChat) {
      try {
        // Hide the bubble so it never appears in the UI
        window.$chatwoot?.toggleBubbleVisibility('hide')
        // Reset clears queued events and stops the SDK from sending data
        window.$chatwoot?.reset()
      } catch (_e) {
        // SDK may not be fully initialised — safe to ignore
      }
      return
    }

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
      if (appInfo.value.disableSupportChat && chatwootReady.value) {
        // Support chat was disabled after the SDK had already initialised —
        // hide the bubble and reset any queued session data.
        try {
          window.$chatwoot?.toggleBubbleVisibility('hide')
          window.$chatwoot?.reset()
        } catch (_e) {}
        chatwootReady.value = false
        return
      }
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
