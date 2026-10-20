export const useCodeProjects = createSharedComposable(() => {
  const isCodeProject = (_base?: { type?: string } | null) => false

  const isActiveBaseCodeProject = computed(() => false)

  const isCodeProjectRoute = (_route: { name?: unknown }) => false

  const isCodeProjectMachinesRoute = (_route: { name?: unknown }) => false

  const isCodeProjectAllowedRoute = (_route: { name?: unknown }) => false

  const machinesStatus = computed<'building' | 'failed' | 'ready' | undefined>(() => undefined)

  const navigateToCodeProject = (
    _base: Pick<NcProject, 'id' | 'fk_workspace_id'>,
    _opts?: { replace?: boolean; session?: string },
  ) => {}

  const openCodeProject = (_base: Pick<NcProject, 'id' | 'fk_workspace_id'>) => {}

  const isSessionSearchOpen = ref(false)

  const toggleSessionSearch = () => {}

  const codeProjectRoleLabels = computed<Partial<Record<string, string>>>(() => ({}))

  const codeProjectRoleDescriptions = computed<Partial<Record<string, string>>>(() => ({}))

  const codeProjectRolePhrase = (_role: string, _count: number): string | undefined => undefined

  return {
    codeProjectRoleLabels,
    codeProjectRoleDescriptions,
    codeProjectRolePhrase,
    isCodeProject,
    isActiveBaseCodeProject,
    isCodeProjectRoute,
    isCodeProjectMachinesRoute,
    isCodeProjectAllowedRoute,
    machinesStatus,
    navigateToCodeProject,
    openCodeProject,
    isSessionSearchOpen,
    toggleSessionSearch,
  }
})
