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
  <!-- Padding, not margin: margins collapse between threads and squeeze them next to history entries -->
  <div class="nc-discussion-thread-entry relative py-2" :data-testid="`nc-discussion-thread-${thread.root.id}`">
    <div
      v-if="showNewDivider"
      class="nc-comment-new-divider absolute top-0 left-11.5 right-0 rtl:(left-0 right-11.5) -translate-y-1/2 flex items-center gap-2 text-[11px] font-semibold uppercase text-nc-content-red-medium z-1"
      data-testid="nc-comment-new-divider"
    >
      <span class="h-px flex-1 bg-nc-border-red" />
      <span class="bg-nc-bg-default px-1">{{ $t('activity.commentThread.newDivider') }}</span>
      <span class="h-px flex-1 bg-nc-border-red" />
    </div>
    <!-- Root author, centred on the card's first row -->
    <div class="absolute left-0 rtl:(left-auto right-0)" :class="compact ? 'top-[9px]' : 'top-[15px]'">
      <GeneralUserIcon
        :user="{
          display_name: thread.root.created_display_name,
          email: thread.root.created_by_email,
          meta: thread.root.created_by_meta,
        }"
        size="base"
        class="nc-discussion-thread-avatar w-[28px] h-[28px] !aspect-square !text-small"
      />
    </div>
    <div
      class="nc-discussion-thread-card ml-11.5 rtl:(mr-11.5 ml-0) min-w-0"
      :class="compact ? 'nc-discussion-thread-compact' : 'rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-elevated'"
    >
      <SmartsheetExpandedFormSidebarCommentThread :thread="thread" avatar-outside />
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-discussion-thread-entry {
  &::before {
    content: '';
    @apply absolute top-0 left-15.8 h-2 border-l-1 border-nc-border-gray-dark;
  }
  &::after {
    content: '';
    @apply absolute bottom-0 left-15.8 h-2 border-l-1 border-nc-border-gray-dark;
  }
}

/* Hover fills the card edge to edge, inside its rounded corners */
.nc-discussion-thread-card:not(.nc-discussion-thread-compact) {
  :deep(.nc-comment-item:first-child > .group) {
    border-top-left-radius: 7px;
    border-top-right-radius: 7px;
  }
  :deep(.nc-comment-item:last-child > .group) {
    border-bottom-right-radius: 7px;
  }
  :deep(.nc-comment-item:not(.nc-comment-reply):last-child > .group) {
    border-bottom-left-radius: 7px;
  }
}

/* Reply rail sits on the timeline line (63.2px) running behind the card (46px + 1px border) */
:deep(.nc-comment-reply) {
  margin-left: 16.2px;
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
