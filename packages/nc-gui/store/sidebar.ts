import { defineStore } from 'pinia'

export const useSidebarStore = defineStore('sidebarStore', () => {
  const isLeftSidebarOpen = ref(true)
  const isRightSidebarOpen = ref(true)

  return {
    isLeftSidebarOpen,
    isRightSidebarOpen,
  }
})
