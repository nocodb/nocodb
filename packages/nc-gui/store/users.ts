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

  /**
   * Patch `user.meta` without clobbering keys written by other features.
   *
   * The backend replaces `meta` wholesale (`profileUpdate` -> `User.update`), so
   * sending a partial object drops everything else stored there. Any caller that
   * writes a single key (avatar icon, tour state, ...) must go through this.
   *
   * Read-modify-write is not atomic — a concurrent write from another tab can be
   * lost. That is acceptable for the current callers (worst case: an avatar or a
   * dismissed tour reverts); do not use this for anything where a lost write
   * matters.
   */
  const updateUserMeta = async (patch: Record<string, unknown>) => {
    if (!user.value) throw new Error('User is not defined')

    const meta = {
      ...(parseProp(user.value.meta) ?? {}),
      ...patch,
    }

    await updateUserProfile({ attrs: { meta } })
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
    updateUserMeta,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUsers as any, import.meta.hot))
}
