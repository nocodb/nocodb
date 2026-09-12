export const useEnvironmentChangelog = createSharedComposable(() => {
  const isDrawerOpen = ref(false)

  return {
    isDrawerOpen,
  }
})
