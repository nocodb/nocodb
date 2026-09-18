import { computed, inject } from 'vue'
import type { Ref } from 'vue'
import { resolveViewRecordCountRoles } from '~/utils/viewRecordCountRoles'
import type { ViewCountRoleInput } from '~/utils/viewRecordCountRoles'

/** Sidebar permissions never borrow the active base or workspace's roles. */
export function useViewRecordCountRoles(baseId: Ref<string | undefined>, toolbarRoles?: Ref<ViewCountRoleInput>) {
  const scopedRole = inject(ProjectRoleInj, undefined)
  const scopedBase = inject(ProjectInj, undefined)
  const { orgRoles } = useRoles()

  return computed(() => {
    const base = scopedBase?.value as { id?: string; workspace_role?: ViewCountRoleInput } | undefined
    const matchesTarget = !!baseId.value && base?.id === baseId.value
    // The base page also provides ProjectInj. Only ProjectRoleInj identifies
    // a sidebar node; the toolbar must retain its effective direct base role.
    let directRoles = toolbarRoles?.value
    if (scopedRole) directRoles = matchesTarget ? scopedRole.value : undefined
    else if (scopedBase && !matchesTarget) directRoles = undefined
    return resolveViewRecordCountRoles(
      directRoles,
      matchesTarget ? base?.workspace_role : undefined,
      orgRoles.value,
    )
  })
}
