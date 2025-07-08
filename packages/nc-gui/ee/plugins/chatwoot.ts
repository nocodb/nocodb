import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(() => {
  const chatwoot = useChatWoot()
  const { user, appInfo } = useGlobal()
  const router = useRouter()
  const { activeWorkspace } = storeToRefs(useWorkspace())
  const route = router.currentRoute

  let chatwootReady = false

  window.addEventListener('chatwoot:ready', () => {
    chatwootReady = true

    watch(
      [() => user.value?.email, () => route.value?.params],
      ([email, params]) => {
        if (!chatwootReady || !chatwoot || !window.$chatwoot) return

        if (ncIsPlaywright()) {
          window.$chatwoot.toggleBubbleVisibility('hide')
          return
        }

        if (!email) {
          window.$chatwoot.toggleBubbleVisibility('hide')
          return
        }

        const userId = user.value?.id as string
        const identity_hash = (user.value as any)?.identity_hash as string
        const baseId = params?.baseId as string
        const workspaceId = params?.typeOrId as string

        if (!userId) {
          window.$chatwoot.toggleBubbleVisibility('hide')
        }

        window.$chatwoot.setUser(userId, {
          email,
          name: user.value?.display_name || '',
          identifier_hash: identity_hash,
        })

        window.$chatwoot.setConversationCustomAttributes({
          user_id: String(userId),
          email,
          base_id: baseId || '',
          workspace_id: workspaceId || '',
          workspace_plan: activeWorkspace.value?.plan?.title ?? 'free',
          is_cloud: `${appInfo.value.isCloud}`,
          is_onprem: `${appInfo.value.isOnPrem}`,
        })

        window.$chatwoot.toggleBubbleVisibility('show')
      },
      { immediate: true },
    )

    router.afterEach((to) => {
      if (!chatwootReady || !chatwoot || !window.$chatwoot) return

      if (ncIsPlaywright()) {
        window.$chatwoot.toggleBubbleVisibility('hide')
        return
      }

      if (!user?.value) {
        window.$chatwoot.toggleBubbleVisibility('hide')
        return
      }

      const userId = user.value?.id as string
      const email = user.value.email as string
      const identity_hash = (user.value as any)?.identity_hash as string

      window.$chatwoot.setUser(userId, {
        email,
        name: user.value?.display_name || '',
        identifier_hash: identity_hash,
      })

      window.$chatwoot.setConversationCustomAttributes({
        user_id: userId,
        email,
        base_id: to.params?.baseId as string,
        workspace_id: to.params?.typeOrId as string,
        workspace_plan: activeWorkspace.value?.payment?.plan?.title ?? 'free',
        is_cloud: `${appInfo.value.isCloud}`,
        is_onprem: `${appInfo.value.isOnPrem}`,
      })

      window.$chatwoot.toggleBubbleVisibility('show')
    })
  })
})
