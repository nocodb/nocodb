<script setup lang="ts">
import type { CowriterType } from 'nocodb-sdk'
import { timeAgo, useCowriterStoreOrThrow } from '#imports'

const {
  COWRITER_TABS,
  copyCowriterOutput,
  starCowriterOutput,
  cowriterOutputList,
  cowriterHistoryList,
  cowriterStarredList,
  cowriterOutputActiveKey,
  generateCowriterLoading,
  getUpdatedStarredInMeta,
} = useCowriterStoreOrThrow()

const cowriterRecords = computed(() => {
  switch (cowriterOutputActiveKey.value) {
    case COWRITER_TABS.OUTPUT_RESULT_KEY:
      return cowriterOutputList.value
    case COWRITER_TABS.OUTPUT_HISTORY_KEY:
      return cowriterHistoryList.value
    case COWRITER_TABS.OUTPUT_STARRED_KEY:
      return cowriterStarredList.value
    default:
      return []
  }
})

function copyOutput(output: string) {
  copyCowriterOutput(output)
}

function starOutput(recordIdx: number, recordId: string, meta: any) {
  starCowriterOutput(recordId, meta)
  // update local state
  meta = getUpdatedStarredInMeta(meta)
  cowriterRecords.value[recordIdx].meta = JSON.stringify(meta)
  if (meta.starred) {
    ;(cowriterStarredList.value as CowriterType[]).unshift(cowriterRecords.value[recordIdx])
  } else {
    cowriterStarredList.value = cowriterStarredList.value.filter((o) => o.id !== recordId)
  }
}
</script>

<template>
  <general-overlay :model-value="generateCowriterLoading" inline transition class="!bg-opacity-15">
    <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
      <a-spin size="large" tip="Generating ..." />
    </div>
  </general-overlay>
  <div class="max-h-[max(calc(100vh_-_200px)_,300px)] overflow-y-scroll">
    <div v-if="cowriterRecords.length" class="bg-[#EEF2FF]">
      <div v-for="(record, idx) of cowriterRecords" :key="record.id" class="border-b-1 border-gray-200">
        <div class="p-[24px] pb-0">
          <pre class="whitespace-pre-wrap text-[14px] nc-cowriter-output">{{ record.output }}</pre>
        </div>
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
    <div v-else class="h-full w-full text-gray-600 flex items-center justify-center relative my-[40px]">
      <div class="flex flex-col gap-6 items-center justify-center mx-auto text-center text-gray-500 w-3/5 h-1/2 rounded-md">
        <div class="prose-lg leading-8">
          <span v-if="cowriterOutputActiveKey === COWRITER_TABS.OUTPUT_RESULT_KEY">
            <a-empty>
              <template #description>
                <div class="font-bold mb-3">No Output Generated</div>
                <div>Please input the statement in Prompt first and generate the result.</div>
              </template>
            </a-empty>
          </span>
          <span v-if="cowriterOutputActiveKey === COWRITER_TABS.OUTPUT_HISTORY_KEY">
            <a-empty>
              <template #description>
                <div class="font-bold mb-3">No History Found</div>
                <div>Generated outputs will be shown here even though they are cleared.</div>
              </template>
            </a-empty>
          </span>
          <span v-if="cowriterOutputActiveKey === COWRITER_TABS.OUTPUT_STARRED_KEY">
            <a-empty>
              <template #description>
                <div class="font-bold mb-3">No Starred Output Found</div>
                <div>You haven't starred the generated output in Output list yet.</div>
              </template>
            </a-empty>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.nc-cowriter-output {
  font-family: unset;
  line-height: unset;
}
</style>
