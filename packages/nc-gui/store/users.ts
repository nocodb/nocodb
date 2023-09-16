import { acceptHMRUpdate, defineStore } from 'pinia'

export const useUsers = defineStore('userStore', () => {
  const { api } = useApi()
  const { user } = useGlobal()

  const updateUserProfile = async ({
    attrs,
  }: {
    attrs: {
      display_name?: string
    }
  }) => {
    if (!user.value) throw new Error('User is not defined')

    await api.userProfile.update(attrs)

    user.value = {
      ...user.value,
      ...attrs,
    }
  }

  const loadCurrentUser = async () => {
    const res = await api.auth.me()

    user.value = {
      ...user.value,
      ...res,
      roles: res.roles,
      project_roles: res.project_roles,
      workspace_roles: res.workspace_roles,
    }
  }

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
