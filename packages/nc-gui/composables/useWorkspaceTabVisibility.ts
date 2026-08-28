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
  const { creditsEnabled } = storeToRefs(useCredits())

  // Workspace-level SSO is cloud-only for now (on-prem uses instance-level SSO)
  const isWorkspaceSsoAvail = computed(() => {
    return isEeUI && appInfo.value?.isCloud && !!getFeature(PlanFeatureTypes.FEATURE_SSO)
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
      teams: hasTeamsEditPermission.value && showEEFeatures.value,
      integrations: !isMobileMode.value && isUIAllowed('workspaceIntegrations'),
      billing:
        !isMobileMode.value &&
        !isAdmin.value &&
        isEeUI &&
        !ws.value?.fk_org_id &&
        (isPaymentEnabled.value || creditsEnabled.value) &&
        isBaseRolesLoaded.value &&
        isUIAllowed('workspaceBilling'),
      // Org-linked (enterprise) workspaces have no Billing tab — Usage shows their
      // plan limits instead. Also visible to org admins drilling into a workspace.
      usage:
        !isMobileMode.value &&
        isEeUI &&
        !!ws.value?.fk_org_id &&
        isBaseRolesLoaded.value &&
        (isAdmin.value || isUIAllowed('workspaceBilling')),
      audits:
        !isMobileMode.value &&
        !isAdmin.value &&
        showEEFeatures.value &&
        isBaseRolesLoaded.value &&
        isUIAllowed('workspaceAuditList'),
      sso:
        !isMobileMode.value &&
        isWorkspaceSsoAvail.value &&
        !ws.value?.fk_org_id &&
        isBaseRolesLoaded.value &&
        isUIAllowed('workspaceSSO'),
      settings: isEeUI,
    }
  })

  /**
   * Tabs that render under the "Admin" section on the workspace home, in display order.
   * Single source of truth for the Admin nav item, its sub-tab bar, and any page that
   * needs to know whether that 44px bar is on screen.
   */
  const visibleAdminTabKeys = computed(() => {
    const visibility = wsTabVisibility.value

    return (['settings', 'billing', 'usage', 'audits', 'sso'] as const).filter((key) => visibility[key])
  })

  /**
   * The Admin sub-tab bar only renders when there's more than one tab to switch between —
   * with a single tab, landing on the Admin page already *is* the destination. Pages sized
   * against the viewport must not reserve its height when it's absent.
   */
  const hasAdminTabBar = computed(() => visibleAdminTabKeys.value.length > 1)

  return {
    isWorkspaceSsoAvail,
    hasTeamsEditPermission,
    wsTabVisibility,
    visibleAdminTabKeys,
    hasAdminTabBar,
  }
}
