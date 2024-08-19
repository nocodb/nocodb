// this plugin is used to redirect user to the page they were trying to access before they were redirected to the login page
export default defineNuxtPlugin(function (nuxtApp) {
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
          if (newToken && newToken !== oldToken) {
            try {
              if (route.value.query?.continueAfterSignIn) {
                await navigateTo(route.value.query.continueAfterSignIn as string)
              } else {
                const continueAfterSignIn = localStorage.getItem('continueAfterSignIn')
                if (continueAfterSignIn) {
                  await navigateTo(continueAfterSignIn)
                }
              }
            } finally {
              localStorage.removeItem('continueAfterSignIn')
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
