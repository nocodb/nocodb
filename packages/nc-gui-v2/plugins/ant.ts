import { Menu as AntMenu } from 'ant-design-vue'
import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component(AntMenu.name, AntMenu)
})
