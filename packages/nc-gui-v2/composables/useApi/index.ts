import type { AxiosError, AxiosResponse } from 'axios'
import { Api } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { addAxiosInterceptors } from './interceptors'
import type { CreateApiOptions, UseApiProps, UseApiReturn } from './types'
import { createEventHook, ref, unref, useCounter, useGlobal } from '#imports'

export function createApiInstance<SecurityDataType = any>(options: CreateApiOptions = {}): Api<SecurityDataType> {
  return addAxiosInterceptors(
    new Api<SecurityDataType>({
      baseURL: options.baseURL ?? 'http://localhost:8080',
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
export function useApi<Data = any, RequestConfig = any>(props: UseApiProps<Data> = {}): UseApiReturn<Data, RequestConfig> {
  const state = useGlobal()

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

  /** fresh api instance - with interceptors for token refresh already bound */
  const api = createApiInstance(props.apiOptions)

  /** set loading to true and increment local and global request counter */
  function onRequestStart() {
    isLoading.value = true

    /** local count */
    inc()

    /** global count */
    state.runningRequests.inc()
  }

  /** decrement local and global request counter and check if we can stop loading */
  function onRequestFinish() {
    /** local count */
    dec()
    /** global count */
    state.runningRequests.dec()

    /** try to stop loading */
    stopLoading()
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

      onRequestStart()

      return {
        ...config,
        ...unref(props),
      }
    },
    (requestError) => {
      errorHook.trigger(requestError)
      error.value = requestError

      response.value = null

      onRequestFinish()

      return requestError
    },
  )

  api.instance.interceptors.response.use(
    (apiResponse) => {
      responseHook.trigger(apiResponse as AxiosResponse<Data, RequestConfig>)
      response.value = apiResponse

      onRequestFinish()

      return apiResponse
    },
    (apiError) => {
      errorHook.trigger(apiError)
      error.value = apiError

      onRequestFinish()

      return apiError
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
