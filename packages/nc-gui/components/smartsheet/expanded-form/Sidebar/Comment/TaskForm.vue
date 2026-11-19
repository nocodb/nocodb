<script setup lang="ts">
import dayjs from 'dayjs'
import type { CommentTask } from 'nocodb-sdk'

const props = defineProps<{
  task?: CommentTask | null
  users: { id?: string; email?: string; display_name?: string | null; meta?: any }[]
}>()

const emits = defineEmits<{
  (e: 'save', value: { assignee: string; due: string | null }): void
  (e: 'remove'): void
  (e: 'cancel'): void
}>()

const assignee = ref<string | undefined>(props.task?.assignee)

const due = ref<string | null>(props.task?.due ?? null)

const isUserListOpen = ref(false)

const isDateOpen = ref(false)

const userSearch = ref('')

const pageDate = ref(due.value ? dayjs(due.value) : dayjs())

const selectedUser = computed(() => props.users.find((u) => u.id === assignee.value))

const filteredUsers = computed(() =>
  props.users.filter((u) => !userSearch.value.trim() || searchCompare([u.display_name, u.email], userSearch.value.trim())),
)

const selectedDate = computed(() => (due.value ? dayjs(due.value) : null))

function pickUser(id?: string) {
  if (!id) return
  assignee.value = id
  isUserListOpen.value = false
  userSearch.value = ''
}

function pickDate(value: any) {
  due.value = value ? dayjs(value).format('YYYY-MM-DD') : null
  isDateOpen.value = false
}

function save() {
  if (!assignee.value) return
  emits('save', { assignee: assignee.value, due: due.value })
}
</script>

<template>
  <div
    class="nc-comment-task-form flex flex-col gap-2 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-elevated p-2"
    data-testid="nc-comment-task-form"
    @keydown.esc.stop="emits('cancel')"
  >
    <NcDropdown v-model:visible="isUserListOpen" placement="bottomLeft">
      <button
        type="button"
        class="flex h-8 w-full items-center gap-2 rounded-lg border-1 border-nc-border-gray-medium px-2 text-small text-left cursor-pointer hover:bg-nc-bg-gray-light"
        data-testid="nc-comment-task-assignee"
      >
        <GeneralUserIcon v-if="selectedUser" :user="selectedUser" size="small" class="flex-none" />
        <GeneralIcon v-else icon="ncUser" class="flex-none w-4 h-4 text-nc-content-gray-muted" />
        <span class="flex-1 truncate" :class="selectedUser ? 'text-nc-content-gray' : 'text-nc-content-gray-muted'">
          {{ selectedUser ? extractUserDisplayNameOrEmail(selectedUser) : $t('activity.commentThread.selectAssignee') }}
        </span>
        <GeneralIcon icon="chevronDown" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
      </button>

      <template #overlay>
        <div class="w-60 p-1.5 flex flex-col gap-1">
          <a-input
            v-model:value="userSearch"
            :placeholder="$t('placeholder.searchUsers')"
            class="!h-8 !rounded-lg !text-small"
            data-testid="nc-comment-task-assignee-search"
            @keydown.stop
          />
          <div class="max-h-52 nc-scrollbar-thin flex flex-col">
            <button
              v-for="u in filteredUsers"
              :key="u.id"
              type="button"
              class="flex items-center gap-2 rounded-md px-2 py-1.5 text-small text-left cursor-pointer hover:bg-nc-bg-gray-light"
              :data-testid="`nc-comment-task-assignee-${u.email}`"
              @click="pickUser(u.id)"
            >
              <GeneralUserIcon :user="u" size="small" class="flex-none" />
              <span class="flex-1 truncate text-nc-content-gray">{{ extractUserDisplayNameOrEmail(u) }}</span>
              <GeneralIcon v-if="u.id === assignee" icon="check" class="flex-none w-4 h-4 text-nc-content-brand" />
            </button>
            <div v-if="!filteredUsers.length" class="px-2 py-3 text-center text-xs text-nc-content-gray-muted">
              {{ $t('labels.noUsersFound') }}
            </div>
          </div>
        </div>
      </template>
    </NcDropdown>

    <NcDropdown v-model:visible="isDateOpen" placement="bottomLeft">
      <button
        type="button"
        class="flex h-8 w-full items-center gap-2 rounded-lg border-1 border-nc-border-gray-medium px-2 text-small text-left cursor-pointer hover:bg-nc-bg-gray-light"
        data-testid="nc-comment-task-due"
      >
        <GeneralIcon icon="ncCalendar" class="flex-none w-4 h-4 text-nc-content-gray-muted" />
        <span class="flex-1 truncate" :class="due ? 'text-nc-content-gray' : 'text-nc-content-gray-muted'">
          {{ due ? dayjs(due).format('D MMM YYYY') : $t('activity.commentThread.noDueDate') }}
        </span>
        <GeneralIcon
          v-if="due"
          icon="close"
          class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted hover:text-nc-content-gray"
          @click.stop="due = null"
        />
      </button>

      <template #overlay>
        <div class="w-[256px]">
          <NcDatePicker
            v-model:page-date="pageDate"
            :selected-date="selectedDate"
            :is-open="isDateOpen"
            type="date"
            size="medium"
            @update:selected-date="pickDate"
          />
        </div>
      </template>
    </NcDropdown>

    <div class="flex items-center gap-2">
      <NcButton
        v-if="task"
        type="text"
        size="xs"
        class="!text-nc-content-red-medium"
        data-testid="nc-comment-task-remove"
        @click="emits('remove')"
      >
        {{ $t('activity.commentThread.removeTodo') }}
      </NcButton>
      <div class="flex-1" />
      <NcButton type="secondary" size="xs" data-testid="nc-comment-task-cancel" @click="emits('cancel')">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton type="primary" size="xs" :disabled="!assignee" data-testid="nc-comment-task-save" @click="save">
        {{ $t('activity.commentThread.assign') }}
      </NcButton>
    </div>
  </div>
</template>
