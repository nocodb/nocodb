export const useProvideChatwoot = () => {
  const { setUser, setConversationCustomAttributes } = useChatWoot()
  const { user, appInfo } = useGlobal()
  const router = useRouter()
  const { activeWorkspace } = storeToRefs(useWorkspace())
  const route = router.currentRoute

  const chatwootReady = ref(false)

  const initUserCustomerAttributes = () => {
    if (!chatwootReady.value || ncIsPlaywright() || !user.value?.id) {
      return
    }

    const baseId = route.value?.params?.baseId as string
    const workspaceId = route.value?.params?.typeOrId as string

    const userId = user.value?.id as string
    const identity_hash = (user.value as any)?.identity_hash as string

    // userId has to be string for chatwoot sdk
    setUser(userId, {
      email: user.value?.email,
      name: user.value?.display_name || '',
      identifier_hash: identity_hash,
    })
    setConversationCustomAttributes({
      user_id: String(userId),
      email: user.value?.email || '',
      base_id: baseId || '',
      workspace_id: workspaceId || '',
      workspace_plan: activeWorkspace.value?.payment?.plan?.title ?? 'free',
      is_cloud: `${appInfo.value.isCloud}`,
      is_onprem: `${appInfo.value.isOnPrem}`,
    })
  }

  const chatwootInit = async () => {
    chatwootReady.value = true
    initUserCustomerAttributes()
  }

  watch(
    [() => user.value?.email, () => user.value?.id],
    () => {
      initUserCustomerAttributes()
    },
    { immediate: true },
  )

  router.afterEach(() => {
    initUserCustomerAttributes()
  })

  return {
    chatwootInit,
  }
}
