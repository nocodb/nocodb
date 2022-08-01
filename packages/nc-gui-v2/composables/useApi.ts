import type { AxiosError, AxiosResponse } from 'axios'
import type { Api } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { EventHook } from '@vueuse/core'
import { createEventHook, ref, useNuxtApp } from '#imports'

interface UseApiReturn<D = any, R = any> {
  api: Api<any>
  isLoading: Ref<boolean>
  error: Ref<AxiosError<D, R> | null>
  response: Ref<AxiosResponse<D, R> | null>
  onError: EventHook<AxiosError<D, R>>['on']
  onResponse: EventHook<AxiosResponse<D, R>>['on']
}

/** todo: add props? */
type UseApiProps = never

export function useApi<Data = any, RequestConfig = any>(_?: UseApiProps): UseApiReturn<Data, RequestConfig> {
  const isLoading = ref(false)

  const error = ref(null)

  const response = ref<any>(null)

  const errorHook = createEventHook<AxiosError<Data, RequestConfig>>()

  const responseHook = createEventHook<AxiosResponse<Data, RequestConfig>>()

  const { $api } = useNuxtApp()

  $api.instance.interceptors.request.use(
    (config) => {
      error.value = null
      response.value = null
      isLoading.value = true

      return config
    },
    (requestError) => {
      errorHook.trigger(requestError)
      error.value = requestError
      response.value = null
      isLoading.value = false
    },
  )

  $api.instance.interceptors.response.use(
    (apiResponse) => {
      responseHook.trigger(apiResponse as AxiosResponse<Data, RequestConfig>)
      // can't properly typecast
      response.value = apiResponse
      isLoading.value = false
    },
    (apiError) => {
      errorHook.trigger(apiError)
      error.value = apiError
      isLoading.value = false
    },
  )

  return { api: $api, isLoading, response, error, onError: errorHook.on, onResponse: responseHook.on }
}
