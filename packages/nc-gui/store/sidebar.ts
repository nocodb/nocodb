import { defineStore } from 'pinia'

export const useSidebarStore = defineStore('sidebarStore', () => {
  const isLeftSidebarOpen = ref(true)
  const isRightSidebarOpen = ref(true)
  const leftSidebarWidthPercent = ref(20)

  return {
    isLeftSidebarOpen,
    isRightSidebarOpen,
    leftSidebarWidthPercent,
  }
})
