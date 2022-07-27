<script setup lang="ts">
import { useDebounce } from '@vueuse/core'
import UsersModal from './userManagement/UsersModal.vue'
import { projectRoleTagColors } from '~/utils/userUtils'
import MidAccountIcon from '~icons/mdi/account-outline'
import ReloadIcon from "~icons/mdi/reload"
import MdiEditIcon from '~icons/ic/round-edit'
import SearchIcon from '~icons/ic/round-search'
import { copyTextToClipboard } from '~/utils/miscUtils'
import MdiDeleteOutlineIcon from '~icons/mdi/delete-outline'
import EmailIcon from '~icons/eva/email-outline'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiContentCopyIcon from '~icons/mdi/content-copy'
import MdiEmailSendIcon from '~icons/mdi/email-arrow-right-outline'
import RolesIcon from '~icons/mdi/drama-masks'
import SendIcon from '~icons/material-symbols/send'
import { User } from '~~/lib/types'
import { useToast } from 'vue-toastification'
const toast = useToast()

const { $api, $e } = useNuxtApp()
const { project } = useProject()

let users = $ref<null | Array<User>>(null)
let selectedUser = $ref<null | User>(null)
let showUserModal = $ref(false)
let showUserDeleteModal = $ref(false)

let totalRows = $ref(0)
const currentPage = $ref(1)
const currentLimit = $ref(10)
const searchText = ref<string>('')
const debouncedSearchText = useDebounce(searchText, 300)

const loadUsers = async (page = currentPage, limit = currentLimit) => {
  try {
    console.log('loadUsers', page, limit)
    if (!project.value?.id) return

    const response = await $api.auth.projectUserList(project.value?.id, <any> {
      query: {
        limit,
        offset: searchText.value.length === 0 ? (page - 1) * limit : 0,
        query: searchText.value,
      },
    })
    console.log('userData', response)
    if (!response.users) return

    totalRows = response.users.pageInfo.totalRows ?? 0
    users = response.users.list as Array<User>
  } catch (e) {
    console.log(e)
  }
}

const inviteUser = async (user) => {
  try {
    if (!project.value?.id) return

    await $api.auth.projectUserAdd(project.id, user);
    toast.success('Successfully added user to project');
    await loadUsers();
  } catch (e) {
    toast.error(e.response.data.msg);
  }

  $e('a:user:add');
}

const deleteUser = async () => {
  try {
    if (!project.value?.id || !selectedUser?.id) return

    await $api.auth.projectUserRemove(project.value.id, selectedUser.id);
    toast.success('Successfully deleted user from project');
    await loadUsers();
  } catch (e) {
    toast.error(e.response.data.msg);
  }

  $e('a:user:delete');
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
  if (!project.value?.id ) return

  try {
    await $api.auth.projectUserResendInvite(project.value.id, user.id);
    toast.success('Invite email sent successfully');
    await loadUsers();
  } catch (e) {
    toast.error(e.response.data.msg);
  }

  $e('a:user:resend-invite');
}

const copyInviteUrl = (user: User) => {
  if(!user.invite_token) return

  const getInviteUrl = (token: string) => `${location.origin}${location.pathname}#/user/authentication/signup/${token}`;

  copyTextToClipboard(getInviteUrl(user.invite_token) );
  toast.success('Invite url copied to clipboard');
}

onMounted(async () => {
  if (!users) {
    await loadUsers()
  }
})

watch(
  () => debouncedSearchText.value,
  () => loadUsers(),
)
</script>

<template>
  <div class="flex flex-col w-full px-6">
    <UsersModal :key="showUserModal" :show="showUserModal" :selected-user="selectedUser" @closed="showUserModal = false" />
      <a-modal v-model:visible="showUserDeleteModal" :closable="false" width="28rem" centered :footer="null">
    <div class="flex flex-col h-full">
      <div class="flex flex-row justify-center mt-2 text-center w-full text-base">
        This action will remove this user from this project
      </div>
      <div class="flex mt-6 justify-center space-x-2">
        <a-button @click="showUserDeleteModal = false"> Cancel </a-button>
        <a-button type="primary" danger @click="deleteUser"> Confirm </a-button>
      </div>
    </div>
  </a-modal>
    <div class="flex flex-row mb-4 mx-4 justify-between">
      <div class="flex w-1/3" >
        <a-input  v-model:value="searchText" placeholder="Filter by email" >
          <template #prefix>
            <SearchIcon class="text-gray-400"/>
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
        <a-button size="middle" @click="onInvite">
          <div class="flex flex-row justify-center items-center caption capitalize space-x-1">
            <MidAccountIcon />
            <div>Invite Team</div>
          </div>
        </a-button>
      </div>
    </div>
    <div class="px-6">
      <div class="flex flex-row border-b-1 pb-2 px-2">
        <div class="flex flex-row w-4/6 space-x-1 items-center pl-1">
          <EmailIcon class="flex text-gray-500 -mt-0.5" />

          <div class="text-gray-600 text-xs space-x-1">E-mail</div>
        </div>
        <div class="flex flex-row justify-center w-1/6 space-x-1 items-center pl-1">
          <RolesIcon class="flex text-gray-500 -mt-0.5" />

          <div class="text-gray-600 text-xs">Role</div>
        </div>
        <div class="flex flex-row w-1/6 justify-end items-center pl-1">
          <div class="text-gray-600 text-xs">Actions</div>
        </div>
      </div>

      <div v-for="(user, index) in users" :key="index" class="flex flex-row items-center border-b-1 py-2 px-2">
        <div class="flex w-4/6 flex-wrap">
          {{ user.email }}
        </div>
        <div class="flex w-1/6 justify-center flex-wrap ml-4">
          <div :class="`rounded-full  px-2 py-1 bg-[${projectRoleTagColors[user.roles]}]`">
            {{ user.roles }}
          </div>
        </div>
        <div class="flex w-1/6 flex-wrap justify-end">
          <a-button v-if="user.project_id" type="text" class="!rounded-md" @click="onEdit(user)">
            <template #icon>
              <MdiEditIcon height="1rem" class="flex mx-auto" />
            </template>
          </a-button>
          <a-button type="text" v-if="!user.project_id" class="!rounded-md " @click="inviteUser(user)">
            <template #icon>
              <MdiPlusIcon height="1.1rem" class="flex mx-auto" />
            </template>
          </a-button>
          <a-button v-else type="text" class="!rounded-md" @click="onDelete(user)">
            <template #icon>
              <MdiDeleteOutlineIcon height="1.1rem"  class="flex mx-auto" />
            </template>
          </a-button>
          <a-button type="text" class="!rounded-md" @click="resendInvite(user)">
            <template #icon>
              <MdiEmailSendIcon height="1.1rem"  class="flex mx-auto" />
            </template>
          </a-button>
          <a-button type="text" class="!rounded-md" @click="copyInviteUrl(user)">
            <template #icon>
              <MdiContentCopyIcon height="1.1rem"  class="flex mx-auto" />
            </template>
          </a-button>
        </div>
      </div>
      <a-pagination
        hideOnSinglePage
        v-model:current="currentPage"
        class="mt-4"
        :page-size="currentLimit"
        :total="totalRows"
        show-less-items
        @change="loadUsers"
      />
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
