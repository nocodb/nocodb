import { acceptHMRUpdate, defineStore } from 'pinia'
import type { Users } from '#imports'

export const useShare = defineStore('share', () => {
  const visibility = ref<'public' | 'private' | 'none' | 'hidden'>('none')
  const { project } = toRefs(useProject())

  const isProjectPublic = computed(() => {
    if (typeof project.value?.meta === 'string') {
      const meta = JSON.parse(project.value?.meta)
      return meta.isPublic
    }

    return (project.value?.meta as any)?.isPublic
  })

  const formStatus = ref<
    | 'collaborate'
    | 'project-collaborateSaving'
    | 'project-collaborateSaved'
    | 'manageCollaborators'
    | 'project-collaborate'
    | 'project-public'
    | 'none'
  >('none')
  const invitationValid = ref(false)
  const isInvitationLinkCopied = ref(false)

  const showShareModal = ref(false)

  const invitationUsersData = ref<Users>({ emails: undefined, role: ProjectRole.Viewer, invitationToken: undefined })

  watch(
    [isProjectPublic],
    () => {
      visibility.value = isProjectPublic.value ? 'public' : 'private'
    },
    { immediate: true, deep: true },
  )

  const resetData = () => {
    formStatus.value = 'project-collaborate'
    invitationValid.value = false
    invitationUsersData.value = { emails: undefined, role: ProjectRole.Viewer, invitationToken: undefined }
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
