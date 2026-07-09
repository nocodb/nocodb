<script setup lang="ts">
import type { CommentType } from 'nocodb-sdk'

const { activeThread, parsedHtmlComments, replyToActive, closeActive } = useImageAnnotations()!

const { user } = useGlobal()

const { t } = useI18n()

const { $e } = useNuxtApp()

const containerRef = ref<HTMLElement | null>(null)

const threadRef = ref<HTMLElement | null>(null)

const replyInputRef = ref<any>()

const reply = ref('')

const isSaving = ref(false)

// Ignore the click/drag that opened this popup (see AnnotationCommentBox).
const isReady = ref(false)

function createdBy(comment: CommentType & { created_display_name_short?: string }) {
  if (comment.created_by === user.value?.id) return 'You'
  return comment.created_display_name_short?.trim() || comment.created_by_email || 'Shared source'
}

function scrollToBottom() {
  nextTick(() => {
    if (threadRef.value) threadRef.value.scrollTop = threadRef.value.scrollHeight
  })
}

async function onReply() {
  const text = reply.value.trim()
  if (!text || isSaving.value) return

  isSaving.value = true
  try {
    await replyToActive(text)
    $e('a:attachment:annotation:reply')
  } finally {
    isSaving.value = false
    reply.value = ''
    replyInputRef.value?.setEditorContent?.('', true)
    scrollToBottom()
  }
}

function onClose() {
  closeActive()
}

onClickOutside(
  containerRef,
  () => {
    // Close on outside click once settled, but never while a reply is in progress.
    if (isReady.value && !reply.value.trim()) closeActive()
  },
  // Clicking another marker should switch threads (handled by the marker), not close.
  { ignore: ['.nc-annotation-marker'] },
)

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  scrollToBottom()
  setTimeout(() => {
    isReady.value = true
  }, 250)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
})

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    onClose()
  }
}

watch(
  () => activeThread.value.length,
  () => scrollToBottom(),
)
</script>

<template>
  <div
    ref="containerRef"
    class="nc-annotation-comment-view w-80 rounded-xl bg-nc-bg-default shadow-lg border-1 border-nc-border-gray-medium text-left flex flex-col max-h-[360px]"
    data-testid="nc-annotation-comment-view"
    @mousedown.stop
    @click.stop
  >
    <div ref="threadRef" class="flex flex-col gap-3 p-3 overflow-y-auto nc-scrollbar-thin">
      <div v-for="comment in activeThread" :key="comment.id" class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <GeneralUserIcon
            :user="{
              display_name: (comment as any).created_display_name,
              email: comment.created_by_email,
              meta: (comment as any).created_by_meta,
            }"
            size="small"
          />
          <span class="text-small font-medium text-nc-content-gray truncate max-w-[140px]">{{ createdBy(comment) }}</span>
          <span class="text-xs text-nc-content-gray-muted flex-none">{{ timeAgo(comment.created_at!) }}</span>
        </div>
        <div
          v-dompurify-html="parsedHtmlComments[comment.id!]"
          class="nc-rich-text-content !text-small !leading-18px !text-nc-content-gray pl-7"
        ></div>
      </div>
    </div>

    <div class="p-2 border-t-1 border-nc-border-gray-medium">
      <SmartsheetExpandedFormRichComment
        ref="replyInputRef"
        v-model:value="reply"
        :hide-options="false"
        :placeholder="t('general.leaveComment')"
        class="nc-annotation-reply-input !py-2 !px-2 cursor-text border-1 rounded-lg w-full bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[160px]"
        @save="onReply"
        @keydown.enter.exact.prevent="onReply"
        @keydown.esc.stop.prevent="onClose"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-annotation-reply-input) {
  @apply min-h-8 text-left;
  box-shadow: none;
  &::placeholder {
    @apply !text-gray-400;
  }

  .ProseMirror,
  .tiptap {
    @apply text-left;
  }
}

.nc-rich-text-content {
  p {
    @apply !m-0 !leading-5;
  }
}
</style>
