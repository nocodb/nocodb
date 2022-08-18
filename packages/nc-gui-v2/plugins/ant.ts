import { Menu as AntMenu, ConfigProvider } from 'ant-design-vue'
import { defineNuxtPlugin, themeColors } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  ConfigProvider.config({
    theme: {
      primaryColor: themeColors.primary,
    },
  })

  nuxtApp.vueApp.component(AntMenu.name, AntMenu)
})
