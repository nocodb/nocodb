import type { SSOClientType } from 'nocodb-sdk'
import { message } from 'ant-design-vue'

export const useAuthentication = () => {
  const { api } = useApi()

  const providers = ref<SSOClientType[]>([])

  const fetchProviders = async () => {
    try {
      const res = await api.ssoClient.list()
      providers.value = res.list
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err))
      console.log(err)
    }
  }

  const updateProvider = async (id: string, provider: Partial<SSOClientType>) => {
    try {
      await api.ssoClient.update(id, { ...provider, deleted: false })
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err))
      console.log(err)
    }
  }

  const deleteProvider = async (providerId: string) => {
    try {
      await api.ssoClient.delete(providerId)
      providers.value = providers.value.filter((p) => p.id !== providerId)
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err))
      console.log(err)
    }
  }

  const addProvider = async (provider: SSOClientType) => {
    try {
      return await api.ssoClient.create(provider)
    } catch (err) {
      message.error(await extractSdkResponseErrorMsg(err))
      console.log(err)
    }
  }

  // pre-populate provider if not exist with deleted flag
  // it is to populate redirect url for sso client which requires id
  const getPrePopulatedProvider = (type: SSOClientType['type']) => {
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

    providers.value.push(prePopulated)

    return prePopulated
  }

  return { providers, fetchProviders, updateProvider, deleteProvider, addProvider, getPrePopulatedProvider }
}
