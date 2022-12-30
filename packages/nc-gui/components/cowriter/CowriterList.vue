<script setup lang="ts">
import { useCowriterStoreOrThrow } from '#imports'

const { cowriterOutputList, cowriterHistoryList, cowriterOutputActiveKey } = useCowriterStoreOrThrow()

const cowriterRecords = computed(() =>
  cowriterOutputActiveKey.value === 'cowriter-output' ? cowriterOutputList.value : cowriterHistoryList.value,
)
</script>

<template>
  <div v-if="cowriterRecords.length">
    <div v-for="record of cowriterRecords" :key="record.id" class="bg-[#EEF2FF] border-b-1 border-gray-200">
      <div class="p-[24px] pb-0">{{ record.output }}</div>
      <div class="flex justify-end pr-3 pb-3">
        {{ record.created_at }}
      </div>
    </div>
  </div>
</template>
