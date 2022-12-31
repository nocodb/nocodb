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
  <div v-else class="h-full w-full text-gray-600 flex items-center justify-center relative mt-[20px]">
    <div class="flex flex-col gap-6 items-center justify-center mx-auto text-center text-gray-500 w-3/5 h-1/2 rounded-md">
      <div class="prose-lg leading-8">
        <span v-if="cowriterOutputActiveKey === 'cowriter-output'">No Output Generated</span>
        <span v-else>No History</span>
      </div>
    </div>
  </div>
</template>
