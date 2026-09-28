export const useCodeProjects = createSharedComposable(() => {
  const isCodeProject = (_base?: Pick<NcProject, 'type'> | null) => false

  const isActiveBaseCodeProject = computed(() => false)

  const isCodeProjectRoute = (_route: { name?: unknown }) => false

  const isCodeProjectAllowedRoute = (_route: { name?: unknown }) => false

  const navigateToCodeProject = (_base: Pick<NcProject, 'id' | 'fk_workspace_id'>, _opts?: { replace?: boolean }) => {}

  const openCodeProject = (_base: Pick<NcProject, 'id' | 'fk_workspace_id'>) => {}

  const isSessionSearchOpen = ref(false)

  const toggleSessionSearch = () => {}

  return {
    isCodeProject,
    isActiveBaseCodeProject,
    isCodeProjectRoute,
    isCodeProjectAllowedRoute,
    navigateToCodeProject,
    openCodeProject,
    isSessionSearchOpen,
    toggleSessionSearch,
  }
})
