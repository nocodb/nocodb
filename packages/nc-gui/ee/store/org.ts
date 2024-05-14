import { acceptHMRUpdate, defineStore } from 'pinia'
import type { Api, OrgType } from 'nocodb-sdk'

export const useOrg = defineStore('orgStore', () => {
  const org = ref()

  const { $api } = <{ $api: Api<any> }>useNuxtApp()

  const router = useRouter()
  const route = router.currentRoute

  const orgId = computed(() => route.value.params.orgId)

  const loadOrg = async () => {
    if (orgId.value) {
      try {
        org.value = await $api.org.read(orgId.value)
      } catch (e) {
        org.value = null
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }
  }

  watch(orgId, async (id) => {
    if (id) {
      await loadOrg()
    }
  })

  const updateOrg = async (updateObj: Partial<OrgType>) => {
    try {
      await $api.org.update(orgId.value, updateObj)
      const oldOrg = org.value
      org.value = {
        ...oldOrg,
        ...updateObj,
      }
      message.success('Organization details updated successfully')
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

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
