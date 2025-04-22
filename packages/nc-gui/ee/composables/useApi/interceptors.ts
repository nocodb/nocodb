import type { Api } from 'nocodb-sdk'
import { addAxiosInterceptors as addAxiosInterceptorsCE } from '../../../composables/useApi/interceptors'

const dataApiRegex = /\/api\/v1\/data\/\w+\/\w+\/\w+\/views\/\w+/i
const reqLatencyKey = Symbol('reqLatencyKey')

export function addAxiosInterceptors(api: Api<any>) {
  const { setTiming } = useApiTiming()
  const { getBaseUrl, user } = useGlobal()
  const router = useRouter()

  const workspaceStore = useWorkspace()

  const { ssoLoginRequiredDlg } = storeToRefs(workspaceStore)

  addAxiosInterceptorsCE(api)

  api.instance.interceptors.request.use((config) => {
    if (!/(?:\/jobs\/listen|\/auth\/cognito)$/.test(config.url)) {
      let typeOrWorkspaceId = router.currentRoute.value.params.typeOrId

      const reg = config.url?.match(/\/meta\/duplicate\/(\w+)\/shared/)
      if (reg && reg[1]) {
        typeOrWorkspaceId = reg[1]
      }

      const baseUrl = typeOrWorkspaceId && getBaseUrl(typeOrWorkspaceId)
      if (baseUrl && !config.url?.endsWith('/auth/token/refresh')) {
        config.baseURL = baseUrl
      }
    }
    config.headers['nc-client-id'] = (window as any).ncClientId

    // add current time to calculate the latency for data api
    if (dataApiRegex.test(config.url || '')) {
      // reset timing if data api is invoking
      setTiming(null)
      config[reqLatencyKey] = Date.now()
    }
    return config
  })

  api.instance.interceptors.response.use(
    (response) => {
      // calculate the latency for data list api
      if (response && response.config[reqLatencyKey] && response.data?.stats) {
        const totalTime = Date.now() - response.config[reqLatencyKey]
        const db = Math.round(response.data.stats.dbQueryTime)
        const cpu = Math.round(response.data.stats.apiHandlingTime - db)
        const network = Math.round(totalTime - response.data.stats.apiHandlingTime)
        setTiming({
          db,
          cpu,
          network,
        })
      }
      return response
    },
    // Handle Error
    (error) => {
      // if 403 and NcErrorType.SSO_LOGIN_REQUIRED error, redirect to sso login page and prefill the email
      if (error.response?.status === 403 && error.response?.data?.error === NcErrorType.SSO_LOGIN_REQUIRED) {
        const email = user.value?.email

        ssoLoginRequiredDlg.value = true

        navigateTo(
          {
            path: '/sso',
            query: {
              email,
            },
          },
          {
            replace: true,
          },
        )

        return Promise.reject(new Error('SSO login required'))
      }

      return Promise.reject(error)
    },
  )
  return api
}
