import type { RequestParams } from 'nocodb-sdk'
import { storeToRefs } from 'pinia'
import type { User } from '~/lib'

const [setup, use] = useInjectionState(() => {
  const { api } = useApi()
  const { project } = storeToRefs(useProject())
  const { t } = useI18n()
  const { $e } = useNuxtApp()
  const { formStatus, invitationUsersData } = useShare()

  const currentPage = ref(1)
  const currentLimit = ref(10)
  const searchText = ref<string>('')
  const users = ref<null | User[]>(null)
  const lastFetchedUsers = ref<null | User[]>(null)
  const totalUsers = ref(0)
  const isBatchUpdating = ref(false)
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

      const removedUser = response.users.list.filter((u: User) => !u.roles)

      totalUsers.value = (response.users.pageInfo.totalRows ?? 0) - Number(removedUser?.length)

      if (!users.value) users.value = response.users.list.filter((u: User) => u.roles) as User[]
      else {
        users.value = [...users.value, ...(response.users.list.filter((u: User) => u.roles) as User[])]
      }

      lastFetchedUsers.value = JSON.parse(JSON.stringify(users.value))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const inviteUser = async (user: Partial<User>) => {
    formStatus.value = 'project-collaborateSaving'
    try {
      if (!project.value?.id) return

      const res = await api.auth.projectUserAdd(project.value.id, {
        ...user,
        project_id: project.value!.id!,
        projectName: project.value.title,
      } as any)

      invitationUsersData.value.invitationToken = (res as any).invite_token

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

    formStatus.value = 'project-collaborateSaved'
    $e('a:user:add')
  }

  const updateEditedUsers = async (_editedUsers?: User[]) => {
    _editedUsers = _editedUsers || editedUsers.value
    isBatchUpdating.value = true
    try {
      await Promise.all(
        _editedUsers
          .filter((user) => user.roles !== 'No access')
          .map(async (user) => {
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
      await Promise.all(
        _editedUsers
          .filter((user) => user.roles === 'No access')
          .map(async (user) => {
            await api.auth.projectUserRemove(project.value!.id!, user.id)
          }),
      )
      users.value = users.value?.filter((user) => user.roles !== 'No access') ?? []
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
