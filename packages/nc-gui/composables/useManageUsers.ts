import type { RequestParams } from 'nocodb-sdk'
import { storeToRefs } from 'pinia'
import type { User } from '#imports'

const [setup, use] = useInjectionState(() => {
  const { api } = useApi()
  const { base } = storeToRefs(useBase())
  const { $e } = useNuxtApp()
  const { formStatus, invitationUsersData } = storeToRefs(useShare())

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
      if (!base.value?.id) return

      // TODO: Types of api is not correct
      const response: any = await api.auth.baseUserList(base.value?.id, {
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
    let res
    formStatus.value = 'base-collaborateSaving'
    try {
      if (!base.value?.id) return

      res = await api.auth.baseUserAdd(base.value.id, {
        ...user,
        base_id: base.value!.id!,
        baseName: base.value.title,
      } as any)

      invitationUsersData.value.invitationToken = (res as any).invite_token

      currentPage.value = 1
      users.value = []
      await loadUsers()
      // Successfully added user to base
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      formStatus.value = 'collaborate'
      return
    }

    formStatus.value = 'base-collaborateSaved'
    $e('a:user:add')
    return res
  }

  const updateEditedUsers = async (_editedUsers?: User[]) => {
    _editedUsers = _editedUsers || editedUsers.value
    isBatchUpdating.value = true
    try {
      await Promise.all(
        _editedUsers
          .filter((user) => user.roles !== 'No access')
          .map(async (user) => {
            await api.auth.baseUserUpdate(base.value!.id!, user.id, {
              email: user.email,
              roles: user.roles,
              base_id: base.value.id,
              baseName: base.value.title,
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
            await api.auth.baseUserRemove(base.value!.id!, user.id)
          }),
      )
      users.value = users.value?.filter((user) => user.roles !== 'No access') ?? []
      totalUsers.value = users.value?.length ?? 0
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
