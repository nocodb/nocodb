import { apiPlugin } from '../../plugins/api'
import { defineNuxtPlugin } from '#app'

declare module '#app' {
  interface NuxtApp {
    $api: ReturnType<typeof createApiInstance>
  }
}

export default defineNuxtPlugin(apiPlugin)
