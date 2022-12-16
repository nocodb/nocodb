import { useNuxtApp, useRouter } from '#imports'

export function useProfile() {
  const { $api } = useNuxtApp()

  const router = useRouter()

  const profile = ref()

  const loadProfile = async (username: string) => {
    if (!username) return

    try {
      const user = await $api.orgUsers.getByUsername(username)
      profile.value = await $api.orgUsers.profileGet(user.id)
    } catch (e: any) {
      if (e?.response?.status === 404) {
        return router.push('/error/404')
      }
      throw e
    }
  }
  return {
    loadProfile,
    profile,
  }
}
