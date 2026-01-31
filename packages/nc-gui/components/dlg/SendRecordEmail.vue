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

const MESSAGE_MAX_LENGTH = 1000

const customSubject = ref('')

watch(dialogShow, (newVal) => {
  if (newVal) {
    selectedUserIds.value = new Set()
    customMessage.value = ''
    sendCopyToSelf.value = false
    searchQuery.value = ''
    const displayName = extractUserDisplayNameOrEmail(user.value) || 'Someone'
    customSubject.value = `${displayName} shared a record from "${props.meta.title}"`
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
        subject: customSubject.value || undefined,
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
      <div class="flex flex-col gap-1">
        <span class="text-lg font-semibold text-nc-content-gray">{{ $t('activity.sendRecord') }}</span>
        <span class="text-sm text-nc-content-gray-subtle">{{ $t('msg.info.shareRecordWithTeam') }}</span>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <label class="text-nc-content-gray text-sm font-medium">{{ $t('labels.to') }}</label>

        <div class="border-1 border-nc-border-gray-medium rounded-lg overflow-hidden">
          <div class="p-2.5 border-b border-nc-border-gray-medium bg-nc-bg-gray-extralight min-h-12">
            <div v-if="selectedUsers.length > 0" class="flex flex-wrap gap-2">
              <div
                v-for="selectedUser in selectedUsers"
                :key="selectedUser.id"
                class="flex items-center gap-1.5 bg-white border-1 border-nc-border-gray-medium rounded-full pl-0.5 pr-1 py-0.5 shadow-xs"
              >
                <GeneralUserIcon :user="selectedUser" size="medium" />
                <span class="text-sm text-nc-content-gray truncate max-w-32">
                  {{ extractUserDisplayNameOrEmail(selectedUser) }}
                </span>
                <NcButton type="text" size="xxsmall" class="!p-0 !w-4 !h-4 !min-w-4" @click.stop="removeUser(selectedUser.id)">
                  <GeneralIcon icon="close" class="w-3 h-3 text-nc-content-gray-subtle2 hover:text-nc-content-gray" />
                </NcButton>
              </div>
            </div>
            <span v-else class="text-sm text-nc-content-gray-muted">
              {{ $t('labels.noRecipientsSelected') }}
            </span>
          </div>
          <div class="p-2 border-b border-nc-border-gray-medium">
            <a-input
              v-model:value="searchQuery"
              :placeholder="$t('placeholder.searchUsers')"
              class="!rounded-lg"
              :disabled="isLoading"
              allow-clear
            >
              <template #prefix>
                <GeneralIcon icon="search" class="text-nc-content-gray-muted" />
              </template>
            </a-input>
          </div>
          <div class="max-h-52 overflow-y-auto nc-scrollbar-md">
            <div v-if="filteredUsers.length === 0" class="p-4 text-center text-nc-content-gray-muted text-sm">
              {{ $t('labels.noUsersFound') }}
            </div>
            <div
              v-for="baseUser in filteredUsers"
              :key="baseUser.id"
              class="flex items-center gap-3 px-3 py-2.5 hover:bg-nc-bg-gray-light cursor-pointer transition-colors"
              @click="toggleUser(baseUser.id)"
            >
              <NcCheckbox :checked="selectedUserIds.has(baseUser.id)" />
              <GeneralUserIcon :user="baseUser" size="medium" />
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-sm text-nc-content-gray font-medium truncate">
                  {{ extractUserDisplayNameOrEmail(baseUser) }}
                </span>
                <span class="text-xs text-nc-content-gray-subtle truncate">
                  {{ baseUser.email }}
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
        <a-input
          v-model:value="customSubject"
          :placeholder="$t('placeholder.enterSubject')"
          class="!rounded-lg"
          :disabled="isLoading"
        />
        <span class="text-nc-content-gray-subtle2 text-xs">
          {{ $t('msg.info.subjectLineNotification') }}
        </span>
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <label class="text-nc-content-gray text-sm font-medium">{{ $t('labels.message') }}</label>
          <span class="text-xs text-nc-content-gray-subtle2"> {{ customMessage.length }}/{{ MESSAGE_MAX_LENGTH }} </span>
        </div>
        <a-textarea
          v-model:value="customMessage"
          :placeholder="$t('placeholder.addPersonalMessage')"
          :rows="3"
          :maxlength="MESSAGE_MAX_LENGTH"
          class="!rounded-lg !text-sm"
          :disabled="isLoading"
        />
      </div>

      <label class="flex items-center gap-2 cursor-pointer select-none">
        <NcCheckbox v-model:checked="sendCopyToSelf" :disabled="isLoading" />
        <span class="text-nc-content-gray text-sm">{{ $t('labels.sendCopyToMyself') }}</span>
      </label>
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
