import type { NuxtApp as BaseApp } from '#app/nuxt'
import type { Api } from 'nocodb-sdk'

declare module '#app/nuxt' {
  interface NuxtApp extends BaseApp {
    $api: Api<any>;
  }
}
