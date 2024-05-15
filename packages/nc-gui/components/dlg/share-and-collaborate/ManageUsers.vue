<script lang="ts" setup>
import InfiniteLoading from 'v3-infinite-loading'

interface Emits {
  (event: 'close', value: boolean): void
}

const emits = defineEmits<Emits>()

const { users, totalUsers, editedUsers, currentPage, loadUsers, updateEditedUsers, isBatchUpdating } = useManageUsers()

const owner = computed(() => users.value?.find((user) => user.roles?.includes('owner')))
const nonOwners = computed(() => users.value?.filter((user) => !user.roles?.includes('owner')) || [])

const goBack = () => {
  emits('close', false)
}

const userNameEmpty = (user: User) => {
  return !user.firstname && !user.lastname
}

const loadListData = async ($state: any) => {
  const prevUsersCount = users.value?.length || 0
  if (users.value?.length === totalUsers.value) {
    $state.complete()
    return
  }
  $state.loading()
  //
  // const oldPagesCount = currentPage.value || 0

  await loadUsers()
  currentPage.value += 1

  if (prevUsersCount === users.value?.length) {
    $state.complete()
    return
  }
  $state.loaded()
}

const rolesTypes = [
  {
    id: 'Creator',
    name: 'Creator',
    value: 'creator',
  },
  {
    id: 'Editor',
    name: 'Editor',
    value: 'editor',
  },
  {
    id: 'Commenter',
    name: 'Commenter',
    value: 'commenter',
  },
  {
    id: 'Viewer',
    name: 'Viewer',
    value: 'viewer',
  },
  {
    id: 'None',
    name: 'Remove',
    value: 'No access',
  },
]
</script>

<template>
  <div class="flex flex-col mx-4 h-112">
    <div class="flex mt-2.5 mb-2.5 border-b-1 border-gray-50 pb-1.5" :style="{ fontWeight: 500 }">Manage Members</div>
    <div class="flex mt-2.5 mb-2.5 text-xs font-bold">Base Owner</div>
    <div v-if="owner" class="flex flex-row px-2 py-2 items-center gap-x-2 border-1 border-gray-100 rounded-md">
      <a-avatar></a-avatar>
      <div class="flex flex-col justify-center">
        <div class="flex" :style="{ fontWeight: 500 }">{{ owner.firstname }} {{ owner.lastname }}</div>
        <div class="flex text-xs" :class="{ 'text-gray-500': !userNameEmpty(owner) }">
          {{ owner.email }}
        </div>
      </div>
    </div>
    <div class="flex flex-grow"></div>
    <div class="flex flex-row mt-4 mb-2 pt-3 border-gray-100 border-t-1 gap-x-3 items-center text-xs">
      <div :style="{ fontWeight: 500 }">People with access</div>
      <div class="bg-gray-50 border-gray-100 border-1 py-0.5 px-1.5 rounded-md" data-testid="nc-manage-user-user-count">
        {{ totalUsers - 1 }} users
      </div>
    </div>
    <div class="flex flex-col mb-2 pr-0.5 h-96 overflow-y-auto users-list border-b-1 border-gray-100">
      <div v-if="nonOwners.length === 0" class="text-xs mt-2">No users have access to this base</div>
      <div
        v-for="user of nonOwners"
        :key="user.id"
        class="flex flex-row mb-1.5 px-2 py-1.5 items-center border-1 border-gray-100 rounded-md justify-between"
        :data-testid="`nc-manage-users-${user.email}`"
      >
        <div class="flex flex-row items-center gap-x-2">
          <a-avatar></a-avatar>
          <div class="flex flex-col justify-center">
            <div class="flex" :style="{ fontWeight: 500 }">{{ user.firstname }} {{ user.lastname }}</div>
            <div class="flex text-xs" :class="{ 'text-gray-500': !userNameEmpty(user) }">
              {{ user.email }}
            </div>
          </div>
        </div>
        <a-select
          v-model:value="user.roles"
          class="flex !rounded-md p-0.5 !bg-white capitalize nc-dropdown-user-role-container !min-w-26"
          dropdown-class-name="nc-dropdown-user-role !rounded-md"
          placeholder="Select role"
          :options="rolesTypes"
        >
          <template #option="option">
            <div
              class="flex flex-row items-center gap-x-2"
              :data-testid="`nc-manage-users-role-${option.id !== 'None' ? option.name : 'Remove'}`"
            >
              <div v-if="option.id !== 'None'" class="flex">{{ option.name }}</div>
              <div v-else class="flex text-red-500" :style="{ fontWeight: 500 }">Remove</div>
            </div>
          </template>
        </a-select>
      </div>
      <InfiniteLoading v-bind="$attrs" @infinite="loadListData">
        <template #spinner>
          <div class="flex flex-row w-full justify-center mt-2">
            <a-spin />
          </div>
        </template>
        <template #complete>
          <span></span>
        </template>
      </InfiniteLoading>
    </div>
    <div class="flex flex-row justify-between pt-3 pb-2">
      <div class="flex flex-row items-center gap-x-2 px-2 rounded-md cursor-pointer hover:bg-gray-50" @click="goBack">
        <MdiArrowLeft />
        <div>Back to Share</div>
      </div>
      <a-button
        type="primary"
        class="!rounded-md"
        :disabled="editedUsers.length === 0"
        :loading="isBatchUpdating"
        data-testid="nc-manage-users-submit"
        @click="() => updateEditedUsers()"
      >
        Save Changes
      </a-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-modal-share-collaborate .ant-select {
  @apply bg-white !important;
}
.users-list {
  &::-webkit-scrollbar {
    width: 3px;
  }

  /* Track */
  &::-webkit-scrollbar-track {
    background: #f6f6f6 !important;
  }

  /* Handle */
  &::-webkit-scrollbar-thumb {
    background: rgb(228, 228, 228);
  }

  /* Handle on hover */
  &::-webkit-scrollbar-thumb:hover {
    background: rgb(194, 194, 194);
  }
}
</style>
