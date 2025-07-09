export function useProvideChatwoot() {
  const {toggleBubbleVisibility, setUser, setConversationCustomAttributes} = useChatWoot()
  const { user, appInfo } = useGlobal()
  const router = useRouter()
  const { activeWorkspace } = storeToRefs(useWorkspace())
  const route = router.currentRoute

  const chatwootReady = ref(false)

  const chatwootInit = () => {
    toggleBubbleVisibility('hide')
    chatwootReady.value = true
  }

  watch(
    [() => chatwootReady.value, () => user.value?.email, () => route.value?.params],
    ([chatwootReady, email, params]) => {
      if (!chatwootReady || !window.$chatwoot) return

      const userId = user.value?.id as string
      const identity_hash = (user.value as any)?.identity_hash as string
      const baseId = params?.baseId as string
      const workspaceId = params?.typeOrId as string

      setUser(userId, {
        email,
        name: user.value?.display_name || '',
        identifier_hash: identity_hash,
      })

      setConversationCustomAttributes({
        user_id: String(userId),
        email: email || '',
        base_id: baseId || '',
        workspace_id: workspaceId || '',
        workspace_plan: activeWorkspace.value?.payment?.plan?.title ?? 'free',
        is_cloud: `${appInfo.value.isCloud}`,
        is_onprem: `${appInfo.value.isOnPrem}`,
      })
    },
    { immediate: true },
  )

  router.afterEach((to) => {
    if (!chatwootReady.value || !window.$chatwoot) return

    if (ncIsPlaywright() || !user.value) {
      return
    }

    const userId = user.value?.id as string
    const email = user.value.email as string
    const identity_hash = (user.value as any)?.identity_hash as string

    setUser(userId, {
      email,
      name: user.value?.display_name || '',
      identifier_hash: identity_hash,
    })

    setConversationCustomAttributes({
      user_id: userId,
      email,
      base_id: to.params?.baseId as string,
      workspace_id: to.params?.typeOrId as string,
      workspace_plan: activeWorkspace.value?.payment?.plan?.title ?? 'free',
      is_cloud: `${appInfo.value.isCloud}`,
      is_onprem: `${appInfo.value.isOnPrem}`,
    })

  })

  onMounted(() => {
    window.addEventListener('chatwoot:ready', chatwootInit)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('chatwoot:ready', chatwootInit)
  })
}
