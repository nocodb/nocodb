import { acceptHMRUpdate, defineStore } from 'pinia'

// a placeholder for the org store which is used in cloud version
export const useOrg = defineStore('orgStore', () => {
  const org = ref()
  const orgId = ref(null)

  const loadOrg = async () => {}
  const updateOrg = async (_updateObj: any) => {}

  return {
    org,
    orgId,
    updateOrg,
    loadOrg,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useOrg as any, import.meta.hot))
}
