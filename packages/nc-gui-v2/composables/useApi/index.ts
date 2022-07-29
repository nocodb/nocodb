import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { Api } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { EventHook, MaybeRef } from '@vueuse/core'
import { addAxiosInterceptors } from './interceptors'
import { createEventHook, ref, unref, useGlobal } from '#imports'

interface UseApiReturn<D = any, R = any> {
  api: Api<any>
  isLoading: Ref<boolean>
  error: Ref<AxiosError<D, R> | null>
  response: Ref<AxiosResponse<D, R> | null>
  onError: EventHook<AxiosError<D, R>>['on']
  onResponse: EventHook<AxiosResponse<D, R>>['on']
}

/** {@link Api} options */
interface CreateApiOptions {
  baseURL?: string
}

export function createApiInstance<SecurityDataType = any>(options: CreateApiOptions = {}): Api<SecurityDataType> {
  return addAxiosInterceptors(
    new Api<SecurityDataType>({
      baseURL: options.baseURL ?? 'http://localhost:8080',
    }),
  )
}

interface UseApiProps<D = any> {
  /** additional axios config for requests */
  axiosConfig?: MaybeRef<AxiosRequestConfig<D>>
  /** {@link Api} options */
  apiOptions?: CreateApiOptions
}

/**
 * Api composable that provides loading, error and response refs, as well as event hooks for error and response.
 *
 * You can use this composable to generate a fresh api instance with its own loading and error refs.
 *
 * Any request called by useApi will be pushed into the global requests state and which toggles the global loading state.
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

  const isLoading = ref(false)

  const error = ref(null)

  const response = ref<any>(null)

  const errorHook = createEventHook<AxiosError<Data, RequestConfig>>()

  const responseHook = createEventHook<AxiosResponse<Data, RequestConfig>>()

  const api = createApiInstance(props.apiOptions)

  function addRequest() {
    state.runningRequests.value.push(state.runningRequests.value.length + 1)
  }

  function removeRequest() {
    state.runningRequests.value.pop()
  }

  api.instance.interceptors.request.use(
    (config) => {
      error.value = null
      response.value = null
      isLoading.value = true

      addRequest()

      return {
        ...config,
        ...unref(props),
      }
    },
    (requestError) => {
      errorHook.trigger(requestError)
      error.value = requestError
      response.value = null
      isLoading.value = false

      removeRequest()

      return requestError
    },
  )

  api.instance.interceptors.response.use(
    (apiResponse) => {
      responseHook.trigger(apiResponse as AxiosResponse<Data, RequestConfig>)
      // can't properly typecast
      response.value = apiResponse
      isLoading.value = false

      removeRequest()

      return apiResponse
    },
    (apiError) => {
      errorHook.trigger(apiError)
      error.value = apiError
      isLoading.value = false

      removeRequest()

      return apiError
    },
  )

  return { api, isLoading, response, error, onError: errorHook.on, onResponse: responseHook.on }
}
