<script setup lang="ts">
import { useCowriterStoreOrThrow, useDebounceFn } from '#imports'

const { promptStatementTemplate, savePromptStatementTemplate } = useCowriterStoreOrThrow()

const syncValue = useDebounceFn(async () => await savePromptStatementTemplate(), 500, { maxWait: 2000 })

const vModel = computed({
  get: () => promptStatementTemplate.value,
  set: (val) => {
    if (val !== promptStatementTemplate.value) {
      promptStatementTemplate.value = val
      syncValue()
    }
  },
})
</script>

<template>
  <div class="h-min-[calc(100%_-_160px] w-full overflow-y-auto scrollbar-thin-dull nc-cowriter-prompt">
    <a-textarea v-model:value="vModel" :auto-size="{ minRows: 20 }" />
  </div>
</template>

<style>
.nc-cowriter-prompt textarea {
  @apply !px-[20px] !py-[30px];
}
</style>
