import { defineStore } from 'pinia'

export const useConfigStore = defineStore('configStore', () => {
  const { isMobileMode: globalIsMobile } = useGlobal()
  const isMobileMode = ref(window.innerWidth < 820)

  const isViewPortMobile = () => window.innerWidth < 820

  const onViewPortResize = () => {
    isMobileMode.value = isViewPortMobile()
  }

  window.addEventListener('DOMContentLoaded', onViewPortResize)
  window.addEventListener('resize', onViewPortResize)

  watch(
    isMobileMode,
    () => {
      globalIsMobile.value = isMobileMode.value
    },
    {
      immediate: true,
    },
  )

  return {
    isMobileMode,
  }
})
