<script setup lang="ts">
import { useClipboard, watchDebounced } from '@vueuse/core'
import { useToast } from 'vue-toastification'
import UsersModal from './user-management/UsersModal.vue'
import FeedbackForm from './user-management/FeedbackForm.vue'
import KebabIcon from '~icons/ic/baseline-more-vert'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { projectRoleTagColors } from '~/utils/userUtils'
import MidAccountIcon from '~icons/mdi/account-outline'
import ReloadIcon from '~icons/mdi/reload'
import MdiEditIcon from '~icons/ic/round-edit'
import SearchIcon from '~icons/ic/round-search'
import MdiDeleteOutlineIcon from '~icons/mdi/delete-outline'
import EmailIcon from '~icons/eva/email-outline'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiContentCopyIcon from '~icons/mdi/content-copy'
import MdiEmailSendIcon from '~icons/mdi/email-arrow-right-outline'
import RolesIcon from '~icons/mdi/drama-masks'
import type { User } from '~/lib/types'
const toast = useToast()

const { $api, $e } = useNuxtApp()
const { project } = useProject()
const { copy } = useClipboard()
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
    const response = await $api.auth.projectUserList(project.value?.id, {
      query: {
        limit,
        offset: searchText.value.length === 0 ? (page - 1) * limit : 0,
        query: searchText.value,
      },
    })
    if (!response.users) return

    totalRows = response.users.pageInfo.totalRows ?? 0
    users = response.users.list as User[]
  } catch (e: any) {
    console.error(e)
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}

