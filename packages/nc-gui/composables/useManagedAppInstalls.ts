export const useManagedAppInstalls = createSharedComposable(() => {
  const isAppInstall = (_base?: NcProject | null) => false

  const isAppOnlyInstall = (_base?: NcProject | null) => false

  const isActiveBaseAppOnlyInstall = computed(() => false)

  const isAppConsumerRoute = (_route: { name?: unknown }) => false

  const navigateToApp = (_base: NcProject, _opts?: { replace?: boolean }) => {}

  return {
    isAppInstall,
    isAppOnlyInstall,
    isActiveBaseAppOnlyInstall,
    isAppConsumerRoute,
    navigateToApp,
  }
})
