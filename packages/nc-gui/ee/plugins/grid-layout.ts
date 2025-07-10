import { GridItem, GridLayout } from 'grid-layout-plus'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('GridItem', GridItem).component('GridLayout', GridLayout)
})
