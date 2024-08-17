// this plugin is used to redirect user to the page they were trying to access before they were redirected to the login page
export default defineNuxtPlugin(function (nuxtApp) {
  const router = useRouter()

  const route = router.currentRoute

  watch(
    () => (nuxtApp.$state as ReturnType<typeof useGlobal>)?.token?.value,
    async (newToken, oldToken) => {
      try {
        if (newToken && newToken !== oldToken) {
          if (route.value.query?.continueAfterSignIn) {
            localStorage.removeItem('continueAfterSignIn')
            await navigateTo(route.value.query.continueAfterSignIn as string)
          } else {
            const continueAfterSignIn = localStorage.getItem('continueAfterSignIn')
            if (continueAfterSignIn) {
              localStorage.removeItem('continueAfterSignIn')
              await navigateTo({
                path: continueAfterSignIn,
                query: route.value.query,
              })
            }
          }
        }
      } catch (e) {
        console.error(e)
      }
    },
  )
})