const inviteUser = async (user: User) => {
  try {
    if (!project.value?.id) return

    await $api.auth.projectUserAdd(project.value.id, user)
    toast.success('Successfully added user to project')
    await loadUsers()
  } catch (e: any) {
    console.error(e)
    toast.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:user:add')
}

const deleteUser = async () => {
  try {
    if (!project.value?.id || !selectedUser?.id) return

    await $api.auth.projectUserRemove(project.value.id, selectedUser.id)
    toast.success('Successfully deleted user from project')
    await loadUsers()
    showUserDeleteModal = false
  } catch (e: any) {
    showUserDeleteModal = false
    console.error(e)
    toast.error(await extractSdkResponseErrorMsg(e))
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
    await $api.auth.projectUserResendInvite(project.value.id, user.id)
    toast.success('Invite email sent successfully')
    await loadUsers()
  } catch (e: any) {
    console.error(e)
    toast.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:user:resend-invite')
}

const copyInviteUrl = (user: User) => {
  if (!user.invite_token) return

  const getInviteUrl = (token: string) => `${dashboardUrl}/user/authentication/signup/${token}`

  copy(getInviteUrl(user.invite_token))
  toast.success('Invite url copied to clipboard')
}

onMounted(async () => {
  if (!users) {
    isLoading = true
    try {
      await loadUsers()
    } finally {
      isLoading = false
    }
  }
})

watchDebounced(searchText, () => loadUsers(), { debounce: 300, maxWait: 600 })
</script>

<template>
  <div v-if="isLoading" class="h-full w-full flex flex-row justify-center mt-42">
    <a-spin size="large" />
  </div>
  <div v-else class="flex flex-col w-full px-6">
    <UsersModal
      :key="showUserModal"
      :show="showUserModal"
      :selected-user="selectedUser"
      @closed="showUserModal = false"
      @reload="loadUsers()"
    />
    <a-modal v-model:visible="showUserDeleteModal" :closable="false" width="28rem" centered :footer="null">
      <div class="flex flex-col h-full">
        <div class="flex flex-row justify-center mt-2 text-center w-full text-base">
          This action will remove this user from this project
        </div>
        <div class="flex mt-6 justify-center space-x-2">
          <a-button @click="showUserDeleteModal = false"> {{ $t('general.cancel') }} </a-button>
          <a-button type="primary" danger @click="deleteUser"> {{ $t('general.confirm') }} </a-button>
        </div>
      </div>
    </a-modal>
    <div class="flex flex-row mb-4 mx-4 justify-between">
      <div class="flex w-1/3">
        <a-input v-model:value="searchText" placeholder="Filter by email">
          <template #prefix>
            <SearchIcon class="text-gray-400" />
          </template>
        </a-input>
      </div>

      <div class="flex flex-row space-x-1">
        <a-button size="middle" type="text" @click="loadUsers()">
          <div class="flex flex-row justify-center items-center caption capitalize space-x-1">
            <ReloadIcon class="text-gray-500" />
            <div class="text-gray-500">Reload</div>
          </div>
        </a-button>
        <a-button v-if="isUIAllowed('newUser')" size="middle" @click="onInvite">
          <div class="flex flex-row justify-center items-center caption capitalize space-x-1">
            <MidAccountIcon />
            <div>{{ $t('activity.inviteTeam') }}</div>
          </div>
        </a-button>
      </div>
    </div>
    <div class="px-5">
      <div class="flex flex-row border-b-1 pb-2 px-2">
        <div class="flex flex-row w-4/6 space-x-1 items-center pl-1">
          <EmailIcon class="flex text-gray-500 -mt-0.5" />

          <div class="text-gray-600 text-xs space-x-1">{{ $t('labels.email') }}</div>
        </div>
        <div class="flex flex-row justify-center w-1/6 space-x-1 items-center pl-1">
          <RolesIcon class="flex text-gray-500 -mt-0.5" />

          <div class="text-gray-600 text-xs">{{ $t('objects.role') }}</div>
        </div>
        <div class="flex flex-row w-1/6 justify-end items-center pl-1">
          <div class="text-gray-600 text-xs">{{ $t('labels.actions') }}</div>
        </div>
      </div>

      <div v-for="(user, index) in users" :key="index" class="flex flex-row items-center border-b-1 py-2 px-2">
        <div class="flex w-4/6 flex-wrap">
          {{ user.email }}
        </div>
        <div class="flex w-1/6 justify-center flex-wrap ml-4">
          <div class="rounded-full px-2 py-1" :style="{ backgroundColor: projectRoleTagColors[user.roles as String] }">
            {{ user.roles }}
          </div>
        </div>
        <div class="flex w-1/6 flex-wrap justify-end">
          <a-tooltip v-if="user.project_id" placement="bottom">
            <template #title>
              <span>{{ $t('activity.editUser') }}</span>
            </template>
            <a-button type="text" class="!rounded-md" @click="onEdit(user)">
              <template #icon>
                <MdiEditIcon class="flex mx-auto h-[1rem]" />
              </template>
            </a-button>
          </a-tooltip>
          <a-tooltip v-if="!user.project_id" placement="bottom">
            <template #title>
              <span>Add user to the project</span>
            </template>
            <a-button type="text" class="!rounded-md" @click="inviteUser(user)">
              <template #icon>
                <MdiPlusIcon class="flex mx-auto h-[1.1rem]" />
              </template>
            </a-button>
          </a-tooltip>

          <a-tooltip v-else placement="bottom">
            <template #title>
              <span>Remove user from the project</span>
            </template>
            <a-button type="text" class="!rounded-md" @click="onDelete(user)">
              <template #icon>
                <MdiDeleteOutlineIcon class="flex mx-auto h-[1.1rem]" />
              </template>
            </a-button>
          </a-tooltip>

          <a-dropdown :trigger="['click']" class="flex" placement="bottomRight">
            <div class="flex flex-row items-center">
              <a-button type="text" class="!px-0">
                <div class="flex flex-row items-center h-[1.2rem]">
                  <KebabIcon />
                </div>
              </a-button>
            </div>
            <template #overlay>
              <a-menu>
                <a-menu-item>
                  <div class="flex flex-row items-center py-1" @click="resendInvite(user)">
                    <MdiEmailSendIcon class="flex h-[1rem]" />
                    <div class="text-xs pl-2">Resend invite email</div>
                  </div>
                </a-menu-item>
                <a-menu-item>
                  <div class="flex flex-row items-center py-1" @click="copyInviteUrl(user)">
                    <MdiContentCopyIcon class="flex h-[1rem]" />
                    <div class="text-xs pl-2">{{ $t('activity.copyInviteURL') }}</div>
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
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
      <FeedbackForm />
    </div>
  </div>
</template>

<style scoped>
.users-table {
  /* equally spaced columns in table */
  table-layout: fixed;

  width: 100%;
}
</style>
