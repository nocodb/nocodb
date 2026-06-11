export const useUpdateChecker = createSharedComposable(() => {
  return {
    isUpdateAvailable: ref(false),
  }
})
