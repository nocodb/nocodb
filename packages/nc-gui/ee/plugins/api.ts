import type { Api } from 'nocodb-sdk';
import { apiPlugin } from '../../plugins/api'
import { defineNuxtPlugin } from '#app'

declare module '#app' {
  interface NuxtApp {
    $api: Api<any>
  }
}

export default defineNuxtPlugin(apiPlugin)
