import { Menu as AntMenu, Modal as AntModal } from 'ant-design-vue'
import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component(AntMenu.name, AntMenu)
  nuxtApp.vueApp.component(AntModal.name, AntModal)
})
