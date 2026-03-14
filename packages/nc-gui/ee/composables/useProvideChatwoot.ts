export const useProvideChatwoot = createSharedComposable(() => {
  const { setUser, setConversationCustomAttributes, setCustomAttributes } = useChatWoot()
  const { user, appInfo, appInfoStatus } = useGlobal()
  const router = useRouter()
  const { activeWorkspace } = storeToRefs(useWorkspace())
  const route = router.currentRoute

  const chatwootReady = ref(false)
  const sdkLoaded = ref(false)

  const isChatWootEnabled = computed(() => !appInfo.value.disableSupportChat)

  /**
   * Determine the Chatwoot website token based on deployment mode.
   * - Cloud / licensed on-prem → NC_CHATWOOT_TOKEN (set via NUXT_CHATWOOT_WEBSITE_TOKEN at build)
   * - Free/unlicensed → NC_CHATWOOT_TOKEN_OSS (set via NUXT_CHATWOOT_WEBSITE_TOKEN_OSS at build)
   */
  function getChatwootToken(): string {
    if (appInfo.value.isCloud || appInfo.value.ee) return process.env.NC_CHATWOOT_TOKEN || ''
    return process.env.NC_CHATWOOT_TOKEN_OSS || ''
  }

  /**
   * Reinitialize the Chatwoot widget with the correct token.
   *
   * The @productdevbook/chatwoot module loads the SDK and calls run() with
   * an empty token (creating a non-functional hidden widget). Once appInfo
   * is available, we clean up the broken widget and reinit with the real token.
   *
   * The SDK script loads asynchronously — if it hasn't loaded yet when this
   * is called, we wait for the `chatwoot:ready` event (fired by the module
   * after its initial run()) before reinitializing.
   */
  function initChatwootWidget() {
    if (sdkLoaded.value) return

    const token = getChatwootToken()
    if (!token) return

    sdkLoaded.value = true

    function reinitWithToken() {
      // Remove the broken widget created by the module's empty-token run()
      document.querySelector('.woot-widget-holder')?.remove()
      document.querySelector('.woot--bubble-holder')?.remove()

      window.chatwootSettings = {
        hideMessageBubble: true,
        darkMode: 'light',
        position: 'right',
        locale: 'en',
      }

      window.chatwootSDK?.run({
        websiteToken: token,
        baseUrl: 'https://app.chatwoot.com',
      })
    }

    // SDK script loads asynchronously — it may not be available yet
    if (window.chatwootSDK) {
      reinitWithToken()
    } else {
      // Poll until the SDK script finishes loading
      const check = setInterval(() => {
        if (window.chatwootSDK) {
          clearInterval(check)
          reinitWithToken()
        }
      }, 200)
      // Give up after 30s
      setTimeout(() => clearInterval(check), 30000)
    }
  }

  const initUserCustomerAttributes = () => {
    if (!chatwootReady.value || ncIsPlaywright() || !user.value?.id || appInfo.value.disableSupportChat) {
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

    const attributes: Record<string, any> = {}
    if (appInfo.value.isCloud) {
      attributes.is_cloud = true as any
    }
    if (appInfo.value.isOnPrem) {
      attributes.is_onprem = true as any
    }

    if (!ncIsEmptyObject(attributes)) {
      setCustomAttributes(attributes)
    }

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
    if (ncIsIframe()) return
    chatwootReady.value = true
    initUserCustomerAttributes()
  }

  // Load the SDK once appInfo has been fetched from the backend.
  // On initial load isCloud/ee are false (defaults) — we must wait for real values.
  watch(
    appInfoStatus,
    (status) => {
      if (status === 'loaded' && !appInfo.value.disableSupportChat) {
        initChatwootWidget()
      }
    },
    { immediate: true },
  )

  watch(
    [() => user.value?.email, () => user.value?.id, () => appInfo.value.disableSupportChat],
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
    isChatWootEnabled,
  }
})
