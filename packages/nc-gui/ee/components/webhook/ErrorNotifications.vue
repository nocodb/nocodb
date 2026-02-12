<script setup lang="ts">
import type { UserType } from 'nocodb-sdk'

const props = defineProps<{
  hookId: string
}>()

const { api } = useApi()

const baseStore = useBases()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { activeProjectId, basesUser } = storeToRefs(baseStore)

const isLoading = ref(false)
const isSaving = ref(false)
const showAddModal = ref(false)

interface Subscriber {
  id: string
  fk_user_id: string
  email: string | null
  display_name: string | null
}

const subscribers = ref<Subscriber[]>([])

const baseUsers = computed(() => {
  return basesUser.value.get(activeProjectId.value!) || []
})

const subscriberUserIds = computed(() => new Set(subscribers.value.map((s) => s.fk_user_id)))

const availableUsers = computed(() => {
  return baseUsers.value.filter((user) => !subscriberUserIds.value.has(user.id))
})

const selectedUserIds = ref<string[]>([])

async function loadSubscribers() {
  if (!activeWorkspaceId.value || !activeProjectId.value || !props.hookId) return

  isLoading.value = true
  try {
    const response = await api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
      operation: 'hookListSubscribers',
      hookId: props.hookId,
    })
    subscribers.value = response || []
  } catch (e) {
    console.error('Failed to load subscribers:', e)
  } finally {
    isLoading.value = false
  }
}

async function addSubscribers() {
  if (!activeWorkspaceId.value || !activeProjectId.value || !props.hookId) return
  if (selectedUserIds.value.length === 0) return

  isSaving.value = true
  try {
    await api.internal.postOperation(
      activeWorkspaceId.value,
      activeProjectId.value,
      { operation: 'hookAddSubscribers' },
      {
        hookId: props.hookId,
        userIds: selectedUserIds.value,
      },
    )
    message.success(`${selectedUserIds.value.length} user(s) added to notifications`)
    showAddModal.value = false
    selectedUserIds.value = []
    await loadSubscribers()
  } catch (e) {
    console.error('Failed to add subscribers:', e)
    message.error('Failed to add subscribers')
  } finally {
    isSaving.value = false
  }
}

async function removeSubscriber(subscriberId: string) {
  if (!activeWorkspaceId.value || !activeProjectId.value || !props.hookId) return

  try {
    await api.internal.postOperation(
      activeWorkspaceId.value,
      activeProjectId.value,
      { operation: 'hookRemoveSubscriber' },
      {
        hookId: props.hookId,
        subscriberId,
      },
    )
    message.success('User removed from notifications')
    await loadSubscribers()
  } catch (e) {
    console.error('Failed to remove subscriber:', e)
    message.error('Failed to remove subscriber')
  }
}

function toggleUser(userId: string) {
  if (selectedUserIds.value.includes(userId)) {
    selectedUserIds.value = selectedUserIds.value.filter((id) => id !== userId)
  } else {
    selectedUserIds.value.push(userId)
  }
}

function handleUpdateValue(option: any) {
  toggleUser(option.id)
}

function filterOption(input: string, option: any) {
  return antSelectFilterOption(input, option, ['email', 'display_name'])
}

function openAddModal() {
  selectedUserIds.value = []
  showAddModal.value = true
}

onMounted(() => {
  loadSubscribers()
})

watch(
  () => props.hookId,
  () => {
    loadSubscribers()
  },
)
</script>

