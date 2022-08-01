import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { Api } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { EventHook, MaybeRef } from '@vueuse/core'
import { addAxiosInterceptors } from './interceptors'
import { createEventHook, ref, unref, useNuxtApp } from '#imports'
import type { NuxtApp } from '#app'

interface UseApiReturn<D = any, R = any> {
  api: Api<any>
  isLoading: Ref<boolean>
  error: Ref<AxiosError<D, R> | null>
  response: Ref<AxiosResponse<D, R> | null>
  onError: EventHook<AxiosError<D, R>>['on']
  onResponse: EventHook<AxiosResponse<D, R>>['on']
}

export function createApiInstance(app: NuxtApp, baseURL = 'http://localhost:8080') {
  const api = new Api({
    baseURL,
  })

  addAxiosInterceptors(api, app)

  return api
}

/** todo: add props? */
interface UseApiProps<D = any> {
  axiosConfig?: MaybeRef<AxiosRequestConfig<D>>
  useGlobalInstance?: MaybeRef<boolean>
}

export function useApi<Data = any, RequestConfig = any>(props: UseApiProps<Data> = {}): UseApiReturn<Data, RequestConfig> {
  const isLoading = ref(false)

  const error = ref(null)

  const response = ref<any>(null)

  const errorHook = createEventHook<AxiosError<Data, RequestConfig>>()

  const responseHook = createEventHook<AxiosResponse<Data, RequestConfig>>()

  const api = unref(props.useGlobalInstance) ? useNuxtApp().$api : createApiInstance(useNuxtApp())

  api.instance.interceptors.request.use(
    (config) => {
      error.value = null
      response.value = null
      isLoading.value = true

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

      return requestError
    },
  )

  api.instance.interceptors.response.use(
    (apiResponse) => {
      responseHook.trigger(apiResponse as AxiosResponse<Data, RequestConfig>)
      // can't properly typecast
      response.value = apiResponse
      isLoading.value = false

      return apiResponse
    },
    (apiError) => {
      errorHook.trigger(apiError)
      error.value = apiError
      isLoading.value = false

      return apiError
    },
  )

  return { api, isLoading, response, error, onError: errorHook.on, onResponse: responseHook.on }
}
