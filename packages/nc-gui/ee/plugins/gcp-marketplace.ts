/**
 * GCP Marketplace account linking plugin.
 *
 * Handles two concerns:
 * 1. Persists `gcp_link_token` from the URL into localStorage before the auth
 *    middleware can redirect (e.g. when the user is already signed in).
 * 2. After sign-in (via any auth method), links the GCP procurement account
 *    to the authenticated NocoDB user using the token, then cleans up.
 */
export default defineNuxtPlugin(function (nuxtApp) {
  const router = useRouter()
  const route = router.currentRoute

  // Capture gcp_link_token from URL immediately — before auth middleware can
  // redirect away from the signin page (which would prevent the Signin
  // component from mounting and storing it).
  watch(
    () => route.value.query?.gcp_link_token,
    (linkToken) => {
      if (linkToken) {
        localStorage.setItem('gcp_link_token', linkToken as string)
      }
    },
    { immediate: true },
  )

  // After login, link the GCP account to the authenticated user.
  nuxtApp.hooks.hook('app:created', () => {
    const { token } = useGlobal()
    const { api } = useApi({ useGlobalInstance: true })

    watch(
      () => token.value,
      async (newToken) => {
        if (!newToken) return

        const linkToken = localStorage.getItem('gcp_link_token')
        if (!linkToken) return

        try {
          await api.instance.post('/api/v1/gcp-marketplace/link-account', {
            link_token: linkToken,
          })

          // GCP signup opens a popup — close it after linking.
          // "Manage on provider" is a full redirect — navigate to license page.
          if (window.opener) {
            window.close()
          }

          // Falls through if window.close() was blocked by the browser
          await navigateTo('/account/self-hosted', { replace: true })
        } catch {
          message.error('Failed to link GCP Marketplace account')
        } finally {
          localStorage.removeItem('gcp_link_token')
        }
      },
      { immediate: true },
    )
  })
})