<template>
  <div class="flex flex-col h-full bg-nc-bg-default">
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-[640px] min-w-[564px] w-full mx-auto">
        <div class="mb-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="text-subHeading2 text-nc-content-gray-emphasis">Error Notifications</div>
              <div class="text-bodyDefaultSm text-nc-content-gray-subtle mt-1">
                Users who will receive email notifications when this webhook fails
              </div>
            </div>
            <NcButton type="secondary" size="small" @click="openAddModal">
              <GeneralIcon icon="plus" class="mr-1" />
              Add User
            </NcButton>
          </div>

          <div v-if="isLoading" class="flex items-center justify-center py-8">
            <a-spin size="default" />
          </div>

          <div v-else-if="subscribers.length === 0" class="border border-nc-border-gray-medium rounded-lg p-6 text-center">
            <GeneralIcon icon="mail" class="w-8 h-8 text-nc-content-gray-muted mb-3" />
            <div class="text-body text-nc-content-gray-subtle">No users subscribed to error notifications</div>
            <NcButton type="secondary" size="small" class="mt-4" @click="openAddModal">
              <GeneralIcon icon="plus" class="mr-1" />
              Add User
            </NcButton>
          </div>

          <div v-else class="border border-nc-border-gray-medium rounded-lg overflow-hidden">
            <div
              v-for="subscriber in subscribers"
              :key="subscriber.id"
              class="flex items-center justify-between p-3 border-b border-nc-border-gray-medium last:border-b-0 hover:bg-nc-bg-gray-light"
            >
              <NcUserInfo v-if="subscriber.email" :user="subscriber" class="flex-1" />
              <div v-else class="flex-1 text-nc-content-gray-subtle">Unknown user</div>
              <NcButton type="text" size="xs" class="!text-nc-content-red-dark" @click="removeSubscriber(subscriber.id)">
                <GeneralIcon icon="delete" />
              </NcButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <GeneralModal
      v-model:visible="showAddModal"
      :mask-closable="false"
      :keyboard="!isSaving"
      wrap-class-name="nc-modal-add-hook-subscribers"
      :footer="null"
      class="!w-[448px]"
      :closable="false"
      @keydown.esc="showAddModal = false"
    >
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="text-subHeading2 text-nc-content-gray-emphasis">Add Users to Notifications</div>
        </div>

        <div class="text-body text-nc-content-gray-subtle mb-5">
          Select users who will receive email notifications when this webhook fails.
        </div>

        <NcList
          :open="showAddModal"
          :value="selectedUserIds"
          :list="availableUsers"
          option-label-key="email"
          option-value-key="id"
          :item-height="52"
          search-input-placeholder="Search user"
          is-multi-select
          class="!w-auto border-1 border-nc-border-gray-medium rounded-lg max-h-80"
          :filter-option="filterOption"
          empty-description="No users available"
          @change="handleUpdateValue($event)"
        >
          <template #listItemExtraLeft="{ isSelected }">
            <NcCheckbox :checked="isSelected" />
          </template>

          <template #listItemContent="{ option }">
            <NcUserInfo :user="option as UserType" class="w-[calc(100%_-_24px)]" />
          </template>
          <template #listItemExtraRight="{ option }">
            <div class="flex items-center gap-1">
              <RolesBadge :border="false" :role="option.roles" icon-only nc-badge-class="!px-1" show-tooltip>
                <template #tooltip="{ label }">
                  {{ $t('tooltip.basePermissionRole', { role: $t(`objects.roleType.${label}`) }) }}
                </template>
              </RolesBadge>
            </div>
          </template>
          <template #listItemSelectedIcon> <NcSpanHidden /> </template>
        </NcList>

        <div class="flex items-center justify-between pt-4">
          <div v-if="selectedUserIds.length" class="text-nc-content-gray-muted">
            {{ selectedUserIds.length }} user{{ selectedUserIds.length > 1 ? 's' : '' }} selected
          </div>
          <div v-else>&nbsp;</div>
          <div class="flex gap-2">
            <NcButton type="secondary" size="small" :disabled="isSaving" @click="showAddModal = false"> Cancel </NcButton>
            <NcButton
              type="primary"
              size="small"
              :loading="isSaving"
              :disabled="isSaving || selectedUserIds.length === 0"
              @click="addSubscribers"
            >
              Add {{ selectedUserIds.length > 1 ? 'Users' : 'User' }}
            </NcButton>
          </div>
        </div>
      </div>
    </GeneralModal>
  </div>
</template>

<style lang="scss">
.nc-modal-add-hook-subscribers {
  z-index: 1060;
}
</style>
