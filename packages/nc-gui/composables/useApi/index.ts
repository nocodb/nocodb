import type { AxiosError, AxiosResponse } from 'axios'
import { Api, type Api as BaseAPI } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { CreateApiOptions, UseApiProps, UseApiReturn } from './types'
import { addAxiosInterceptors } from './interceptors'

export function createApiInstance<SecurityDataType = any>({
  baseURL: _baseUrl = BASE_FALLBACK_URL,
}: CreateApiOptions = {}): Api<SecurityDataType> {
  const config = useRuntimeConfig()
  const baseURL = config.public.ncBackendUrl || _baseUrl
  return addAxiosInterceptors(
    new Api<SecurityDataType>({
      baseURL,
    }),
  )
}

/**
 * Api composable that provides loading, error and response refs, as well as event hooks for error and response.
 *
 * You can use this composable to generate a fresh api instance with its own loading and error refs.
 *
 * Any request called by useApi will be pushed into the global requests counter which toggles the global loading state.
 *
 * @example
 * ```js
 * const { api, isLoading, error, response, onError, onResponse } = useApi()
 *
 * const onSignIn = async () => {
 *   const { token } = await api.auth.signIn(form)
 * }
 */
export function useApi<Data = any, RequestConfig = any>({
  useGlobalInstance = false,
  apiOptions,
  axiosConfig,
}: UseApiProps<Data> = {}): UseApiReturn<Data, RequestConfig> {
  /**
   * Local state of running requests, do not confuse with global state of running requests
   * This state is only counting requests made by this instance of `useApi` and not by other instances.
   */
  const { count, inc, dec } = useCounter(0)

  /** is request loading */
  const isLoading = ref(false)

  /** latest request error */
  const error = ref(null)

  /** latest request response */
  const response = ref<unknown | null>(null)

  const errorHook = createEventHook<AxiosError<Data, RequestConfig>>()

  const responseHook = createEventHook<AxiosResponse<Data, RequestConfig>>()

  const nuxtApp = useNuxtApp()

  /** api instance - with interceptors for token refresh already bound */
  const api: BaseAPI<any> = useGlobalInstance && !!nuxtApp.$api ? nuxtApp.$api : createApiInstance(apiOptions)

  // List of endpoints that should be excluded from the loading spinner
  const excludedEndpoints = [
    '/api/v1/notifications/poll',
    // Add other long-polling or streaming endpoints here
  ]

  // Track requests that have been started but not yet completed
  const pendingRequests = new Map()

  /** set loading to true and increment local and global request counter */
  // Long Polling causes the loading spinner to never stop
  // hence we are excluding the polling request from the loading spinner
  function onRequestStart(config) {
    // Check if the request URL is in the excluded list
    const isExcluded = excludedEndpoints.some(endpoint => config.url?.includes(endpoint))
    
    if (!isExcluded) {
      isLoading.value = true

      /** local count */
      inc()

      /** global count */
      nuxtApp.$state.runningRequests.inc()
      
      // Store the request in our pending requests map with a timestamp
      const requestId = Date.now() + Math.random().toString(36).substring(2, 9)
      pendingRequests.set(requestId, {
        url: config.url,
        startTime: Date.now()
      })
      
      // Attach the requestId to the config so we can retrieve it in the response
      config.requestId = requestId
    }
    
    return config
  }

  /** decrement local and global request counter and check if we can stop loading */
  function onRequestFinish(config) {
    if (config && config.requestId) {
      // Remove the request from our pending requests map
      pendingRequests.delete(config.requestId)
    }
    
    /** local count */
    dec()
    /** global count */
    nuxtApp.$state.runningRequests.dec()

    /** try to stop loading */
    stopLoading()
    
    // Safety check: if there are any requests that have been running for more than 30 seconds,
    // we'll consider them stalled and remove them from the counter
    const now = Date.now()
    const stalledRequests = []
    
    pendingRequests.forEach((request, id) => {
      if (now - request.startTime > 30000) { // 30 seconds timeout
        stalledRequests.push(id)
      }
    })
    
    // Clean up stalled requests
    stalledRequests.forEach(id => {
      pendingRequests.delete(id)
      dec()
      nuxtApp.$state.runningRequests.dec()
    })
    
    // If we cleaned up any stalled requests, check loading state again
    if (stalledRequests.length > 0) {
      stopLoading()
    }
  }

  /** set loading state to false *only* if no request is still running */
  function stopLoading() {
    if (count.value === 0) {
      isLoading.value = false
    }
  }

  /** reset response and error refs */
  function reset() {
    error.value = null
    response.value = null
  }

  api.instance.interceptors.request.use(
    (config) => {
      reset()

      return onRequestStart(config)
    },
    async (requestError) => {
      errorHook.trigger(requestError)
      error.value = await extractSdkResponseErrorMsg(requestError)

      response.value = null

      onRequestFinish()

      return Promise.reject(requestError)
    },
  )

  api.instance.interceptors.response.use(
    (apiResponse) => {
      responseHook.trigger(apiResponse as AxiosResponse<Data, RequestConfig>)
      response.value = apiResponse

      onRequestFinish(apiResponse.config)

      return Promise.resolve(apiResponse)
    },
    async (apiError) => {
      errorHook.trigger(apiError)
      error.value = await extractSdkResponseErrorMsg(apiError)

      onRequestFinish(apiError.config)

      return Promise.reject(apiError)
    },
  )

  return {
    api,
    isLoading,
    response: response as Ref<AxiosResponse<Data, RequestConfig>>,
    error,
    onError: errorHook.on,
    onResponse: responseHook.on,
  }
}
