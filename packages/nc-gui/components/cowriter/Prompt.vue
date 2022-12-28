<script setup lang="ts">
import { useCowriterStoreOrThrow } from '#imports'

const { promptStatementTemplate } = useCowriterStoreOrThrow()
</script>

<template>
  <div class="h-min-[calc(100%_-_160px] w-full overflow-y-auto scrollbar-thin-dull">
    <a-textarea v-model:value="promptStatementTemplate" :auto-size="{ minRows: 20 }" />
  </div>
</template>
