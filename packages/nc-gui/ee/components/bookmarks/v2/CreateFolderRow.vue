<script setup lang="ts">
const { isCreatingFolder, addGroup } = useBookmarks()

const { $e } = useNuxtApp()

const value = ref('')

const inputRef = ref<any>()

watch(isCreatingFolder, (val) => {
  if (val) {
    value.value = ''
    nextTick(() => {
      inputRef.value?.focus?.()
    })
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
  <div v-if="isCreatingFolder" class="nc-v2-create-row">
    <GeneralIcon icon="ncFolderPlus" class="w-3.5 h-3.5 text-nc-content-brand flex-none" />
    <input
      ref="inputRef"
      v-model="value"
      :placeholder="$t('labels.bookmarkGroup')"
      class="nc-v2-create-input"
      data-testid="nc-bookmark-new-folder-input"
      @keyup.enter="confirm"
      @keyup.escape="cancel"
      @blur="confirm"
    />
    <div class="nc-v2-create-hints">
      <span><kbd>↵</kbd></span>
      <span><kbd>esc</kbd></span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-v2-create-row {
  @apply flex items-center gap-2 mx-3 mb-3 px-3 py-2 rounded-lg;
  @apply bg-nc-bg-default border-1 border-dashed;
  border-color: var(--nc-content-brand);
}
.nc-v2-create-input {
  @apply flex-1 min-w-0 bg-transparent border-0 outline-0 p-0;
  @apply text-bodyDefaultSm text-nc-content-gray;
  font-weight: 500;
}
.nc-v2-create-input::placeholder {
  @apply text-nc-content-gray-muted;
  font-weight: 400;
}
.nc-v2-create-hints {
  @apply flex gap-1.5 flex-none text-captionXs text-nc-content-gray-muted;
  font-family: 'JetBrainsMono', ui-monospace, monospace;
}
.nc-v2-create-hints kbd {
  @apply px-1 py-0.5 rounded bg-nc-bg-gray-extralight border-1 border-nc-border-gray-medium text-captionXs;
}
</style>
