import type { Api } from 'nocodb-sdk'
import { isAxiosError } from 'axios'

const DbNotFoundMsg = 'Database config not found'

const TIMEOUT_RETRY_COUNT = 1

export function addAxiosInterceptors(api: Api<any>, skipSocket = false) {
  const state = useGlobal()
  const router = useRouter()
  const route = router.currentRoute
  const optimisedQuery = useState('optimisedQuery', () => true)
  const { $ncSocket } = useNuxtApp()

  const axiosInstance = api.instance

  axiosInstance.interceptors.request.use((config) => {
    config.headers['xc-gui'] = 'true'
    config.headers['xc-socket-id'] = skipSocket ? null : $ncSocket.id() || null

    const tabId = getTabId()
    if (tabId) config.headers['x-nc-tab-id'] = tabId

    if (state.token.value && !config.headers['xc-short-token']) {
      config.headers['xc-auth'] = state.token.value
    }

    if (!config.url?.endsWith('/user/me') && !config.url?.endsWith('/admin/roles')) {
      if (route.value && route.value.params && route.value.params.typeOrId === 'base') {
        config.headers['xc-shared-base-id'] = route.value.params.baseId
        delete config.headers['xc-auth']
      } else if (route.value && route.value.params && route.value.params.typeOrId === 'ERD') {
        config.headers['xc-shared-erd-id'] = route.value.params.erdUuid
        delete config.headers['xc-auth']
      }
    }

    if (!optimisedQuery.value) {
      config.params = { ...(config.params ?? {}), opt: 'false' }
    }

    return config
  })

  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const isSharedPage =
        route.value?.params?.typeOrId === 'base' || route.value?.params?.typeOrId === 'ERD' || route.value.meta.public

      if (error.code === 'ERR_CANCELED') return Promise.reject(error)

      if (error.response?.data?.msg === DbNotFoundMsg) {
        return router.replace('/base/0')
      }

      if (error.response?.status === 402) {
        // NcBaseErrorv2 serialises as { error, message, details } — `msg` is
        // the older shape. Reading only `msg` meant every 402 fell through to
        // the fallback, so a license that is merely inactive was reported as
        // an Enterprise entitlement problem. 402 also covers exhausted
        // credits, which is not a tier issue either.
        message.warning(error.response?.data?.message || error.response?.data?.msg || 'This action is currently unavailable.')
        return Promise.reject(error)
      }

      if (!error.response || error.response.status !== 401) {
        return Promise.reject(error)
      }

      if (error.config.url === '/auth/token/refresh') {
        await state.signOut({
          redirectToSignin: !route.value.meta.public,
          skipApiCall: true,
        })
        return Promise.reject(error)
      }

      let retry = 0
      do {
        try {
          const token = await state.refreshToken({
            axiosInstance,
            // NB: the parameter is `skipSignOut`. This used to pass
            // `skipLogout`, which matches nothing in the signature and was
            // silently ignored, so refreshToken signed out on its own before
            // this caller could decide.
            skipSignOut: true,
          })

          if (!token) {
            await state.signOut({
              redirectToSignin: !isSharedPage,
              skipApiCall: true,
            })
            return Promise.reject(error)
          }

          const config = error.config
          config.headers['xc-auth'] = token

          const response = await axiosInstance.request(config)
          return response
        } catch (refreshTokenError) {
          if ((refreshTokenError as any)?.code === 'ERR_CANCELED') {
            return Promise.reject(refreshTokenError)
          }

          // A refresh that never got a RESPONSE says nothing about whether the
          // session is still valid — signing out on it discards a good session
          // over a momentary blip, dropping the user on the sign-in screen
          // mid-session. refreshToken now rethrows those instead of returning
          // falsy, so they land here; fall through to the retry below.
          const refreshServerRejected = isAxiosError(refreshTokenError) && !!refreshTokenError.response

          // if shared execution error, don't sign out
          if (!(refreshTokenError instanceof SharedExecutionError) && refreshServerRejected) {
            await state.signOut({
              redirectToSignin: !isSharedPage,
              skipApiCall: true,
            })
            return Promise.reject(error)
          }

          if (retry >= TIMEOUT_RETRY_COUNT) return Promise.reject(error)
        }
      } while (retry++ < TIMEOUT_RETRY_COUNT)
    },
  )

  return api
}
