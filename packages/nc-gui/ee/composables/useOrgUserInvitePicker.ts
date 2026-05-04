import { CloudOrgUserRoles, NC_DEFAULT_ORG_ID, OrgUserRoles, extractRolesObj } from 'nocodb-sdk'
import type { OrgUserPickerItem } from '~/composables/useOrgUserInvitePicker'

export type { OrgUserPickerItem }

/**
 * EE implementation — fetches org users from the backend so the invite dialog
 * can surface existing org members as suggestions. Filtering happens in the
 * parent component; this only owns the data load.
 *
 * The picker is intentionally limited to **org admins** (cloud-org-level-owner)
 * and **on-prem super admins**. Workspace owners who don't hold one of those
 * org-level roles get nothing — exposing every other org member's identity to
 * any workspace creator would leak information across workspaces in a shared
 * org. Both the backend ACL on `/users/invitable` and this client gate enforce
 * the rule; the gate is here purely so we don't fire a guaranteed-403 request.
 */
export function useOrgUserInvitePicker(opts: {
  type?: 'base' | 'workspace' | 'organization'
  workspaceId?: string
  baseId?: string
}) {
  const { $api } = useNuxtApp()
  const { appInfo, user } = useGlobal()
  const workspaceStore = useWorkspace()
  const { activeWorkspace, workspacesList } = storeToRefs(workspaceStore)

  const orgUsers = ref<OrgUserPickerItem[]>([])

  const orgIdForPicker = computed(() => {
    if (opts.workspaceId) {
      const ws = workspacesList.value?.find((w: any) => w.id === opts.workspaceId)
      if (ws?.fk_org_id) return ws.fk_org_id as string
    }
    if ((activeWorkspace.value as any)?.fk_org_id) return (activeWorkspace.value as any).fk_org_id as string
    // Last-resort fallback for setups where no org is wired (e.g. shared EE
    // test mode). The backend will 404 if no such org exists; the catch
    // below swallows it and the picker stays empty.
    return appInfo.value?.defaultOrgId || NC_DEFAULT_ORG_ID
  })

  const isOrgAdmin = computed(() => {
    const u = user.value as any
    if (!u) return false
    const globalRoles = extractRolesObj(u.roles ?? {}) ?? {}
    const cloudOrgRoles = extractRolesObj(u.org_roles ?? {}) ?? {}
    return !!(globalRoles[OrgUserRoles.SUPER_ADMIN] || cloudOrgRoles[CloudOrgUserRoles.OWNER])
  })

  const fetchOrgUsers = async () => {
    if (!isEeUI) return
    if (opts.type !== 'workspace' && opts.type !== 'base') return
    if (!isOrgAdmin.value) return

    const orgId = orgIdForPicker.value
    if (!orgId) return

    try {
      const query: { excludeWorkspaceId?: string; excludeBaseId?: string } = {}
      if (opts.type === 'workspace' && opts.workspaceId) query.excludeWorkspaceId = opts.workspaceId
      if (opts.type === 'base' && opts.baseId) query.excludeBaseId = opts.baseId

      const res = await $api.orgUser.listInvitable(orgId, query)
      orgUsers.value = Array.isArray(res) ? (res as OrgUserPickerItem[]) : []
    } catch {
      // Progressive enhancement — fall back to plain email input on failure.
      orgUsers.value = []
    }
  }

  const resetOrgUsers = () => {
    orgUsers.value = []
  }

  return {
    fetchOrgUsers,
    resetOrgUsers,
    orgUsers,
    isOrgAdmin,
  }
}
