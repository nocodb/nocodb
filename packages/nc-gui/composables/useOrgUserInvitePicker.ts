import type { OrgUserListItemType } from 'nocodb-sdk'

/**
 * CE stub — org users are an EE concept. Returns an empty list so the invite
 * dialog's picker dropdown simply doesn't render in CE.
 */
export function useOrgUserInvitePicker(_opts: {
  type?: 'base' | 'workspace' | 'organization'
  workspaceId?: string
  baseId?: string
}) {
  return {
    fetchOrgUsers: async () => {},
    resetOrgUsers: () => {},
    orgUsers: ref<OrgUserListItemType[]>([]),
    isOrgAdmin: computed(() => false),
  }
}
