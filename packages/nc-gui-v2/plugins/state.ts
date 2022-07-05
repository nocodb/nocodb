import { defineNuxtPlugin } from '#app'
import { useGlobalState } from '~/composables/useGlobalState'

export default defineNuxtPlugin((nuxtApp) => {
  const createGlobalState = useGlobalState()
  nuxtApp.provide('state', createGlobalState())
})
