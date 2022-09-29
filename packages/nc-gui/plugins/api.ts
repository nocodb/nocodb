import { defineNuxtPlugin, useApi } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  /** injects a global api instance */
  nuxtApp.provide('api', useApi().api)
})
