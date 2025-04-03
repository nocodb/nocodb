import type { SSOClientType } from 'nocodb-sdk'

export const useAuthentication = (isOrg = false) => {
  const { api } = useApi()
  const { appInfo } = useGlobal()
  const { orgId } = storeToRefs(useOrg())

  const providers = ref<SSOClientType[]>([])

  const fetchProviders = async () => {
    try {
      const res = await (isOrg ? api.orgSsoClient.list(orgId.value) : api.ssoClient.list())
      providers.value = res.list
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err))
      console.log(err)
    }
  }

  const updateProvider = async (id: string, provider: Partial<SSOClientType>) => {
    try {
      if (isOrg) {
        await api.orgSsoClient.update(orgId.value, id, { ...provider, deleted: false })
      } else {
        await api.ssoClient.update(id, { ...provider, deleted: false })
      }
      return true
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err))
      return false
    }
  }

  const deleteProvider = async (providerId: string) => {
    try {
      if (isOrg) {
        await api.orgSsoClient.delete(orgId.value, providerId)
      } else {
        await api.ssoClient.delete(providerId)
      }
      providers.value = providers.value.filter((p) => p.id !== providerId)
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err))
      console.log(err)
    }
  }

  const addProvider = async (provider: SSOClientType) => {
    try {
      if (isOrg) {
        return await api.orgSsoClient.create(orgId.value, provider)
      } else {
        return await api.ssoClient.create(provider)
      }
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err))
      console.log(err)
    }
  }

  // pre-populate provider if not exist with deleted flag
  // it is to populate redirect url for sso client which requires id
  const getPrePopulatedProvider = async (type: SSOClientType['type']) => {
    // check pre-populated provider exist
    let prePopulated = providers.value.find((p) => p.type === type && p.deleted)
    if (prePopulated) {
      return prePopulated
    }

    // pre-populate provider if not exist with deleted flag
    prePopulated = await addProvider({
      type,
      deleted: true,
    })
    if (prePopulated) {
      providers.value.push(prePopulated)
    }

    return prePopulated
  }

  // method to construct redirect url for sso client
  const getRedirectUrl = (provider: SSOClientType) => {
    if (!provider?.id) return ``

    const { ncSiteUrl } = appInfo.value
    const { id } = provider

    return `${ncSiteUrl}/sso/${id}/redirect`
  }

  // for saml
  const getEntityId = (provider: SSOClientType) => {
    if (!provider?.id) return ``

    const { ncSiteUrl } = appInfo.value
    const { id } = provider

    return `${ncSiteUrl}/sso/${id}`
  }

  const signInUrl = computed(() => {
    const url = new URL(location.href)
    url.hash = isOrg ? '/sso' : '/signin'

    return url.href
  })

  return {
    providers,
    fetchProviders,
    updateProvider,
    deleteProvider,
    addProvider,
    getPrePopulatedProvider,
    getRedirectUrl,
    signInUrl,
    getEntityId,
  }
}
