import { Api } from 'nocodb-sdk'

export function getApi($store, $axios) {
  const api = new Api({
    baseURL: 'http://localhost:8080',
    headers: {
      'xc-auth': $store.state.users.token
    }
  })

  // overwrite with nuxt axios instance
  api.instance = $axios
  return api
}

export default function({ store: $store, $axios, ...rest }, inject) {
  const api = getApi($store, $axios)

  inject('api', api)
}
