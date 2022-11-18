<script setup lang="ts">
import { OrgUserRoles } from 'nocodb-sdk'
import type { RequestParams } from 'nocodb-sdk'
import {
  extractSdkResponseErrorMsg,
  message,
  onBeforeMount,
  projectRoleTagColors,
  ref,
  useApi,
  useCopy,
  useDashboard,
  useI18n,
  useNuxtApp,
  useProject,
  useUIPermission,
  watchDebounced,
} from '#imports'
import type { User } from '~/lib'

const { t } = useI18n()

const { $e } = useNuxtApp()

const { api } = useApi()

const { project } = useProject()

const { copy } = useCopy()

const { isUIAllowed } = useUIPermission()

const { dashboardUrl } = $(useDashboard())

let users = $ref<null | User[]>(null)

let selectedUser = $ref<null | User>(null)

let showUserModal = $ref(false)

let showUserDeleteModal = $ref(false)

let isLoading = $ref(false)

let totalRows = $ref(0)

const currentPage = $ref(1)

const currentLimit = $ref(10)

const searchText = ref<string>('')

const loadUsers = async (page = currentPage, limit = currentLimit) => {
  try {
    if (!project.value?.id) return

    // TODO: Types of api is not correct
    const response: any = await api.auth.projectUserList(project.value?.id, {
      query: {
        limit,
        offset: searchText.value.length === 0 ? (page - 1) * limit : 0,
        query: searchText.value,
      },
    } as RequestParams)
    if (!response.users) return

    totalRows = response.users.pageInfo.totalRows ?? 0

    users = response.users.list as User[]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const inviteUser = async (user: User) => {
  try {
    if (!project.value?.id) return

    await api.auth.projectUserAdd(project.value.id, user)

    // Successfully added user to project
    message.success(t('msg.success.userAddedToProject'))
    await loadUsers()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:user:add')
}

const deleteUser = async () => {
  try {
    if (!project.value?.id || !selectedUser?.id) return

    await api.auth.projectUserRemove(project.value.id, selectedUser.id)

    // Successfully deleted user from project
    message.success(t('msg.success.userDeletedFromProject'))

    await loadUsers()

    showUserDeleteModal = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    showUserDeleteModal = false
  }

  $e('a:user:delete')
}

const onEdit = (user: User) => {
  selectedUser = user
  showUserModal = true
}

const onInvite = () => {
  selectedUser = null
  showUserModal = true
}

const onDelete = (user: User) => {
  selectedUser = user
  showUserDeleteModal = true
}

const resendInvite = async (user: User) => {
  if (!project.value?.id) return

  try {
    await api.auth.projectUserResendInvite(project.value.id, user.id)

    // Invite email sent successfully
    message.success(t('msg.success.inviteEmailSent'))
    await loadUsers()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:user:resend-invite')
}

const copyInviteUrl = (user: User) => {
  if (!user.invite_token) return

  copy(`${dashboardUrl}#/signup/${user.invite_token}`)

  // Invite URL copied to clipboard
  message.success(t('msg.success.inviteURLCopied'))
  $e('c:user:copy-url')
}

onBeforeMount(async () => {
  if (!users) {
    isLoading = true

    await loadUsers()

    isLoading = false
  }
})

watchDebounced(searchText, () => loadUsers(), { debounce: 300, maxWait: 600 })

const isSuperAdmin = (user: { main_roles?: string }) => {
  return user.main_roles?.split(',').includes(OrgUserRoles.SUPER_ADMIN)
}
</script>

<template>
  <div v-if="isLoading" class="h-full w-full flex items-center justify-center">
    <a-spin size="large" />
  </div>

  <div v-else class="flex flex-col w-full px-6">
    <LazyTabsAuthUserManagementUsersModal
      :key="showUserModal"
      :show="showUserModal"
      :selected-user="selectedUser"
      @closed="showUserModal = false"
      @reload="loadUsers()"
    />

    <a-modal
      v-model:visible="showUserDeleteModal"
      :closable="false"
      width="28rem"
      centered
      :footer="null"
      wrap-class-name="nc-modal-delete-user"
    >
      <div class="flex flex-col h-full">
        <div class="flex flex-row justify-center mt-2 text-center w-full text-base">
          This action will remove this user from this project
        </div>
        <div class="flex mt-6 justify-center space-x-2">
          <a-button @click="showUserDeleteModal = false"> {{ $t('general.cancel') }}</a-button>
          <a-button type="primary" danger @click="deleteUser"> {{ $t('general.confirm') }}</a-button>
        </div>
      </div>
    </a-modal>

    <div class="flex flex-row mb-4 mx-4 justify-between pb-2">
      <div class="flex w-1/3">
        <a-input v-model:value="searchText" :placeholder="$t('placeholder.filterByEmail')">
          <template #prefix>
            <IcRoundSearch class="text-gray-400" />
          </template>
        </a-input>
      </div>

      <div class="flex flex-row space-x-1">
        <a-button v-e="['a:user:reload']" size="middle" type="text" @click="loadUsers()">
          <div class="flex flex-row justify-center items-center caption capitalize space-x-1">
            <MdiReload class="text-gray-500" />
            <div class="text-gray-500">{{ $t('general.reload') }}</div>
          </div>
        </a-button>

        <a-button
          v-if="isUIAllowed('newUser')"
          v-e="['c:user:invite']"
          size="middle"
          type="primary"
          ghost
          class="nc-invite-team"
          @click="onInvite"
        >
          <div class="flex flex-row justify-center items-center caption capitalize space-x-1">
            <MdiAccountPlusOutline class="mr-1" />
            <div>{{ $t('activity.inviteTeam') }}</div>
          </div>
        </a-button>
      </div>
    </div>

    <div class="px-5">
      <div class="flex flex-row border-b-1 pb-2 px-2">
        <div class="flex flex-row w-4/6 space-x-1 items-center pl-1">
          <EvaEmailOutline class="flex text-gray-500 -mt-0.5" />

          <div class="text-gray-600 text-xs space-x-1">{{ $t('labels.email') }}</div>
        </div>
        <div class="flex flex-row justify-center w-1/6 space-x-1 items-center pl-1">
          <MdiDramaMasks class="flex text-gray-500 -mt-0.5" />

          <div class="text-gray-600 text-xs">{{ $t('objects.role') }}</div>
        </div>
        <div class="flex flex-row w-1/6 justify-end items-center pl-1">
          <div class="text-gray-600 text-xs">{{ $t('labels.actions') }}</div>
        </div>
      </div>

      <div v-for="(user, index) of users" :key="index" class="flex flex-row items-center border-b-1 py-2 px-2 nc-user-row">
        <div class="flex w-4/6 flex-wrap nc-user-email">
          {{ user.email }}
        </div>

        <div class="flex w-1/6 justify-center flex-wrap ml-4">
          <div
            v-if="isSuperAdmin(user)"
            class="rounded-full px-2 py-1 nc-user-role"
            :style="{ backgroundColor: projectRoleTagColors[OrgUserRoles.SUPER_ADMIN] }"
          >
            Super Admin
          </div>
          <div
            v-if="user.roles"
            class="rounded-full px-2 py-1 nc-user-role"
            :style="{ backgroundColor: projectRoleTagColors[user.roles] }"
          >
            {{ $t(`objects.roleType.${user.roles}`) }}
          </div>
        </div>
        <div class="flex w-1/6 flex-wrap justify-end">
          <template v-if="!isSuperAdmin(user)">
            <a-tooltip v-if="user.project_id" placement="bottom">
              <template #title>
                <span>{{ $t('activity.editUser') }}</span>
              </template>

              <a-button type="text" class="!rounded-md nc-user-edit" @click="onEdit(user)">
                <template #icon>
                  <IcRoundEdit class="flex mx-auto h-[1rem] text-gray-500" />
                </template>
              </a-button>
            </a-tooltip>

            <!--          Add user to project -->
            <a-tooltip v-if="!user.project_id" placement="bottom">
              <template #title>
                <span>{{ $t('activity.addUserToProject') }}</span>
              </template>

              <a-button type="text" class="!rounded-md nc-user-invite" @click="inviteUser(user)">
                <template #icon>
                  <MdiPlus class="flex mx-auto h-[1.1rem] text-gray-500" />
                </template>
              </a-button>
            </a-tooltip>

            <!--          Remove user from the project -->
            <a-tooltip v-else placement="bottom">
              <template #title>
                <span>{{ $t('activity.deleteUser') }}</span>
              </template>

              <a-button v-e="['c:user:delete']" type="text" class="!rounded-md nc-user-delete" @click="onDelete(user)">
                <template #icon>
                  <MdiDeleteOutline class="flex mx-auto h-[1.1rem] text-gray-500" />
                </template>
              </a-button>
            </a-tooltip>

            <a-dropdown :trigger="['click']" class="flex" placement="bottomRight" overlay-class-name="nc-dropdown-user-mgmt">
              <div class="flex flex-row items-center">
                <a-button type="text" class="!px-0">
                  <div class="flex flex-row items-center h-[1.2rem]">
                    <IcBaselineMoreVert />
                  </div>
                </a-button>
              </div>

              <template #overlay>
                <a-menu>
                  <a-menu-item>
                    <!--                  Resend invite Email -->
                    <div class="flex flex-row items-center py-3" @click="resendInvite(user)">
                      <MdiEmailArrowRightOutline class="flex h-[1rem] text-gray-500" />
                      <div class="text-xs pl-2">{{ $t('activity.resendInvite') }}</div>
                    </div>
                  </a-menu-item>
                  <a-menu-item>
                    <div class="flex flex-row items-center py-3" @click="copyInviteUrl(user)">
                      <MdiContentCopy class="flex h-[1rem] text-gray-500" />
                      <div class="text-xs pl-2">{{ $t('activity.copyInviteURL') }}</div>
                    </div>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </template>
        </div>
      </div>

      <a-pagination
        v-model:current="currentPage"
        hide-on-single-page
        class="mt-4"
        :page-size="currentLimit"
        :total="totalRows"
        show-less-items
        @change="loadUsers"
      />

      <LazyTabsAuthUserManagementFeedbackForm />
    </div>
  </div>
</template>
