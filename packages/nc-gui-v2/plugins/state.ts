import { defineNuxtPlugin } from 'nuxt3/app'
import { useGlobalState } from '~/composables/useGlobalState'

export default defineNuxtPlugin((nuxtApp) => {
  const createGlobalState = useGlobalState()
  const globalState = createGlobalState()

  // set initial app language to the first preferred language (found in state)
  ;(nuxtApp.vueApp as any).i18n.global.locale.value = globalState.value.lang

  nuxtApp.provide('state', globalState)
})
