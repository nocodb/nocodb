import { NC_DEFAULT_ORG_ID } from 'nocodb-sdk'
import type { OrgUserPickerItem } from '~/composables/useOrgUserInvitePicker'

export type { OrgUserPickerItem }

/**
 * EE implementation — fetches org users from the backend so the invite dialog
 * can surface existing org members as suggestions. Filtering happens in the
 * parent component; this only owns the data load.
 */
export function useOrgUserInvitePicker(opts: {
  type?: 'base' | 'workspace' | 'organization'
  workspaceId?: string
  baseId?: string
}) {
  const { $api } = useNuxtApp()
  const { appInfo } = useGlobal()
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

  const fetchOrgUsers = async () => {
    if (!isEeUI) return
    if (opts.type !== 'workspace' && opts.type !== 'base') return

    const orgId = orgIdForPicker.value
    if (!orgId) return

    try {
      const query: { excludeWorkspaceId?: string; excludeBaseId?: string } = {}
      if (opts.type === 'workspace' && opts.workspaceId) query.excludeWorkspaceId = opts.workspaceId
      if (opts.type === 'base' && opts.baseId) query.excludeBaseId = opts.baseId

      const res = await $api.orgUser.list(orgId, query)
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
  }
}
