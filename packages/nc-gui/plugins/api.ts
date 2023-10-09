import { defineNuxtPlugin, isEeUI, useApi } from '#imports'

const apiPlugin = defineNuxtPlugin((nuxtApp) => {
  /** injects a global api instance */
  nuxtApp.provide('api', useApi().api)
})

const defaultExport = isEeUI ? defineNuxtPlugin(async () => {}) : apiPlugin

export { apiPlugin }

export default defaultExport
