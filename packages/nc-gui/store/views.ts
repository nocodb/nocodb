import { acceptHMRUpdate, defineStore } from 'pinia'

// TODO: Move view composable to here
export const useViewsStore = defineStore('viewsStore', () => {
  const isViewsLoading = ref(true)
  const isViewDataLoading = ref(true)

  // Used for Grid View Pagination
  const isPaginationLoading = ref(false)

  return {
    isViewsLoading,
    isViewDataLoading,
    isPaginationLoading,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewsStore as any, import.meta.hot))
}
