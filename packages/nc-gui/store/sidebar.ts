import { defineStore } from 'pinia'

export const useSidebarStore = defineStore('sidebarStore', () => {
  const isLeftSidebarOpen = ref(true)
  const isRightSidebarOpen = ref(true)
  const leftSidebarWidthPercent = ref(20)

  const rightSidebarSize = ref({
    old: 20,
    current: 20,
  })

  return {
    isLeftSidebarOpen,
    isRightSidebarOpen,
    rightSidebarSize,
    leftSidebarWidthPercent,
  }
})
