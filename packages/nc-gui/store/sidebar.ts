import { defineStore } from 'pinia'

export const useSidebarStore = defineStore('sidebarStore', () => {
  const isOpen = ref(true)

  return {
    isOpen,
  }
})
