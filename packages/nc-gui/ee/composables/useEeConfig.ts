import type { PlanFeatureTypes, PlanLimitTypes, WorkspaceType } from 'nocodb-sdk'

export const useEeConfig = createSharedComposable(() => {
  const workspaceStore = useWorkspace()

  const { activeWorkspace } = storeToRefs(workspaceStore)

  const getLimit = (type: PlanLimitTypes, workspace?: WorkspaceType | null) => {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    return workspace?.payment?.plan?.meta?.[type]
  }

  const getFeature = (type: PlanFeatureTypes, workspace?: WorkspaceType | null) => {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    return workspace?.payment?.plan?.meta?.[type]
  }

  return {
    getLimit,
    getFeature,
  }
})
