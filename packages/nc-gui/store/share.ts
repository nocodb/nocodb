import { acceptHMRUpdate, defineStore } from 'pinia'
import { ProjectRoles } from 'nocodb-sdk'

export const useShare = defineStore('share', () => {
  const visibility = ref<'public' | 'private' | 'none' | 'hidden'>('none')
  const { base } = toRefs(useBase())

  const isProjectPublic = computed(() => {
    if (typeof base.value?.meta === 'string') {
      const meta = JSON.parse(base.value?.meta)
      return meta.isPublic
    }

    return (base.value?.meta as any)?.isPublic
  })

  const formStatus = ref<
    | 'collaborate'
    | 'base-collaborateSaving'
    | 'base-collaborateSaved'
    | 'manageCollaborators'
    | 'base-collaborate'
    | 'base-public'
    | 'none'
  >('none')
  const invitationValid = ref(false)
  const isInvitationLinkCopied = ref(false)

  const showShareModal = ref(false)

  const invitationUsersData = ref<Users>({ emails: undefined, role: ProjectRoles.VIEWER, invitationToken: undefined })

  watch(
    [isProjectPublic],
    () => {
      visibility.value = isProjectPublic.value ? 'public' : 'private'
    },
    { immediate: true, deep: true },
  )

  const resetData = () => {
    formStatus.value = 'base-collaborate'
    invitationValid.value = false
    invitationUsersData.value = { emails: undefined, role: ProjectRoles.VIEWER, invitationToken: undefined }
    isInvitationLinkCopied.value = false
  }

  return {
    visibility,
    showShareModal,
    formStatus,
    invitationValid,
    invitationUsersData,
    isProjectPublic,
    resetData,
    isInvitationLinkCopied,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useShare as any, import.meta.hot))
}
