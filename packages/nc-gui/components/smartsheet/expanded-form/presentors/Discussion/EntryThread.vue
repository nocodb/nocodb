<script setup lang="ts">
import type { CommentThread } from '~/composables/useRowComments'

defineProps<{
  thread: CommentThread
  showNewDivider?: boolean
  /** Resolved thread folded to its one-line row: no card around it. */
  compact?: boolean
}>()
</script>

<template>
  <div class="nc-discussion-thread-entry relative my-4" :data-testid="`nc-discussion-thread-${thread.root.id}`">
    <div
      v-if="showNewDivider"
      class="nc-comment-new-divider absolute -top-4 left-11.5 right-0 rtl:(left-0 right-11.5) -translate-y-1/2 flex items-center gap-2 text-[11px] font-semibold uppercase text-nc-content-red-medium z-1"
      data-testid="nc-comment-new-divider"
    >
      <span class="h-px flex-1 bg-nc-border-red" />
      <span class="bg-nc-bg-default px-1">{{ $t('activity.commentThread.newDivider') }}</span>
      <span class="h-px flex-1 bg-nc-border-red" />
    </div>
    <div class="absolute left-0 top-1 rtl:(left-auto right-0)">
      <div
        class="w-[28px] h-[28px] flex items-center justify-center bg-nc-bg-elevated rounded-full border-1 border-nc-border-gray-medium shadow-sm"
      >
        <GeneralIcon icon="ncMessageCircle" class="w-[16px] h-[16px] text-nc-content-gray-muted" />
      </div>
    </div>
    <div
      class="nc-discussion-thread-card ml-11.5 rtl:(mr-11.5 ml-0) min-w-0"
      :class="
        compact ? 'nc-discussion-thread-compact' : 'rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-elevated py-1'
      "
    >
      <SmartsheetExpandedFormSidebarCommentThread :thread="thread" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-discussion-thread-entry {
  &::before {
    content: '';
    @apply absolute -top-4 left-15.8 h-4 border-l-1 border-nc-border-gray-dark;
  }
  &::after {
    content: '';
    @apply absolute -bottom-4 left-15.8 h-4 border-l-1 border-nc-border-gray-dark;
  }
}

.nc-discussion-thread-compact :deep(.nc-comment-resolved-row) {
  @apply !m-0 !w-full;
}

.rtl .nc-discussion-thread-entry {
  &::before,
  &::after {
    left: auto;
    right: 63.2px;
    border-left: 0;
    border-right: 1px solid var(--nc-border-gray-dark);
  }
}
</style>
