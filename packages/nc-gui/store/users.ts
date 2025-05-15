import type { UserType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useUsers = defineStore('userStore', () => {
  const { api } = useApi()
  const { user } = useGlobal()
  const { loadRoles } = useRoles()
  const basesStore = useBases()

  const updateUserProfile = async ({ attrs }: { attrs: Pick<UserType, 'display_name' | 'meta'> }) => {
    if (!user.value) throw new Error('User is not defined')

    await api.userProfile.update(attrs)

    user.value = {
      ...user.value,
      ...attrs,
    }

    basesStore.clearBasesUser()
  }

  const loadCurrentUser = loadRoles

  watch(
    () => user.value?.id,
    (newId, oldId) => {
      if (!newId) return
      if (newId === oldId) return

      loadCurrentUser()
    },
    {
      immediate: true,
    },
  )

  return {
    loadCurrentUser,
    updateUserProfile,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUsers as any, import.meta.hot))
}
