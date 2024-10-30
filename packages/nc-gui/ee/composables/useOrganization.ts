import type { CloudOrgUserRoles, ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk'
import { OrgUserRoles, extractRolesObj } from 'nocodb-sdk'

export const useOrganization = () => {
  const { api } = useApi()

  const workspaces = ref<
    Array<{
      id: string
      title: string
      meta: string
      memberCount: number
      members: Array<{
        id: string
        display_name: string
        email: string
        mail_roles: CloudOrgUserRoles
        roles: WorkspaceUserRoles
        created_at: string
      }>
      baseCount: number
      bases: Array<{
        id: string
        title: string
        meta: string
        created_at: string
        updated_at: string
      }>
    }>
  >([])
  const members = ref<
    Array<{
      id: string
      email: string
      display_name: string
      main_roles: OrgUserRoles
      cloud_org_roles: CloudOrgUserRoles
      created_at: string
      workspaceCount: number
      workspaces: Array<{
        created_at: string
        id: string
        title: string
        roles: WorkspaceUserRoles
      }> | null
    }>
  >([])
  const bases = ref<
    Array<{
      id: string
      title: string
      base_meta: string
      org_id: string
      updated_at: string
      workspace_id: string
      workspace_meta: string
      workspace_title: string
      memberCount: number
      members: Array<{
        id: string
        display_name: string
        email: string
        invite_token: string
        main_roles: CloudOrgUserRoles
        created_at: string
        base_id: string
        roles: ProjectRoles
        workspace_roles: WorkspaceUserRoles
        workspace_id: string
        deleted: boolean
      }>
    }>
  >([])

  const { orgId } = storeToRefs(useOrg())

  const listWorkspaces = async () => {
    try {
      let ws = await api.orgWorkspace.list(orgId.value)
      ws = ws.map((w) => {
        w.meta = parseProp(w.meta)

        w.members = w.members.map((user: any) => JSON.parse(user))
        w.memberCount = w.members.length

        w.bases = w.bases.map((b) => {
          b = JSON.parse(b)
          return b
        })
        w.baseCount = w.bases.length
        return w
      })

      workspaces.value = ws
    } catch (e) {
      console.log(e)
      workspaces.value = []
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const fetchOrganizationMembers = async () => {
    try {
      let res = await api.orgUser.list(orgId.value)
      res = res.map((u) => {
        const role = extractRolesObj(u.main_roles)
        u.main_roles = role[OrgUserRoles.SUPER_ADMIN]
          ? OrgUserRoles.SUPER_ADMIN
          : role[OrgUserRoles.CREATOR]
          ? OrgUserRoles.CREATOR
          : OrgUserRoles.VIEWER
        u.workspaceCount = u.workspaces.length
        return u
      })

      members.value = res
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
      console.log(e)
      members.value = []
    }
  }

  const fetchOrganizationBases = async () => {
    try {
      const res = (await api.orgBases.orgBaseList(orgId.value)).list
      bases.value = res.map((b) => {
        b.members = b.members.map((user: any) => {
          user.main_roles = user.main_roles[OrgUserRoles.SUPER_ADMIN]
            ? OrgUserRoles.SUPER_ADMIN
            : user.main_roles[OrgUserRoles.CREATOR]
            ? OrgUserRoles.CREATOR
            : OrgUserRoles.VIEWER
          return user
        })
        b.memberCount = b.members.length
        return b
      })
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
      console.log(e)
      bases.value = []
    }
  }

  return {
    orgId,
    workspaces,
    listWorkspaces,
    fetchOrganizationMembers,
    fetchOrganizationBases,
    bases,
    members,
  }
}
