import type { MaybeRefOrGetter } from 'vue'
import { PlanFeatureTypes } from 'nocodb-sdk'

/**
 * Single source of truth for workspace tab visibility.
 *
 * @param workspace  — reactive workspace object (needs `fk_org_id`)
 * @param options.isAdminPanel — true when admin is viewing a specific workspace
 */
export function useWorkspaceTabVisibility(
  workspace: MaybeRefOrGetter<{ fk_org_id?: string } | undefined | null>,
  options?: { isAdminPanel?: MaybeRefOrGetter<boolean> },
) {
  const isAdmin = computed(() => toValue(options?.isAdminPanel) ?? false)
  const ws = computed(() => toValue(workspace))

  const { appInfo, isMobileMode } = useGlobal()
  const { isUIAllowed, isBaseRolesLoaded } = useRoles()
  const { isTeamsEnabled } = storeToRefs(useWorkspace())
  const { isPaymentEnabled, getFeature, showEEFeatures } = useEeConfig()

  const isWorkspaceSsoAvail = computed(() => {
    return isEeUI && (appInfo.value?.isCloud || appInfo.value?.isOnPrem) && !!getFeature(PlanFeatureTypes.FEATURE_SSO)
  })

  const hasTeamsEditPermission = computed(() => {
    return isEeUI && isTeamsEnabled.value && (isAdmin.value || isUIAllowed('teamCreate'))
  })

  const wsTabVisibility = computed(() => {
    // Access to trigger re-evaluation when roles finish loading
    // eslint-disable-next-line no-unused-expressions
    isBaseRolesLoaded.value

    return {
      collaborators: isAdmin.value || isUIAllowed('workspaceCollaborators'),
      teams: isEeUI && hasTeamsEditPermission.value && showEEFeatures.value,
      integrations: !isMobileMode.value && isUIAllowed('workspaceIntegrations'),
      billing:
        !isMobileMode.value &&
        !isAdmin.value &&
        isEeUI &&
        !ws.value?.fk_org_id &&
        isPaymentEnabled.value &&
        isBaseRolesLoaded.value &&
        isUIAllowed('workspaceBilling'),
      audits: !isMobileMode.value && !isAdmin.value && isEeUI && isBaseRolesLoaded.value && isUIAllowed('workspaceAuditList'),
      sso:
        !isMobileMode.value &&
        isWorkspaceSsoAvail.value &&
        !ws.value?.fk_org_id &&
        isBaseRolesLoaded.value &&
        isUIAllowed('workspaceSSO'),
      settings: showEEFeatures.value,
    }
  })

  return {
    isWorkspaceSsoAvail,
    hasTeamsEditPermission,
    wsTabVisibility,
  }
}
