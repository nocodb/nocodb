<script setup lang="ts">
import { useCowriterStoreOrThrow } from '#imports'

const { cowriterOutputList, cowriterHistoryList, cowriterOutputActiveKey, generateButtonLoading } = useCowriterStoreOrThrow()

const cowriterRecords = computed(() =>
  cowriterOutputActiveKey.value === 'cowriter-output' ? cowriterOutputList.value : cowriterHistoryList.value,
)
</script>

<template>
  <general-overlay :model-value="generateButtonLoading" inline transition class="!bg-opacity-15">
    <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
      <a-spin size="large" />
    </div>
  </general-overlay>
  <div v-if="cowriterRecords.length">
    <div v-for="record of cowriterRecords" :key="record.id" class="bg-[#EEF2FF] border-b-1 border-gray-200">
      <div class="p-[24px] pb-0">{{ record.output }}</div>
      <div class="flex justify-end pr-3 pb-3">
        {{ record.created_at }}
      </div>
    </div>
  </div>
</template>
