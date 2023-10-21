import { defineNuxtPlugin, isEeUI, useApi } from '#imports'

const apiPlugin = (nuxtApp) => {
  /** injects a global api instance */
  nuxtApp.provide('api', useApi().api)
}

export { apiPlugin }

export default defineNuxtPlugin(function (nuxtApp) {
  if (!isEeUI) return apiPlugin(nuxtApp)
})
