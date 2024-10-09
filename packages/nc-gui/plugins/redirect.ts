const isFullUrl = (url: string) => {
  return /^(https?:)?\/\//.test(url)
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
        localStorage.setItem('continueAfterSignIn', continueAfterSignIn as string)
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
              if (route.value.query?.continueAfterSignIn) {
                await navigateTo(route.value.query.continueAfterSignIn as string, {
                  external: isFullUrl(route.value.query.continueAfterSignIn as string),
                })
              } else {
                const continueAfterSignIn = localStorage.getItem('continueAfterSignIn')
                if (continueAfterSignIn) {
                  await navigateTo(continueAfterSignIn, {
                    external: isFullUrl(continueAfterSignIn),
                  })
                }
              }
            } finally {
              localStorage.removeItem('continueAfterSignIn')
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
