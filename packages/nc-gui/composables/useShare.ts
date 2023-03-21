import { storeToRefs } from 'pinia'
import type { Users } from '~~/lib'
import { ProjectRole } from '~~/lib'

const [setup, use] = useInjectionState(() => {
  const visibility = ref<'public' | 'private' | 'none' | 'hidden'>('none')
  const { project } = storeToRefs(useProject())
  const { openedPage, isEditAllowed } = storeToRefs(useDocStore())

  const isProjectPublic = computed(() => {
    if (typeof project.value?.meta === 'string') {
      const meta = JSON.parse(project.value.meta)
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

  const showShareModal = ref(false)

  const invitationUsersData = ref<Users>({ emails: undefined, role: ProjectRole.Viewer, invitationToken: undefined })

  watch(
    [openedPage, isEditAllowed, isProjectPublic],
    () => {
      if (!isEditAllowed.value) {
        visibility.value = 'hidden'
        return
      }

      if (!openedPage.value && !isProjectPublic.value) {
        visibility.value = 'none'
        return
      }

      visibility.value = openedPage.value?.is_published || isProjectPublic.value ? 'public' : 'private'
    },
    { immediate: true, deep: true },
  )

  return {
    visibility,
    showShareModal,
    formStatus,
    invitationValid,
    invitationUsersData,
  }
}, 'useShare')

export const provideShare = setup

export function useShare() {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}
