import type { Api } from 'nocodb-sdk'
import { useNuxtApp } from '#app'

export const useUser = () => {
  const { $api, $state } = useNuxtApp()

  const getUser = async (...args: Parameters<Api<any>['auth']['me']>) => {
    $state.user = await $api.auth.me(...args)
  }

  const setToken = (token?: string) => {
    $state.token = token
  }

  return { user: $state.user, setToken, getUser }
}
