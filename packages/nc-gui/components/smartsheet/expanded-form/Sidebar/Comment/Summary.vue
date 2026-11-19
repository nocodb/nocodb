<script setup lang="ts">
import type { CommentThreadSummary } from '~/composables/useRowComments'
import { NcMarkdownParser } from '~/helpers/tiptap'

const props = defineProps<{
  summary: CommentThreadSummary
}>()

const emits = defineEmits<{
  (e: 'dismiss'): void
}>()

const html = computed(() => (props.summary.text ? NcMarkdownParser.parse(props.summary.text, {}, true) ?? '' : ''))
</script>

<template>
  <div
    class="nc-comment-thread-summary rounded-lg border-1 border-nc-border-purple bg-nc-bg-purple-light px-3 py-2"
    data-testid="nc-comment-thread-summary"
  >
    <div class="flex items-center gap-1.5 text-xs font-semibold text-nc-content-purple-dark">
      <GeneralLoader v-if="summary.loading" size="regular" class="!text-current" />
      <GeneralIcon v-else icon="ncAutoAwesome" class="w-3.5 h-3.5 !text-current" />
      <span class="flex-1 truncate">
        {{
          summary.loading
            ? $t('activity.commentThread.summarizing')
            : $t('activity.commentThread.summaryOf', { count: summary.count ?? 0 }, summary.count ?? 0)
        }}
      </span>
      <NcButton
        v-if="!summary.loading"
        type="text"
        size="xxsmall"
        icon-only
        class="!text-nc-content-purple-dark"
        :aria-label="$t('general.dismiss')"
        data-testid="nc-comment-thread-summary-dismiss"
        @click="emits('dismiss')"
      >
        <template #icon>
          <GeneralIcon icon="close" class="w-3.5 h-3.5" />
        </template>
      </NcButton>
    </div>
    <div
      v-if="html"
      v-dompurify-html="html"
      class="nc-comment-thread-summary-body nc-rich-text-content mt-1 !text-small !leading-18px text-nc-content-gray"
    ></div>
  </div>
</template>

<style scoped lang="scss">
.nc-comment-thread-summary-body {
  :deep(ul) {
    @apply !my-0 !pl-4 list-disc;
  }
  :deep(p) {
    @apply !m-0;
  }
}
</style>
