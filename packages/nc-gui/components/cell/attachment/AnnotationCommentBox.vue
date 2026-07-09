<script setup lang="ts">
const { commitDraft, cancelDraft } = useImageAnnotations()!

const { t } = useI18n()

const { $e } = useNuxtApp()

const comment = ref('')

const isSaving = ref(false)

const containerRef = ref<HTMLElement | null>(null)

// The popup mounts on the tick after the creating click/drag. That gesture's
// trailing `click` then bubbles to the document — onClickOutside would see it
// as an outside click and cancel the (empty) draft instantly. Ignore outside
// clicks until the creating gesture has fully settled.
const isReady = ref(false)

async function onSave() {
  const text = comment.value.trim()
  if (!text || isSaving.value) return

  isSaving.value = true
  try {
    await commitDraft(text)
    $e('a:attachment:annotation:create')
  } finally {
    isSaving.value = false
    comment.value = ''
  }
}

function onCancel() {
  cancelDraft()
}

onClickOutside(containerRef, () => {
  // Don't discard mid-typing — only cancel an empty draft on outside click,
  // and only after the creating gesture has settled (see isReady above).
  if (isReady.value && !comment.value.trim()) cancelDraft()
})

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
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
    onCancel()
  }
}
</script>

<template>
  <div
    ref="containerRef"
    class="nc-annotation-comment-box w-72 rounded-xl bg-nc-bg-default shadow-lg border-1 border-nc-border-gray-medium p-2 text-left"
    data-testid="nc-annotation-comment-box"
    @mousedown.stop
    @click.stop
  >
    <SmartsheetExpandedFormRichComment
      v-model:value="comment"
      autofocus
      :hide-options="false"
      :placeholder="`${t('general.comment')}...`"
      class="nc-annotation-comment-input !py-2 !px-2 cursor-text border-1 rounded-lg w-full bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[200px]"
      @save="onSave"
      @keydown.enter.exact.prevent="onSave"
      @keydown.esc.stop.prevent="onCancel"
    />
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-annotation-comment-input) {
  @apply min-h-8 text-left;
  box-shadow: none;
  &::placeholder {
    @apply !text-gray-400;
  }

  // Left-align the editor content (carousel container is text-center).
  .ProseMirror,
  .tiptap {
    @apply text-left;
  }
}
</style>
