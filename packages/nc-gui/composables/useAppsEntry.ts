import type { WorkspaceAppItem } from 'nocodb-sdk'

// Apps (AI + classic) are EE-only; the EE composable is the real one.
export const useAppsEntry = createSharedComposable(() => {
  return {
    canBuildAi: computed(() => false),
    canBuildClassic: computed(() => false),
    isClassicUpsell: computed(() => false),
    canCreateApp: computed(() => false),
    canCreateWorkspaceApp: computed(() => false),
    isAppBuilder: computed(() => false),
    areRolesLoaded: computed(() => false),
    hidesAppsSidebar: computed(() => false),
    appsHomeRoute: (_baseId: string, _workspaceId?: string) => undefined,
    openAppsHome: async (_params: { baseId: string; workspaceId?: string; replace?: boolean }) => {},
    launchApp: (_params: {
      baseId: string
      workspaceId?: string
      aiApp?: { id?: string; title?: string } | null
      interfaceId?: string
    }) => {},
    baseCardAppCount: (_base: NcProject) => 0,
    openBaseFromCard: async (_base: NcProject) => {},
    lastOpenedApp: (_baseId: string): { type: 'ai' | 'classic'; id: string } | undefined => undefined,
    visibleWorkspaceApps: computed<WorkspaceAppItem[]>(() => []),
    isWorkspaceAppsLoaded: computed(() => true),
    loadWorkspaceApps: async (_workspaceId?: string) => {},
    dropBaseApps: (_baseId: string) => {},
    openWorkspaceApp: (_item: WorkspaceAppItem) => {},
    editWorkspaceApp: (_item: WorkspaceAppItem) => {},
    openAppChooser: (_params: { baseId: string }) => {},
    openClassicWizard: (_params: { baseId: string; triggerSource?: string }) => {},
    openAiApp: async (_params: { baseId: string }) => {},
    appCreateRestriction: (_baseId?: string): string | null => null,
    baseAiApp: (_baseId?: string) => null,
    usableAiApp: (_baseId?: string) => null,
    baseClassicApps: (_baseId?: string) => [],
  }
})
