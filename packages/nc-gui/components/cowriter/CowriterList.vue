<script setup lang="ts">
import { timeAgo, useCowriterStoreOrThrow } from '#imports'

const {
  copyCowriterOutput,
  starCowriterOutput,
  cowriterOutputList,
  cowriterHistoryList,
  cowriterOutputActiveKey,
  generateCowriterLoading,
} = useCowriterStoreOrThrow()

const cowriterRecords = computed(() =>
  cowriterOutputActiveKey.value === 'cowriter-output' ? cowriterOutputList.value : cowriterHistoryList.value,
)

function copyOutput(output: string) {
  copyCowriterOutput(output)
  message.success('Copied to clipboard')
}

function starOutput(recordIdx: number, recordId: string, recordMeta: any) {
  starCowriterOutput(recordId, recordMeta)
  message.success('Starred Output')
}
</script>

<template>
  <general-overlay :model-value="generateCowriterLoading" inline transition class="!bg-opacity-15">
    <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
      <a-spin size="large" />
    </div>
  </general-overlay>
  <div class="max-h-[max(calc(100vh_-_200px)_,300px)] overflow-y-scroll">
    <div v-if="cowriterRecords.length" class="bg-[#EEF2FF]">
      <div v-for="(record, idx) of cowriterRecords" :key="record.id" class="border-b-1 border-gray-200">
        <div class="p-[24px] pb-0">{{ record.output }}</div>
        <div class="flex w-full h-full items-center p-[24px]">
          <div class="flex gap-1">
            <a-button class="!rounded-md" @click="starOutput(idx, record.id, record.meta)">
              <MdiStar
                v-if="(typeof record.meta === 'string' ? JSON.parse(record.meta) : record.meta)?.starred === true"
                class="!text-orange-400"
              />
              <MdiStarOutline v-else />
            </a-button>

            <a-button class="!rounded-md" @click="copyOutput(record.output)">
              <MdiContentCopy />
            </a-button>
          </div>

          <div class="flex-1 min-w-0 flex justify-end">
            {{ timeAgo(record.created_at) }}
          </div>
        </div>
      </div>
    </div>
    <div v-else class="h-full w-full text-gray-600 flex items-center justify-center relative my-[10px]">
      <div class="flex flex-col gap-6 items-center justify-center mx-auto text-center text-gray-500 w-3/5 h-1/2 rounded-md">
        <div class="prose-lg leading-8">
          <span v-if="cowriterOutputActiveKey === 'cowriter-output'">No Output Generated</span>
          <span v-else>No History</span>
        </div>
      </div>
    </div>
  </div>
</template>
