// this plugin is used to redirect user to the page they were trying to access before they were redirected to the login page
export default defineNuxtPlugin(function (nuxtApp) {
  const router = useRouter()

  const route = router.currentRoute

  watch(
    () => (nuxtApp.$state as ReturnType<typeof useGlobal>)?.token?.value,
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
  )
})
