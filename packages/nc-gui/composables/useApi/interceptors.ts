import type { Api } from 'nocodb-sdk'
import { useStorage } from '@vueuse/core'

const DbNotFoundMsg = 'Database config not found'

let refreshTokenPromise: Promise<string> | null = null

export function addAxiosInterceptors(api: Api<any>) {
  const isTokenRefreshInProgress = useStorage(TOKEN_REFRESH_PROGRESS_KEY, false)

  const state = useGlobal()
  const router = useRouter()
  const route = router.currentRoute
  const optimisedQuery = useState('optimisedQuery', () => true)

  const axiosInstance = api.instance

  axiosInstance.interceptors.request.use((config) => {
    config.headers['xc-gui'] = 'true'

    // Add auth header only if signed in and if `xc-short-token` header is not present (for short-lived tokens used for token generation)
    if (state.token.value && !config.headers['xc-short-token']) config.headers['xc-auth'] = state.token.value

    if (!config.url?.endsWith('/user/me') && !config.url?.endsWith('/admin/roles') && state.previewAs?.value) {
      config.headers['xc-preview'] = state.previewAs.value
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

  // Return a successful response back to the calling service
  axiosInstance.interceptors.response.use(
    (response) => {
      return response
    },
    // Handle Error
    async (error) => {
      // if cancel request then throw error
      if (error.code === 'ERR_CANCELED') return Promise.reject(error)

      if (error.response && error.response.data && error.response.data.msg === DbNotFoundMsg) return router.replace('/base/0')

      // Return any error which is not due to authentication back to the calling service
      if (!error.response || error.response.status !== 401) {
        return Promise.reject(error)
      }

      // Logout user if token refresh didn't work or user is disabled
      if (error.config.url === '/auth/token/refresh') {
        await state.signOut({
          redirectToSignin: !route.value.meta.public,
          skipApiCall: true,
        })
        return Promise.reject(error)
      }

      // if no active refresh token request in the current session then check the local storage
      if (!refreshTokenPromise && isTokenRefreshInProgress.value) {
        // if token refresh is already in progress, wait for it to finish and then retry the request if token is available
        await until(isTokenRefreshInProgress).toMatch((v) => !v, { timeout: 5000 })
        isTokenRefreshInProgress.value = false

        // check if the user is signed in by checking the token presence and retry the request with the new token
        if (state.token.value) {
          return new Promise((resolve, reject) => {
            const config = error.config
            config.headers['xc-auth'] = state.token.value
            axiosInstance
              .request(config)
              .then((response) => {
                resolve(response)
              })
              .catch((error) => {
                reject(error)
              })
          })
        }
      }

      let refreshTokenPromiseRes: (token: string) => void
      let refreshTokenPromiseRej: (e: Error) => void

      // avoid multiple refresh token requests by multiple requests at the same time
      // wait for the first request to finish and then retry the failed requests
      if (refreshTokenPromise) {
        // if previous refresh token request succeeds use the token and retry request
        return refreshTokenPromise
          .then((token) => {
            // New request with new token
            return new Promise((resolve, reject) => {
              const config = error.config
              config.headers['xc-auth'] = token
              axiosInstance
                .request(config)
                .then((response) => {
                  resolve(response)
                })
                .catch((error) => {
                  reject(error)
                })
            })
          })
          .catch(() => {
            // ignore since it could have already been handled and redirected to sign in
          })
      } else {
        isTokenRefreshInProgress.value = true
        refreshTokenPromise = new Promise<string>((resolve, reject) => {
          refreshTokenPromiseRes = resolve
          refreshTokenPromiseRej = reject
        })

        // set a catch on the promise to avoid unhandled promise rejection
        refreshTokenPromise
          .catch(() => {
            // ignore
          })
          .finally(() => {
            isTokenRefreshInProgress.value = false
          })
      }

      // Try request again with new token
      return axiosInstance
        .post('/auth/token/refresh', null, {
          withCredentials: true,
          cancelToken: undefined,
        })
        .then((token) => {
          // New request with new token
          const config = error.config
          config.headers['xc-auth'] = token.data.token
          state.signIn(token.data.token, true)

          // resolve the refresh token promise and reset
          refreshTokenPromiseRes(token.data.token)
          refreshTokenPromise = null

          return new Promise((resolve, reject) => {
            axiosInstance
              .request(config)
              .then((response) => {
                resolve(response)
              })
              .catch((error) => {
                reject(error)
              })
          })
        })
        .catch(async (refreshTokenError) => {
          // skip signout call if request cancelled
          if (refreshTokenError.code === 'ERR_CANCELED') {
            // reject the refresh token promise and reset
            refreshTokenPromiseRej(refreshTokenError)
            refreshTokenPromise = null
            return Promise.reject(refreshTokenError)
          }

          await state.signOut({
            redirectToSignin: !route.value.meta.public,
            skipApiCall: true,
          })

          // reject the refresh token promise and reset
          refreshTokenPromiseRej(refreshTokenError)
          refreshTokenPromise = null

          return Promise.reject(error)
        })
    },
  )

  return api
}
