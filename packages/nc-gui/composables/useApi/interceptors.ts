import type { Api } from 'nocodb-sdk'
import { navigateTo, useGlobal, useRouter } from '#imports'

const DbNotFoundMsg = 'Database config not found'

let refreshTokenPromise: Promise<string> | null = null

export function addAxiosInterceptors(api: Api<any>) {
  const state = useGlobal()
  const router = useRouter()
  const route = router.currentRoute
  const optimisedQuery = useState('optimisedQuery', () => true)

  api.instance.interceptors.request.use((config) => {
    config.headers['xc-gui'] = 'true'

    if (state.token.value) config.headers['xc-auth'] = state.token.value

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
  api.instance.interceptors.response.use(
    (response) => {
      return response
    },
    // Handle Error
    (error) => {
      if (error.response && error.response.data && error.response.data.msg === DbNotFoundMsg) return router.replace('/base/0')

      // Return any error which is not due to authentication back to the calling service
      if (!error.response || error.response.status !== 401) {
        return Promise.reject(error)
      }

      // Logout user if token refresh didn't work or user is disabled
      if (error.config.url === '/auth/token/refresh') {
        state.signOut()
        return Promise.reject(error)
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
              api.instance
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
        // if
        refreshTokenPromise = new Promise<string>((resolve, reject) => {
          refreshTokenPromiseRes = resolve
          refreshTokenPromiseRej = reject
        })
      }

      // Try request again with new token
      return api.instance
        .post('/auth/token/refresh', null, {
          withCredentials: true,
        })
        .then((token) => {
          // New request with new token
          const config = error.config
          config.headers['xc-auth'] = token.data.token
          state.signIn(token.data.token)

          // resolve the refresh token promise and reset
          refreshTokenPromiseRes(token.data.token)
          refreshTokenPromise = null

          return new Promise((resolve, reject) => {
            api.instance
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
          await state.signOut()

          if (!route.value.meta.public) navigateTo('/signIn')

          // reject the refresh token promise and reset
          refreshTokenPromiseRej(refreshTokenError)
          refreshTokenPromise = null

          return Promise.reject(error)
        })
    },
  )

  return api
}
