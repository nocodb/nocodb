import { OrgUserRoles, extractRolesObj } from 'nocodb-sdk'

export const useOrganization = () => {
  const { api } = useApi()

  const workspaces = ref([])
  const members = ref([])
  const bases = ref([])

  const { orgId } = storeToRefs(useOrg())

  const listWorkspaces = async () => {
    try {
      let ws = await api.orgWorkspace.list(orgId.value)
      ws = ws.map((w) => {
        w.members = w.members.map((user: any) => JSON.parse(user))

        w.bases = w.bases.map((b) => {
          b = JSON.parse(b)
          return b
        })
        return w
      })

      workspaces.value = ws
    } catch (e) {
      console.log(e)
      workspaces.value = []
      message.error(await extractSdkResponseErrorMsg(e))
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
        return u
      })

      members.value = res
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e))
      console.log(e)
      members.value = []
    }
  }

  const fetchOrganizationBases = async () => {
    try {
      bases.value = (await api.orgBases.orgBaseList(orgId.value)).list
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e))
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
