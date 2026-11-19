<script setup lang="ts">
import type { CommentReactionSummaryItem } from '~/composables/useRowComments'

defineProps<{
  summary: CommentReactionSummaryItem[]
  canReact?: boolean
}>()

const emits = defineEmits<{
  (e: 'react', emoji: string): void
}>()
</script>

<template>
  <div v-if="summary.length" class="nc-comment-reactions flex flex-wrap items-center gap-1">
    <NcTooltip v-for="item in summary" :key="item.emoji" :disabled="!item.names.length">
      <template #title>{{ item.names.join(', ') }}</template>
      <button
        type="button"
        class="nc-comment-reaction-pill inline-flex items-center gap-1 px-1.5 h-6 rounded-full text-xs border-1 transition-colors"
        :class="[
          item.hasReacted
            ? 'bg-nc-bg-brand border-nc-border-brand text-nc-content-brand'
            : 'bg-nc-bg-gray-light border-nc-border-gray-medium text-nc-content-gray-subtle',
          canReact ? 'cursor-pointer hover:border-nc-border-brand' : 'cursor-default',
        ]"
        :disabled="!canReact"
        :data-testid="`nc-comment-reaction-${item.emoji}`"
        @click="emits('react', item.emoji)"
      >
        <span>{{ item.emoji }}</span>
        <span class="font-medium tabular-nums">{{ item.count }}</span>
      </button>
    </NcTooltip>

    <SmartsheetExpandedFormSidebarCommentReactionPicker v-if="canReact" @react="emits('react', $event)">
      <button
        type="button"
        class="nc-comment-reaction-add inline-flex items-center justify-center w-6 h-6 rounded-full border-1 border-nc-border-gray-medium text-nc-content-gray-muted hover:bg-nc-bg-gray-light cursor-pointer transition-colors"
        :aria-label="$t('activity.commentThread.addReaction')"
        data-testid="nc-comment-reaction-add"
      >
        <GeneralIcon icon="ncSmile" class="w-3.5 h-3.5" />
      </button>
    </SmartsheetExpandedFormSidebarCommentReactionPicker>
  </div>
</template>
