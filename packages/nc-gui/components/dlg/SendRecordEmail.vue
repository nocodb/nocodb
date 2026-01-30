<script lang="ts" setup>
import type { TableType, ViewType } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  meta: TableType
  view?: ViewType
  rowId: string
}>()

const emit = defineEmits(['update:modelValue'])

const { api } = useApi()

const { t } = useI18n()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { activeProjectId } = storeToRefs(useBases())

const { user } = useGlobal()

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const dialogShow = useVModel(props, 'modelValue', emit)

const isLoading = ref(false)

const selectedUserIds = ref<Set<string>>(new Set())

const customMessage = ref('')

const sendCopyToSelf = ref(false)

const searchQuery = ref('')

const baseUsers = computed(() => {
  if (!activeProjectId.value) return []
  return basesUser.value.get(activeProjectId.value) || []
})

const filteredUsers = computed(() => {
  if (!searchQuery.value) return baseUsers.value

  const query = searchQuery.value.toLowerCase()
  return baseUsers.value.filter((u) => u.email?.toLowerCase().includes(query) || u.display_name?.toLowerCase().includes(query))
})

const selectedUsers = computed(() => {
  return baseUsers.value.filter((u) => selectedUserIds.value.has(u.id))
})

const isSendButtonDisabled = computed(() => {
  return selectedUserIds.value.size === 0
})

watch(dialogShow, (newVal) => {
  if (newVal) {
    selectedUserIds.value = new Set()
    customMessage.value = ''
    sendCopyToSelf.value = false
    searchQuery.value = ''
  }
})

const toggleUser = (userId: string) => {
  if (selectedUserIds.value.has(userId)) {
    selectedUserIds.value.delete(userId)
  } else {
    selectedUserIds.value.add(userId)
  }
  selectedUserIds.value = new Set(selectedUserIds.value)
}

const removeUser = (userId: string) => {
  selectedUserIds.value.delete(userId)
  selectedUserIds.value = new Set(selectedUserIds.value)
}

const sendRecord = async () => {
  if (!activeWorkspaceId.value || !activeProjectId.value) return

  try {
    isLoading.value = true

    const emails = selectedUsers.value.map((u) => u.email).filter(Boolean) as string[]

    if (!emails.length) {
      message.error(t('msg.error.atLeastOneEmail'))
      return
    }

    await api.internal.postOperation(
      activeWorkspaceId.value,
      activeProjectId.value,
      {
        operation: 'sendRecordEmail',
      },
      {
        tableId: props.meta.id,
        viewId: props.view?.id,
        rowId: props.rowId,
        emails,
        message: customMessage.value || undefined,
        sendCopyToSelf: sendCopyToSelf.value,
      },
    )

    message.success(t('msg.success.recordSentSuccessfully'))
    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const defaultSubject = computed(() => {
  const displayName = user.value?.display_name || user.value?.email?.split('@')[0] || 'Someone'
  return `${displayName} shared a record from "${props.meta.title}"`
})
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    size="medium"
    class="nc-send-record-email-dlg"
    @keydown.esc="dialogShow = false"
  >
    <template #header>
      <div class="flex flex-row text-2xl font-bold items-center gap-x-2">
        {{ $t('activity.sendRecord') }}
      </div>
    </template>

    <div class="flex flex-col gap-4 mt-2">
      <div class="flex flex-col gap-1.5">
        <label class="text-nc-content-gray text-sm font-medium">{{ $t('labels.to') }}</label>
        <div
          v-if="selectedUsers.length > 0"
          class="flex flex-wrap gap-1.5 p-2 border-1 border-nc-border-gray-medium rounded-lg mb-2"
        >
          <div
            v-for="selectedUser in selectedUsers"
            :key="selectedUser.id"
            class="flex items-center gap-1 bg-nc-bg-gray-light rounded-md px-2 py-1"
          >
            <GeneralUserIcon :user="selectedUser" size="medium" />
            <span class="text-sm text-nc-content-gray capitalize truncate max-w-32">
              {{ extractUserDisplayNameOrEmail(selectedUser) }}
            </span>
            <NcButton type="text" size="xxsmall" class="!p-0" @click="removeUser(selectedUser.id)">
              <GeneralIcon icon="close" class="w-3.5 h-3.5 text-nc-content-gray-subtle2" />
            </NcButton>
          </div>
        </div>

        <div class="border-1 border-nc-border-gray-medium rounded-lg overflow-hidden">
          <div class="p-2 border-b border-nc-border-gray-medium">
            <a-input
              v-model:value="searchQuery"
              :placeholder="$t('placeholder.searchUsers')"
              class="!rounded-lg"
              :disabled="isLoading"
            >
              <template #prefix>
                <GeneralIcon icon="search" class="text-nc-content-gray-muted" />
              </template>
            </a-input>
          </div>

          <div class="max-h-48 overflow-y-auto nc-scrollbar-md">
            <div v-if="filteredUsers.length === 0" class="p-4 text-center text-nc-content-gray-muted text-sm">
              {{ $t('labels.noUsersFound') }}
            </div>
            <div
              v-for="baseUser in filteredUsers"
              :key="baseUser.id"
              class="flex items-center gap-3 px-3 py-2 hover:bg-nc-bg-gray-light cursor-pointer"
              @click="toggleUser(baseUser.id)"
            >
              <NcCheckbox :checked="selectedUserIds.has(baseUser.id)" />
              <GeneralUserIcon :user="baseUser" size="medium" />
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-sm text-nc-content-gray capitalize truncate">
                  {{ extractUserDisplayNameOrEmail(baseUser) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <span class="text-nc-content-gray-subtle2 text-xs">
          {{ $t('msg.info.selectBaseMembers') }}
        </span>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-nc-content-gray text-sm font-medium">{{ $t('labels.subject') }}</label>
        <div class="px-3 py-2 bg-nc-bg-gray-light rounded-lg text-nc-content-gray-subtle text-sm">
          {{ defaultSubject }}
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-nc-content-gray text-sm font-medium">{{ $t('labels.message') }} {{ $t('labels.optional') }}</label>
        <a-textarea
          v-model:value="customMessage"
          :placeholder="$t('placeholder.addPersonalMessage')"
          :rows="3"
          class="!rounded-lg !text-sm"
          :disabled="isLoading"
        />
      </div>

      <div class="flex items-center gap-2">
        <NcCheckbox v-model:checked="sendCopyToSelf" :disabled="isLoading" />
        <span class="text-nc-content-gray text-sm">{{ $t('labels.sendCopyToMyself') }}</span>
      </div>
    </div>

    <div class="flex mt-6 justify-end">
      <div class="flex gap-2">
        <NcButton type="secondary" :disabled="isLoading" size="small" @click="dialogShow = false">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton
          :disabled="isSendButtonDisabled || isLoading"
          :loading="isLoading"
          size="small"
          type="primary"
          class="nc-send-record-btn"
          @click="sendRecord"
        >
          {{ $t('general.send') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
