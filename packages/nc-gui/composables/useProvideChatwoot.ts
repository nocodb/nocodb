export const useProvideChatwoot = () => {
  const { $api } = useNuxtApp()

  const { user, appInfo } = useGlobal()
  const router = useRouter()
  const route = router.currentRoute

  const metaInfo = ref()

  const chatwootReady = ref(false)

  const isChatWootEnabled = computed(
    () => !appInfo.value.disableSupportChat && (metaInfo.value?.userCount || 0) > 0 && !ncIsPlaywright(),
  )

  const initUserCustomerAttributes = () => {
    if (
      !chatwootReady.value ||
      ncIsPlaywright() ||
      appInfo.value.disableSupportChat ||
      !isChatWootEnabled.value ||
      !window.$chatwoot
    ) {
      return
    }

    const baseId = route.value?.params?.baseId as string

    const userId = user.value?.id as string

    const email = user?.value?.email

    if (!userId || !email) {
      return
    }

    window.$chatwoot.setUser(userId, {
      email: user.value?.email,
      name: user.value?.display_name || '',
    })

    window.$chatwoot.setCustomAttributes({
      is_oss: true as any,
      user_count: metaInfo.value?.userCount || 0,
      bases_count: metaInfo.value?.baseCount || 0,
    })

    window.$chatwoot.setConversationCustomAttributes({
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
    { immediate: true, deep: true },
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
