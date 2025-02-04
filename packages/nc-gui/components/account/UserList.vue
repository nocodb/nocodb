<script lang="ts" setup>
import { OrgUserRoles } from 'nocodb-sdk'
import type { OrgUserReqType, RequestParams, UserType } from 'nocodb-sdk'

const { api, isLoading } = useApi()

// for loading screen
isLoading.value = true

const { $e } = useNuxtApp()

const { t } = useI18n()

const { dashboardUrl } = useDashboard()

const { user: loggedInUser } = useGlobal()

const { copy } = useCopy()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateUserSort } = useUserSorts('Org')

const users = ref<UserType[]>([])

const sortedUsers = computed(() => {
  return handleGetSortedData(users.value, sorts.value) as UserType[]
})

const currentPage = ref(1)

const currentLimit = ref(10)

const showUserModal = ref(false)

const userMadalKey = ref(0)

const isOpen = ref(false)

const searchText = ref<string>('')

const pagination = reactive({
  total: 0,
  pageSize: 10,
  position: ['bottomCenter'],
})

const loadUsers = useDebounceFn(async (page = currentPage.value, limit = currentLimit.value) => {
  currentPage.value = page
  try {
    const response: any = await api.orgUsers.list({
      query: {
        limit,
        offset: searchText.value.length === 0 ? (page - 1) * limit : 0,
        query: searchText.value,
      },
    } as RequestParams)

    if (!response) return

    pagination.total = response.pageInfo.totalRows ?? 0

    pagination.pageSize = 10

    users.value = response.list as UserType[]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}, 500)

onMounted(() => {
  loadUsers()
  loadSorts()
})

const updateRole = async (userId: string, roles: string) => {
  try {
    await api.orgUsers.update(userId, {
      roles,
    } as OrgUserReqType)
    message.success(t('msg.success.roleUpdated'))

    users.value.forEach((user) => {
      if (user.id === userId) {
        user.roles = roles
      }
    })

    $e('a:org-user:role-updated', { role: roles })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const deleteModalInfo = ref<UserType | null>(null)

const deleteUser = async () => {
  try {
    await api.orgUsers.delete(deleteModalInfo.value?.id as string)
    message.success(t('msg.success.userDeleted'))

    await loadUsers()

    if (!users.value.length && currentPage.value !== 1) {
      currentPage.value--
      loadUsers(currentPage.value)
    }
    $e('a:org-user:user-deleted')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    // closing the modal
    isOpen.value = false
    deleteModalInfo.value = null
  }
}

const resendInvite = async (user: UserType) => {
  try {
    await api.orgUsers.resendInvite(user.id)

    // Invite email sent successfully
    message.success(t('msg.success.inviteEmailSent'))
    await loadUsers()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:org-user:resend-invite')
}

const copyInviteUrl = async (user: User) => {
  if (!user.invite_token) return
  try {
    await copy(`${dashboardUrl.value}#/signup/${user.invite_token}`)

    // Invite URL copied to clipboard
    message.success(t('msg.success.inviteURLCopied'))
  } catch (e: any) {
    message.error(e.message)
  }
  $e('c:user:copy-url')
}

const copyPasswordResetUrl = async (user: UserType) => {
  try {
    const { reset_password_url } = await api.orgUsers.generatePasswordResetToken(user.id)

    await copy(reset_password_url!)

    // Invite URL copied to clipboard
    message.success(t('msg.success.passwordResetURLCopied'))
    $e('c:user:copy-url')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const openInviteModal = () => {
  showUserModal.value = true
  userMadalKey.value++
}

const openDeleteModal = (user: UserType) => {
  deleteModalInfo.value = user
  isOpen.value = true
}

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    // Check if value is an empty object
    if (Object.keys(value).length === 0) {
      saveOrUpdateUserSort({})
      return
    }

    const [field, direction] = Object.entries(value)[0]

    saveOrUpdateUserSort({
      field,
      direction,
    })
  },
})

const columns = [
  {
    key: 'email',
    title: t('objects.users'),
    minWidth: 220,
    dataIndex: 'email',
    showOrderBy: true,
  },
  {
    key: 'role',
    title: t('general.access'),
    basis: '30%',
    minWidth: 272,
    dataIndex: 'roles',
    showOrderBy: true,
  },
  {
    key: 'action',
    title: t('labels.actions'),
    width: 110,
    minWidth: 110,
    justify: 'justify-end',
  },
] as NcTableColumnProps[]

const userRoleOptions = [
  {
    title: 'objects.roleType.orgLevelCreator',
    subtitle: 'msg.info.roles.orgCreator',
    value: OrgUserRoles.CREATOR,
  },
  {
    title: 'objects.roleType.orgLevelViewer',
    subtitle: 'msg.info.roles.orgViewer',
    value: OrgUserRoles.VIEWER,
  },
]
</script>

<template>
  <div class="flex flex-col" data-testid="nc-super-user-list">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="users" class="flex-none text-gray-700 h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('title.userManagement') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <div class="h-full">
        <div class="max-w-195 mx-auto h-full">
          <div class="flex gap-4 items-center justify-between">
            <a-input
              v-model:value="searchText"
              class="!max-w-90 !rounded-md"
              :placeholder="$t('title.searchMembers')"
              @change="loadUsers()"
            >
              <template #prefix>
                <PhMagnifyingGlassBold class="!h-3.5 text-gray-500" />
              </template>
            </a-input>
            <div class="flex gap-3 items-center justify-center">
              <component :is="iconMap.reload" class="cursor-pointer" @click="loadUsers(currentPage, currentLimit)" />
              <NcButton data-testid="nc-super-user-invite" size="small" type="primary" @click="openInviteModal">
                <div class="flex items-center gap-1" data-rec="true">
                  <component :is="iconMap.plus" />
                  {{ $t('activity.inviteUser') }}
                </div>
              </NcButton>
            </div>
          </div>
          <NcTable
            v-model:order-by="orderBy"
            :columns="columns"
            :data="sortedUsers"
            :is-data-loading="isLoading"
            class="h-[calc(100%-58px)] max-w-250 mt-6"
          >
            <template #bodyCell="{ column, record: el }">
              <div v-if="column.key === 'email'" class="w-full">
                <NcTooltip v-if="el.display_name" class="truncate max-w-full">
                  <template #title>
                    {{ el.email }}
                  </template>
                  {{ el.display_name }}
                </NcTooltip>

                <NcTooltip v-else class="truncate max-w-full" show-on-truncate-only>
                  <template #title>
                    {{ el.email }}
                  </template>
                  {{ el.email }}
                </NcTooltip>
              </div>
              <template v-if="column.key === 'role'">
                <div v-if="el?.roles?.includes('super')" class="font-weight-bold" data-rec="true">
                  {{ $t('labels.superAdmin') }}
                </div>
                <NcSelect
                  v-else-if="el.id !== loggedInUser?.id"
                  v-show="!isEeUI"
                  v-model:value="el.roles"
                  class="w-55 nc-user-roles"
                  :dropdown-match-select-width="false"
                  dropdown-class-name="max-w-64"
                  @change="updateRole(el.id, el.roles as string)"
                >
                  <a-select-option
                    v-for="(option, idx) of userRoleOptions"
                    :key="idx"
                    class="nc-users-list-role-option"
                    :value="option.value"
                  >
                    <div class="w-full flex items-start gap-1">
                      <div class="flex-1">
                        <NcTooltip show-on-truncate-only class="truncate" data-rec="true">
                          <template #title>
                            {{ $t(option.title) }}
                          </template>
                          {{ $t(option.title) }}
                        </NcTooltip>

                        <div class="nc-select-hide-item text-gray-500 text-xs whitespace-normal" data-rec="true">
                          {{ $t(option.subtitle) }}
                        </div>
                      </div>

                      <GeneralIcon
                        v-if="el.roles === option.value"
                        id="nc-selected-item-icon"
                        icon="check"
                        class="w-4 h-4 text-primary"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>
                <div v-else class="font-weight-bold" data-rec="true">
                  {{ $t(`objects.roleType.orgLevelCreator`) }}
                </div>
              </template>
              <div
                v-if="column.key === 'action'"
                class="flex items-center gap-2"
                :class="{
                  'opacity-0 pointer-events-none': el.roles?.includes('super'),
                }"
              >
                <NcDropdown :trigger="['click']">
                  <NcButton size="xsmall" type="ghost">
                    <MdiDotsVertical
                      class="text-gray-600 h-5.5 w-5.5 rounded outline-0 p-0.5 nc-workspace-menu transform transition-transform !text-gray-400 cursor-pointer hover:(!text-gray-500 bg-gray-100)"
                    />
                  </NcButton>

                  <template #overlay>
                    <NcMenu variant="small">
                      <template v-if="!el.roles?.includes('super')">
                        <!-- Resend invite Email -->
                        <NcMenuItem @click="resendInvite(el)">
                          <component :is="iconMap.email" class="flex text-gray-600" />
                          <div data-rec="true">{{ $t('activity.resendInvite') }}</div>
                        </NcMenuItem>
                        <NcMenuItem @click="copyInviteUrl(el)">
                          <component :is="iconMap.copy" class="flex text-gray-600" />
                          <div data-rec="true">{{ $t('activity.copyInviteURL') }}</div>
                        </NcMenuItem>
                        <NcMenuItem @click="copyPasswordResetUrl(el)">
                          <component :is="iconMap.copy" class="flex text-gray-600" />
                          <div>{{ $t('activity.copyPasswordResetURL') }}</div>
                        </NcMenuItem>
                      </template>
                      <template v-if="el.id !== loggedInUser?.id">
                        <NcDivider v-if="!el.roles?.includes('super')" />
                        <NcMenuItem data-rec="true" class="!text-red-500 !hover:bg-red-50" @click="openDeleteModal(el)">
                          <MaterialSymbolsDeleteOutlineRounded />
                          {{ $t('general.remove') }} {{ $t('objects.user') }}
                        </NcMenuItem>
                      </template>
                    </NcMenu>
                  </template>
                </NcDropdown>
              </div>
            </template>
            <template #extraRow>
              <div
                v-if="pagination.total === 1 && sortedUsers.length === 1"
                class="w-full pt-12 pb-4 px-2 flex flex-col items-center gap-6 text-center"
              >
                <div class="text-2xl text-gray-800 font-bold">
                  {{ $t('placeholder.inviteYourTeam') }}
                </div>
                <div class="text-sm text-gray-700">
                  {{ $t('placeholder.inviteYourTeamLabel') }}
                </div>
                <img src="~assets/img/placeholder/invite-team.png" class="!w-[30rem] flex-none" />
              </div>
            </template>

            <template #tableFooter>
              <div v-if="pagination.total > 10" class="px-4 py-2 flex items-center justify-center">
                <a-pagination
                  v-model:current="currentPage"
                  :total="pagination.total"
                  show-less-items
                  @change="loadUsers(currentPage, currentLimit)"
                />
              </div>
            </template>
          </NcTable>

          <GeneralDeleteModal v-model:visible="isOpen" entity-name="User" :on-delete="() => deleteUser()">
            <template #entity-preview>
              <span>
                <div class="flex flex-row items-center py-2.25 px-2.5 bg-gray-50 rounded-lg text-gray-700 mb-4">
                  <GeneralIcon icon="account" class="nc-view-icon"></GeneralIcon>
                  <div
                    class="text-ellipsis overflow-hidden select-none w-full pl-1.75"
                    :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
                  >
                    {{ deleteModalInfo?.email }}
                  </div>
                </div>
              </span>
            </template>
          </GeneralDeleteModal>

          <LazyAccountUsersModal :key="userMadalKey" :show="showUserModal" @closed="showUserModal = false" @reload="loadUsers" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user:last-child {
  @apply rounded-b-md;
}
</style>
