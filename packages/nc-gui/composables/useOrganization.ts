export const useOrganization = () => {
  const { api } = useApi()

  const workspaces = ref([])
  const members = ref([])
  const bases = ref([])

  const { orgId } = storeToRefs(useOrg())

  const listWorkspaces = async (..._args: any) => {}

  const fetchOrganizationMembers = async (..._args: any) => {}

  const fetchOrganizationBases = async (..._args: any) => {}

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
