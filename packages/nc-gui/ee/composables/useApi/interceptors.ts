import type { Api } from 'nocodb-sdk'
import { addAxiosInterceptors as addAxiosInterceptorsCE } from '../../../composables/useApi/interceptors'
import { useApiTiming } from '#imports'
const dataApiRegex = /\/api\/v1\/db\/data\/\w+\/\w+\/\w+\/views\/\w+/i
const reqLatencyKey = Symbol('reqLatencyKey')

export function addAxiosInterceptors(api: Api<any>) {
  const { setTiming } = useApiTiming()

  addAxiosInterceptorsCE(api)

  api.instance.interceptors.request.use((config) => {
    // add current time to calculate the latency for data api
    if (dataApiRegex.test(config.url || '')) {
      setTiming(null)
      config[reqLatencyKey] = Date.now()
    }
    return config
  })

  // Return a successful response back to the calling service
  api.instance.interceptors.response.use(
    (response) => {
      if (response.config[reqLatencyKey] && response.data?.stats) {
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
      return Promise.reject(error)
    },
  )
  return api
}
