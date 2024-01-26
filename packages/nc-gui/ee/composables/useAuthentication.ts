import type { SSOClientType } from 'nocodb-sdk'

export const useAuthentication = () => {
  const { api } = useApi()

  const providers = ref<SSOClientType[]>([])

  const fetchProviders = async () => {
    const res = await api.ssoClient.list()
    providers.value = res.list
  }

  const updateProvider = async (id: string, provider: Partial<SSOClientType>) => {
    try {
      const res = await api.ssoClient.update(id, {
        body: provider,
      })
      providers.value = providers.value.map((p) => (p.id === id ? res : p))
    } catch (err) {
      message.error(err.message)
      console.log(err)
    }
  }

  const deleteProvider = async (providerId: string) => {
    try {
      await api.ssoClient.delete(providerId)
      providers.value = providers.value.filter((p) => p.id !== providerId)
    } catch (err) {
      message.error(err.message)
      console.log(err)
    }
  }

  const addProvider = async (provider: SSOClientType) => {
    try {
      await api.ssoClient.create({
        body: provider,
      })
      await fetchProviders()
    } catch (err) {
      message.error(err.message)
      console.log(err)
    }
  }

  return { providers, fetchProviders, updateProvider, deleteProvider, addProvider }
}
