<script setup lang="ts">
import { useGPTStoreOrThrow } from '#imports'

const { promptStatement } = useGPTStoreOrThrow()
</script>

<template>
  <div class="h-min-[calc(100%_-_160px] w-full overflow-y-auto scrollbar-thin-dull">
    <a-textarea v-model:value="promptStatement" :auto-size="{ minRows: 20 }" />
  </div>
</template>
