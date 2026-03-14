export const useProvideChatwoot = createSharedComposable(() => {
  const { setUser, setConversationCustomAttributes, setCustomAttributes } = useChatWoot()
  const { user, appInfo } = useGlobal()
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
   * Load the Chatwoot SDK script and call run() with the correct token.
   * The @productdevbook/chatwoot module is kept for useChatWoot() composable
   * but configured with empty baseUrl so it doesn't auto-load the SDK.
   */
  function loadChatwootSdk() {
    if (sdkLoaded.value) return

    const token = getChatwootToken()
    if (!token) return

    sdkLoaded.value = true

    const script = document.createElement('script')
    script.src = 'https://app.chatwoot.com/packs/js/sdk.js'
    script.async = true
    script.defer = true
    script.onload = () => {
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
    document.head.appendChild(script)
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

  // Load the SDK once appInfo is available (determines which token to use)
  watch(
    () => appInfo.value,
    () => {
      if (appInfo.value && !appInfo.value.disableSupportChat) {
        loadChatwootSdk()
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
