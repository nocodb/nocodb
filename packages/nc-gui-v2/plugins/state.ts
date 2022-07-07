import { defineNuxtPlugin } from '#app'
import { useGlobalState } from '~/composables/useGlobalState'

export default defineNuxtPlugin((nuxtApp) => {
  const storage = useGlobalState()

  // set initial app language to the first preferred language (found in state)
  ;(nuxtApp.vueApp as any).i18n.global.locale.value = storage.lang.value

  nuxtApp.provide('state', storage)
})
