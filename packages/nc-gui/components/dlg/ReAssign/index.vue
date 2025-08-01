<script lang="ts" setup>
import { ProjectRoles, ViewLockType } from 'nocodb-sdk'
import UserItem from './UserItem.vue'
const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { loadUsers, users } = useManageUsers()

interface Props {
  modelValue: boolean
  view?: Record<string, any>
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
}

const vModel = useVModel(props, 'modelValue', emits)

onMounted(async () => {
  if (!users.value) {
    await loadUsers()
  }
})

const basesStore = useBases()
const viewsStore = useViewsStore()

const { basesUser } = storeToRefs(basesStore)

const searchQuery = ref('')
const selectedUser = ref()
const userSelectMenu = ref(false)

const isPersonalView = computed(() => props.view?.lock_type === ViewLockType.Personal)

const currentOwner = computed(() => {
  return (
    (props.view && basesUser.value.get(props.view.base_id)?.find((u) => u.id === props.view.owned_by)) || {
      id: props.view.owned_by,
      display_name: 'Unknown User',
    }
  )
})

const filterdBaseUsers = computed(() => {
  let users = props.view.base_id ? basesUser.value.get(props.view.base_id) || [] : []
  if (searchQuery.value) {
    const keyword = searchQuery.value.toLowerCase()
    users = users.filter((u) => {
      return u.display_name?.toLowerCase().includes(keyword) || u.email.toLowerCase().includes(keyword)
    })
  }

  // exclude current owner from the list
  return users.filter((u) => {
    const restrictAccessTo = u.roles !== ProjectRoles.NO_ACCESS && u.roles !== ProjectRoles.VIEWER

    if (isPersonalView.value) {
      return u.id !== currentOwner.value?.id && restrictAccessTo
    }

    return restrictAccessTo
  })
})

const { api, isLoading } = useApi()

const assignView = async () => {
  try {
    if (!selectedUser.value) return
    await api.dbView.update(props.view.id, {
      owned_by: selectedUser.value.id,
      ...(!isPersonalView.value ? { lock_type: ViewLockType.Personal } : {}),
    })
    vModel.value = false
    message.success(isPersonalView.value ? 'View reassigned successfully' : 'View assigned as personal view successfully')

    viewsStore
      .loadViews({
        ignoreLoading: true,
        tableId: props.view.fk_model_id,
        force: true,
      })
      .catch(() => {
        // ignore
      })
  } catch (e) {
    await message.error(await extractSdkResponseErrorMsg(e))
  }
}

const selectUser = (user) => {
  selectedUser.value = user
  userSelectMenu.value = false
}

const inputEl = (el: HTMLInputElement) => {
  setTimeout(() => el?.focus(), 100)
}
</script>

<template>
  <NcModal v-model:visible="vModel" wrap-class-name="nc-modal-re-assign" width="448px">
    <div class="mb-5">
      <div class="flex text-base font-bold mb-2 text-nc-content-gray-emphasis">
        {{ isPersonalView ? $t('labels.reAssignThisView') : $t('labels.assignAsPersonalView') }}
      </div>
      <div class="flex text-sm text-nc-content-gray-subtle">
        {{ isPersonalView ? $t('title.reAssignViewModalSubtitle') : $t('title.assignAsPersonalViewModalSubtitle') }}
      </div>
    </div>

    <div v-if="isPersonalView" class="mb-5">
      <div class="mb-2 text-nc-content-gray">{{ $t('labels.currentOwner') }}</div>
      <UserItem :user="currentOwner" class="bg-nc-bg-gray-light rounded-lg px-4" />
    </div>
    <div class="mb-5">
      <div class="mb-2 text-nc-content-gray">{{ isPersonalView ? $t('labels.newOwner') : $t('labels.selectOwner') }}</div>
      <div
        class="rounded-lg border-1"
        :class="{
          'shadow-sm': selectedUser && !userSelectMenu,
        }"
      >
        <UserItem
          v-if="selectedUser && !userSelectMenu"
          :user="selectedUser"
          class="cursor-pointer px-3"
          @click="userSelectMenu = true"
        >
          <template #append>
            <GeneralIcon icon="arrowDown" class="text-gray-500" />
          </template>
        </UserItem>

        <div v-else class="flex flex-row items-center h-12.5 p-2 nc-list-user-item">
          <GeneralIcon icon="search" class="text-nc-content-gray-muted ml-3 flex-none" />
          <input
            :ref="inputEl"
            v-model="searchQuery"
            placeholder="Search User to assign..."
            class="border-0 px-2 outline-none nc-search-input flex-1"
          />
        </div>

        <div v-if="!selectedUser || userSelectMenu" class="max-h-65 overflow-auto nc-scrollbar-thin">
          <UserItem
            v-for="user of filterdBaseUsers"
            :key="user.id"
            class="cursor-pointer hover:(bg-gray-100) px-3 nc-list-user-item"
            :class="{ 'bg-gray-100': selectedUser === user }"
            :user="user"
            @click="selectUser(user)"
          >
          </UserItem>
        </div>

        <div v-if="!filterdBaseUsers?.length" class="h-25 p-2 text-gray-400 text-sm flex items-center justify-center">
          {{ $t('placeholder.noBaseUsersFound') }}
        </div>
      </div>
    </div>

    <div class="flex justify-end">
      <div class="flex gap-2">
        <NcButton size="small" type="secondary" @click="vModel = false"> {{ $t('labels.cancel') }} </NcButton>
        <NcButton
          size="small"
          type="primary"
          class="nc-invite-btn"
          :disabled="!selectedUser"
          :loading="isLoading"
          @click="assignView"
        >
          {{ $t('activity.assignView') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.nc-modal-re-assign {
  .nc-search-input::placeholder {
    @apply text-gray-400;
  }

  .nc-list-user-item:not(:last-of-type) {
    border-bottom: 1px solid;
    border-color: inherit;
  }
}
</style>
