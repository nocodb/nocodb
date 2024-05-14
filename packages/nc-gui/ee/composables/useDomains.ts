import type { Api, DomainReqType, DomainType } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import { useNuxtApp } from 'nuxt/app'

export const useDomains = () => {
  const { $api } = <{ $api: Api<any> }>useNuxtApp()
  const { orgId } = storeToRefs(useOrg())

  const domains = ref<
    DomainType &
      {
        verifying?: boolean
        deleted?: boolean
        verified?: boolean
      }[]
  >([])

  const fetchDomains = async () => {
    try {
      const res = await $api.orgDomain.list(orgId.value)
      domains.value = res.list
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err as any))
      console.log(err)
    }
  }

  const updateDomain = async (id: string, domain: DomainReqType) => {
    try {
      await $api.orgDomain.update(id, domain)
      return true
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err as any))
      return false
    }
  }

  const deleteDomain = async (id: string) => {
    try {
      await $api.orgDomain.delete(id)
      domains.value = domains.value.filter((p) => p.id !== id)
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err as any))
    }
  }

  const addDomain = async (domain: DomainReqType) => {
    try {
      return await $api.orgDomain.create(orgId.value, domain)
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err as any))
    }
  }

  const verifyDomain = async (id: string) => {
    const domain = domains.value?.find((d) => d.id === id)
    if (domain) {
      domain.verifying = true
    }
    try {
      await $api.orgDomain.verify(id)
      await fetchDomains()
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err))
    } finally {
      if (domain) {
        domain.verifying = false
      }
    }
  }

  // pre-populate domain entry if not exist with deleted flag
  // it is to populate the txt value for domain verification
  const getPrePopulatedDomain = async () => {
    // check pre-populated provider exist
    let prePopulated = domains.value.find((p) => p.deleted)

    if (prePopulated) {
      return prePopulated
    }

    // pre-populate provider if not exist with deleted flag
    prePopulated = await addDomain({
      domain: '',
      deleted: true,
    })

    domains.value.push(prePopulated)

    return prePopulated
  }

  return {
    domains,
    addDomain,
    deleteDomain,
    updateDomain,
    fetchDomains,
    verifyDomain,
    getPrePopulatedDomain,
  }
}
