import type { RequestParams } from 'nocodb-sdk'
import type { User } from '~/lib'
import {storeToRefs} from "pinia";

const [setup, use] = useInjectionState(() => {
  const { api } = useApi()
  const { project } = storeToRefs(useProject())
  const { t } = useI18n()
  const { $e } = useNuxtApp()

  const currentPage = ref(1)
  const currentLimit = ref(10)
  const searchText = ref<string>('')
  const users = ref<null | User[]>(null)
  const lastFetchedUsers = ref<null | User[]>(null)
  const totalUsers = ref(0)
  const isBatchUpdating = ref(false)
  const formStatus = ref<'collaborate' | 'collaborateSaving' | 'collaborateSaved' | 'manageCollaborators' | 'share'>(
    'collaborate',
  )
  // todo: Only tracks roles updates
  const editedUsers = computed(() => {
    if (!users.value || !lastFetchedUsers.value) return []

    return users.value.filter((user) => {
      const lastFetchedUser = lastFetchedUsers.value?.find((u) => u.id === user.id)
      if (!lastFetchedUser) return false

      return user.roles !== lastFetchedUser.roles
    })
  })

  const loadUsers = async (page = currentPage.value, limit = currentLimit.value) => {
    try {
      if (!project.value?.id) return

      // TODO: Types of api is not correct
      const response: any = await api.auth.projectUserList(project.value?.id, {
        query: {
          limit,
          offset: (page - 1) * limit,
          query: searchText.value,
        },
      } as RequestParams)
      if (!response.users) return

      totalUsers.value = response.users.pageInfo.totalRows ?? 0

      if (!users.value) users.value = response.users.list as User[]
      else {
        users.value = [...users.value, ...(response.users.list as User[])]
      }

      lastFetchedUsers.value = JSON.parse(JSON.stringify(users.value))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const inviteUser = async (user: Partial<User>) => {
    formStatus.value = 'collaborateSaving'
    try {
      if (!project.value?.id) return

      await api.auth.projectUserAdd(project.value.id, { ...user, project_id: project.value.id, projectName: project.value.title })

      currentPage.value = 1
      users.value = []
      await loadUsers()
      // Successfully added user to project
      message.success(t('msg.success.userAddedToProject'))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      formStatus.value = 'collaborate'
      return
    }

    formStatus.value = 'collaborateSaved'
    $e('a:user:add')
  }

  const updateEditedUsers = async (_editedUsers?: User[]) => {
    _editedUsers = _editedUsers || editedUsers.value
    isBatchUpdating.value = true
    try {
      await Promise.all(
        _editedUsers.map(async (user) => {
          await api.auth.projectUserUpdate(project.value!.id!, user.id, {
            email: user.email,
            roles: user.roles,
            project_id: project.value.id,
            projectName: project.value.title,
          })
          const savedUser = users.value?.find((u) => u.id === user.id)
          if (savedUser) {
            savedUser.roles = user.roles
          }
        }),
      )
      lastFetchedUsers.value = JSON.parse(JSON.stringify(users.value))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isBatchUpdating.value = false
    }
  }

  return {
    loadUsers,
    inviteUser,
    users,
    totalUsers,
    searchText,
    currentPage,
    currentLimit,
    editedUsers,
    updateEditedUsers,
    isBatchUpdating,
    formStatus,
  }
}, 'useManageUsers')

export const provideManageUsers = setup

export function useManageUsers() {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}
