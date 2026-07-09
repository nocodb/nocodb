<script setup lang="ts">
const { commitDraft, cancelDraft } = useImageAnnotations()!

const { t } = useI18n()

const { $e } = useNuxtApp()

const comment = ref('')

const isSaving = ref(false)

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

// Outside-click dismissal is handled centrally by the Carousel (close modal
// first, else close the carousel). Here we only handle Esc.
onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
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
