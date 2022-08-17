import { Api } from 'nocodb-sdk';
import {defineNuxtPlugin} from "nuxt3/app";


export default defineNuxtPlugin((nuxtApp) => {

  // Doing something with nuxtApp

  const api = getApi(null, null)

  nuxtApp.provide('api', api)


  return {
    provide: {
      api123:api
    }
  }
})


export function getApi($store, $axios) {
  const api = new Api({
    baseURL: 'http://localhost:8080',
    headers: {
      'xc-auth': $store?.state?.users?.token
    }
  })

  if($axios) {
    // overwrite with nuxt axios instance
    api.instance = $axios
  }
  return api
}
//
// export default function({ store: $store, $axios, ...rest }, inject) {
//   const api = getApi($store, $axios)
//
//   inject('api', api)
// }
