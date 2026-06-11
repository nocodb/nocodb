import type { Api } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import type { EventHook, MaybeRef } from '@vueuse/core'

export interface UseApiReturn<D = any, R = any> {
  api: Api<any>
  isLoading: Ref<boolean>
  error: Ref<AxiosError<D, R> | null>
  response: Ref<AxiosResponse<D, R> | null>
  onError: EventHook<AxiosError<D, R>>['on']
  onResponse: EventHook<AxiosResponse<D, R>>['on']
}

/** {@link Api} options */
export interface CreateApiOptions {
  baseURL?: string
}

export interface UseApiProps<D = any> {
  /** additional axios config for requests */
  axiosConfig?: MaybeRef<AxiosRequestConfig<D>>
  /** {@link Api} options */
  apiOptions?: CreateApiOptions
  useGlobalInstance?: boolean
}
