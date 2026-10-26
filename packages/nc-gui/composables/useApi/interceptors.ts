import type { Api } from 'nocodb-sdk'
import { type AxiosRequestConfig, type InternalAxiosRequestConfig, isAxiosError } from 'axios'

const DbNotFoundMsg = 'Database config not found'

// After a refresh with no response: wait this long (doubling, capped) before the next one
const REFRESH_PAUSE_MS = 10_000
const REFRESH_PAUSE_MAX_MS = 5 * 60_000

// More refreshed tokens than this rejected inside the window: they die as fast as they are minted
const REFRESH_LOOP_MAX = 3
const REFRESH_LOOP_WINDOW_MS = 60_000

// Per tab, shared by every axios instance
let refreshInFlight: Promise<string | null | void> | null = null
let signOutInFlight: Promise<void> | null = null
let deadToken: string | null = null
let refreshPausedUntil = 0
let refreshFailures = 0
let deadRefreshedAt: number[] = []
let sessionCheck: { token: string; at: number; dead: Promise<boolean> } | null = null
let refreshSeq = 0
let deadCountedSeq = 0

/**
 * /signin that returns to the page being loaded. Reads the address bar, not the
 * router: mid-navigation the router still reports the previous route, and this
 * redirect cancels the auth middleware's own one.
 */
function signinUrlForCurrentPage() {
  const { pathname, search } = window.location
  const path = `${pathname}${search}`
  if (path === '/' || /^\/(signin|signup|sso)(\/|$)/.test(pathname)) return '/signin'
  return `/signin?continueAfterSignIn=${encodeURIComponent(path)}`
}

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

      // Callers of refreshToken handle a failed refresh; signing out here too made it twice.
      if (error.config.url === '/auth/token/refresh') {
        return Promise.reject(error)
      }

      const config = error.config as InternalAxiosRequestConfig & {
        _ncAuthRetried?: boolean
        _ncRefreshSeq?: number
        _ncSessionCheck?: boolean
      }

      if (config._ncSessionCheck) return Promise.reject(error)

      const signOutOnce = () => {
        deadToken = state.token.value || ''
        signOutInFlight ??= state
          .signOut({
            redirectToSignin: !isSharedPage,
            signinUrl: signinUrlForCurrentPage(),
            skipApiCall: true,
          })
          .finally(() => (signOutInFlight = null))
        return signOutInFlight
      }

      const sentToken = config.headers?.['xc-auth']

      const isSessionDead = (t: string) => {
        if (!sessionCheck || sessionCheck.token !== t) {
          const check: AxiosRequestConfig & { _ncSessionCheck: boolean } = { _ncSessionCheck: true }
          sessionCheck = {
            token: t,
            at: Date.now(),
            dead: axiosInstance.get('/api/v1/auth/user/me', check).then(
              () => false,
              (e) => isAxiosError(e) && e.response?.status === 401,
            ),
          }
        }
        return sessionCheck.dead
      }

      // One refresh per request; a 401 can also be an authz failure, which no refresh fixes.
      if (config._ncAuthRetried) {
        // Only a token the server rejects outright counts toward the breaker: /auth/user/me is 200 for any valid session.
        if (
          ncIsString(sentToken) &&
          sentToken &&
          sentToken === state.token.value &&
          (await isSessionDead(sentToken)) &&
          config._ncRefreshSeq !== deadCountedSeq
        ) {
          deadCountedSeq = config._ncRefreshSeq ?? 0
          deadRefreshedAt.push(Date.now())
        }
        return Promise.reject(error)
      }

      // Sent with a token another refresh has already replaced: retry with the new one.
      if (state.token.value && sentToken && sentToken !== state.token.value) {
        config._ncAuthRetried = true
        config._ncRefreshSeq = refreshSeq
        return axiosInstance.request(config)
      }

      if (deadToken !== null) {
        // Session already given up on: wait for a new sign-in instead of refreshing again.
        if (!state.token.value || state.token.value === deadToken) return Promise.reject(error)

        // Signed in again since: start over.
        deadToken = null
        deadRefreshedAt = []
        refreshFailures = 0
        refreshPausedUntil = 0
      }

      if (Date.now() < refreshPausedUntil) return Promise.reject(error)

      // Session confirmed valid moments ago: an authorization failure, which no refresh fixes.
      const lastCheck = sessionCheck
      if (
        lastCheck &&
        lastCheck.token === sentToken &&
        Date.now() - lastCheck.at < REFRESH_LOOP_WINDOW_MS &&
        !(await lastCheck.dead)
      ) {
        return Promise.reject(error)
      }

      const now = Date.now()
      deadRefreshedAt = deadRefreshedAt.filter((t) => now - t < REFRESH_LOOP_WINDOW_MS)
      // Tokens die as fast as they are minted (e.g. another client keeps signing in): stop.
      if (deadRefreshedAt.length >= REFRESH_LOOP_MAX) {
        await signOutOnce()
        return Promise.reject(error)
      }

      let token: string | null | void
      try {
        if (!refreshInFlight) refreshSeq++
        refreshInFlight ??= state
          .refreshToken({
            axiosInstance,
            // NB: the parameter is `skipSignOut`. This used to pass
            // `skipLogout`, which matches nothing in the signature and was
            // silently ignored, so refreshToken signed out on its own before
            // this caller could decide.
            skipSignOut: true,
          })
          .then((newToken) => {
            if (newToken) refreshFailures = 0
            return newToken
          })
          .finally(() => (refreshInFlight = null))

        token = await refreshInFlight
      } catch (refreshTokenError) {
        if ((refreshTokenError as any)?.code === 'ERR_CANCELED') {
          return Promise.reject(refreshTokenError)
        }

        // No response says nothing about the session: back off. Other tabs get the error as JSON, hence `status`.
        const refreshServerRejected = isAxiosError(refreshTokenError)
          ? !!refreshTokenError.response
          : typeof (refreshTokenError as { status?: unknown } | null)?.status === 'number'

        if (!(refreshTokenError instanceof SharedExecutionError) && refreshServerRejected) {
          await signOutOnce()
          return Promise.reject(error)
        }

        refreshPausedUntil = Date.now() + Math.min(REFRESH_PAUSE_MS * 2 ** refreshFailures++, REFRESH_PAUSE_MAX_MS)
        return Promise.reject(error)
      }

      if (!token) {
        await signOutOnce()
        return Promise.reject(error)
      }

      config._ncAuthRetried = true
      config._ncRefreshSeq = refreshSeq
      config.headers['xc-auth'] = token

      return axiosInstance.request(config)
    },
  )

  return api
}
