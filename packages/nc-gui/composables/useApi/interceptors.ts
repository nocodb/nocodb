import type { Api } from 'nocodb-sdk'
const DbNotFoundMsg = 'Database config not found'

const TIMEOUT_RETRY_COUNT = 1

export function addAxiosInterceptors(api: Api<any>) {
  const state = useGlobal()
  const router = useRouter()
  const route = router.currentRoute
  const optimisedQuery = useState('optimisedQuery', () => true)

  const axiosInstance = api.instance

  axiosInstance.interceptors.request.use((config) => {
    config.headers['xc-gui'] = 'true'

    if (state.token.value && !config.headers['xc-short-token']) {
      config.headers['xc-auth'] = state.token.value
    }

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

  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const isSharedPage =
        route.value?.params?.typeOrId === 'base' || route.value?.params?.typeOrId === 'ERD' || route.value.meta.public

      if (error.code === 'ERR_CANCELED') return Promise.reject(error)

      if (error.response?.data?.msg === DbNotFoundMsg) {
        return router.replace('/base/0')
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
            skipLogout: true,
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

          // if shared execution error, don't sign out
          if (!(refreshTokenError instanceof SharedExecutionError)) {
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
