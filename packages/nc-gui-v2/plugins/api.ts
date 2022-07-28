import { defineNuxtPlugin } from '#imports'
import { createApiInstance } from '~/composables/useApi'

export default defineNuxtPlugin((nuxtApp) => {
  /** injects a global api instance */
  nuxtApp.provide('api', createApiInstance(nuxtApp))
})
