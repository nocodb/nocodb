import type { Api } from 'nocodb-sdk'
import type { InternalApi } from 'nocodb-sdk-v2'
import { addAxiosInterceptors as addAxiosInterceptorsCE } from '../../../composables/useApi/interceptors'

const dataApiRegex = /\/api\/v1\/data\/\w+\/\w+\/\w+\/views\/\w+/i
const reqLatencyKey = Symbol('reqLatencyKey')

export function addAxiosInterceptors(api: Api<any> | InternalApi<any>, skipSocket = false) {
  const { setTiming } = useApiTiming()
  const { getBaseUrl } = useGlobal()
  const router = useRouter()

  addAxiosInterceptorsCE(api, skipSocket)

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
    async (error) => {
      // if 403 and NcErrorType.ERR_SSO_LOGIN_REQUIRED error, redirect to sso login page and prefill the email
      if (error.response?.status === 403 && error.response?.data?.error === NcErrorType.ERR_SSO_LOGIN_REQUIRED) {
        const workspaceStore = useWorkspace()
        const orgStore = useOrg()

        // Check if we're in an org context
        const isOrgContext = !!orgStore.orgId || !!workspaceStore.activeWorkspace?.fk_org_id

        if (isOrgContext) {
          orgStore.toggleSsoLoginRequiredDlg(true)
          await until(() => !orgStore.ssoLoginRequiredDlg).toBeTruthy()
        } else {
          workspaceStore.toggleSsoLoginRequiredDlg(true)
          await until(() => !workspaceStore.ssoLoginRequiredDlg).toBeTruthy()
        }
      }

      return Promise.reject(error)
    },
  )
  return api
}
