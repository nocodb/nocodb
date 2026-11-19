<script setup lang="ts">
import dayjs from 'dayjs'
import type { CommentTask } from 'nocodb-sdk'

const props = defineProps<{
  task: CommentTask
  assigneeName: string
  canEdit?: boolean
}>()

const emits = defineEmits<{
  (e: 'toggle', done: boolean): void
  (e: 'edit'): void
}>()

const { t } = useI18n()

const dueLabel = computed(() => {
  if (!props.task.due) return ''

  const due = dayjs(props.task.due)
  if (!due.isValid()) return ''

  return t('activity.commentThread.due', { date: due.format(due.year() === dayjs().year() ? 'D MMM' : 'D MMM YYYY') })
})

const isOverdue = computed(() => !props.task.done && !!props.task.due && dayjs(props.task.due).isBefore(dayjs(), 'day'))
</script>

<template>
  <div
    class="nc-comment-task flex w-full max-w-full items-center gap-2 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-elevated px-2 py-1 text-small"
    data-testid="nc-comment-task"
  >
    <NcTooltip :disabled="!canEdit" class="flex flex-none">
      <template #title>
        {{ task.done ? $t('activity.commentThread.markNotDone') : $t('activity.commentThread.markDone') }}
      </template>
      <NcCheckbox
        :checked="!!task.done"
        :disabled="!canEdit"
        data-testid="nc-comment-task-checkbox"
        @change="(_e, checked) => emits('toggle', checked)"
      />
    </NcTooltip>
    <NcTooltip class="min-w-0 flex-1 flex" :title="$t('activity.commentThread.assignedTo', { name: assigneeName })">
      <button
        type="button"
        class="min-w-0 flex-1 truncate text-left text-nc-content-gray"
        :class="[
          task.done ? 'line-through text-nc-content-gray-muted' : '',
          canEdit ? 'cursor-pointer hover:underline' : 'cursor-default',
        ]"
        :disabled="!canEdit"
        :aria-label="$t('activity.commentThread.assignedTo', { name: assigneeName })"
        @click="emits('edit')"
      >
        {{ assigneeName }}
      </button>
    </NcTooltip>
    <span
      v-if="dueLabel"
      class="flex-none text-xs"
      :class="isOverdue ? 'text-nc-content-red-medium' : 'text-nc-content-gray-muted'"
    >
      {{ dueLabel }}
    </span>
  </div>
</template>
