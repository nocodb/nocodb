import { defineStore } from 'pinia'
import type { Users } from '~~/lib'

export const useShare = defineStore('share', () => {
  const visibility = ref<'public' | 'private' | 'none' | 'hidden'>('none')
  const { project } = useProject()
  const { openedPage, isEditAllowed } = useDocStore()

  const isProjectPublic = computed(() => {
    if (typeof project?.meta === 'string') {
      const meta = JSON.parse(project.meta)
      return meta.isPublic
    }

    return (project?.meta as any)?.isPublic
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

  const showShareModal = ref(false)

  const invitationUsersData = ref<Users>({ emails: undefined, role: ProjectRole.Viewer, invitationToken: undefined })

  watch(
    [openedPage, isEditAllowed, isProjectPublic],
    () => {
      if (!isEditAllowed) {
        visibility.value = 'hidden'
        return
      }

      visibility.value = openedPage?.is_published || isProjectPublic.value ? 'public' : 'private'
    },
    { immediate: true, deep: true },
  )

  return {
    visibility,
    showShareModal,
    formStatus,
    invitationValid,
    invitationUsersData,
    isProjectPublic,
  }
})
