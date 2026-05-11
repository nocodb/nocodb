<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

const { isCreatingFolder, addGroup } = useBookmarks()

const { $e } = useNuxtApp()

const value = ref('')

const focus: VNodeRef = (el) => {
  if (!el) return

  nextTick(() => {
    ;(el as HTMLInputElement)?.focus?.()
  })
}

watch(isCreatingFolder, (val) => {
  if (val) {
    value.value = ''
  }
})

async function confirm() {
  const name = value.value.trim()
  if (!name) {
    cancel()
    return
  }
  const group = await addGroup({ name })
  if (group) $e('a:bookmark:group:create')
  isCreatingFolder.value = false
  value.value = ''
}

function cancel() {
  isCreatingFolder.value = false
  value.value = ''
}
</script>

<template>
  <div v-if="isCreatingFolder" class="nc-bookmark-create-row">
    <GeneralIcon icon="ncFolderPlus" class="w-3.5 h-3.5 text-nc-content-brand flex-none" />
    <input
      :ref="focus"
      v-model="value"
      :placeholder="$t('labels.bookmarkGroup')"
      class="nc-bookmark-create-input"
      data-testid="nc-bookmark-new-folder-input"
      :bordered="false"
      @keyup.enter="confirm"
      @keyup.escape="cancel"
      @blur="confirm"
    />
    <div class="nc-bookmark-create-hints">
      <span><kbd>↵</kbd></span>
      <span><kbd>esc</kbd></span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-bookmark-create-row {
  @apply flex items-center gap-2 mx-3 mb-3 px-3 py-2 rounded-lg mt-3;
  @apply bg-nc-bg-default border-1 border-dashed border-nc-border-brand;
}
.nc-bookmark-create-input {
  @apply flex-1 min-w-0 bg-transparent !border-none !outline-none p-0;
  @apply text-bodyDefaultSm text-nc-content-gray;
  font-weight: 500;
}
.nc-bookmark-create-input::placeholder {
  @apply text-nc-content-gray-muted;
  font-weight: 400;
}
.nc-bookmark-create-hints {
  @apply flex gap-1.5 flex-none text-captionXs text-nc-content-gray-muted;
  font-family: 'JetBrainsMono', ui-monospace, monospace;
}
.nc-bookmark-create-hints kbd {
  @apply px-1 py-0.5 rounded bg-nc-bg-gray-extralight border-1 border-nc-border-gray-medium text-captionXs;
}
</style>
