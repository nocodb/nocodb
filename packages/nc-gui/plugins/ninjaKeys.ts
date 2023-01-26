import 'ninja-keys'
import { defineNuxtPlugin, resolveComponent } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('NinjaKeys', resolveComponent('ninja-keys'))
})
