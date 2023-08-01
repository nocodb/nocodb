import { acceptHMRUpdate, defineStore } from 'pinia'

// TODO: Move view composable to here
export const useViewsStore = defineStore('viewsStore', () => {
  const isViewsLoading = ref(true)

  return {
    isViewsLoading,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewsStore as any, import.meta.hot))
}
