export const useLoadingTrigger = () => {
  const { $state } = useNuxtApp()

  return {
    withLoading: (handler: (param?: any) => Promise<void> | void) => async (param?: any) => {
      if (param?.shouldShowLoading !== false) {
        $state.isLoading.value = true
      }
      try {
        await handler(param)
      } finally {
        if (param?.shouldShowLoading !== false) {
          $state.isLoading.value = false
        }
      }
    },
  }
}
