const isFullUrl = (url: string) => {
  return /^(https?:)?\/\//.test(url)
}

// `localStorage` is null in some embedded webviews / privacy modes — a direct
// access there crashes this top-level watch. Mirrors the auth middleware helpers.
const safeStorage = {
  get(key: string) {
    try {
      return localStorage?.getItem(key) ?? null
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage?.setItem(key, value)
    } catch {
      // storage unavailable — non-critical
    }
  },
  remove(key: string) {
    try {
      localStorage?.removeItem(key)
    } catch {
      // storage unavailable — non-critical
    }
  },
}

// this plugin is used to redirect user to the page they were trying to access before they were redirected to the login page
export default defineNuxtPlugin(function (nuxtApp) {
  const isTokenUpdatedTab = useState('isTokenUpdatedTab', () => false)
  const router = useRouter()

  const route = router.currentRoute

  // watch for continueAfterSignIn query param and store it in localStorage so that it can be used after sign in
  watch(
    () => route.value.query?.continueAfterSignIn,
    (continueAfterSignIn) => {
      if (continueAfterSignIn) {
        safeStorage.set('continueAfterSignIn', continueAfterSignIn as string)
      }
    },
    {
      immediate: true,
    },
  )

  // put inside app:created hook to ensure global state is available
  nuxtApp.hooks.hook('app:created', () => {
    const { token } = useGlobal()
    watch(
      () => token.value ?? (nuxtApp.$state as ReturnType<typeof useGlobal>)?.token?.value,
      async (newToken, oldToken) => {
        try {
          // if token updated redirect if one of the following condition matches,
          // 1. `continueAfterSignIn` query param is present in the url
          // 2. If signin happened in current tab which can be detected by `isTokenUpdatedTab` flag
          if (newToken && newToken !== oldToken && (isTokenUpdatedTab.value || route.value.query?.continueAfterSignIn)) {
            try {
              // prevent redirect to full url (outside domain)
              const getNavigateTo = (continueAfterSignIn: string) => {
                return isFullUrl(continueAfterSignIn) ? '/' : continueAfterSignIn
              }
              if (route.value.query?.continueAfterSignIn) {
                const target = getNavigateTo(route.value.query.continueAfterSignIn as string)
                await navigateTo(target, {
                  external: false,
                  replace: true,
                })
              } else {
                const continueAfterSignIn = safeStorage.get('continueAfterSignIn')
                if (continueAfterSignIn) {
                  await navigateTo(getNavigateTo(continueAfterSignIn), {
                    external: false,
                    replace: true,
                  })
                }
              }
            } finally {
              safeStorage.remove('continueAfterSignIn')
              isTokenUpdatedTab.value = false
            }
          }
        } catch (e) {
          console.error(e)
        }
      },
      { immediate: true },
    )
  })
})
