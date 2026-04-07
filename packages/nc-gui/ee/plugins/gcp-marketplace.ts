/**
 * GCP Marketplace account linking plugin.
 *
 * Handles two concerns:
 * 1. Persists `gcp_account` from the URL into localStorage before the auth
 *    middleware can redirect (e.g. when the user is already signed in).
 * 2. After sign-in (via any auth method), links the GCP procurement account
 *    to the authenticated NocoDB user, then cleans up.
 */
export default defineNuxtPlugin(function (nuxtApp) {
  const router = useRouter()
  const route = router.currentRoute

  // Capture gcp_account from URL immediately — before auth middleware can
  // redirect away from the signin page (which would prevent the Signin
  // component from mounting and storing it).
  watch(
    () => route.value.query?.gcp_account,
    (gcpAccount) => {
      if (gcpAccount) {
        localStorage.setItem('gcp_marketplace_account', gcpAccount as string)
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

        const gcpAccount = localStorage.getItem('gcp_marketplace_account')
        if (!gcpAccount) return

        try {
          await api.instance.post('/api/v1/gcp-marketplace/link-account', {
            procurement_account_id: gcpAccount,
          })
        } catch (e: any) {
          console.error('GCP Marketplace account linking failed:', e?.message)
        } finally {
          localStorage.removeItem('gcp_marketplace_account')
        }
      },
      { immediate: true },
    )
  })
})
