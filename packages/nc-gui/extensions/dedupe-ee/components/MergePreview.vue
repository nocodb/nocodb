<script setup lang="ts">
import { useDedupeOrThrow } from '../lib/useDedupe'
import RecordCard from './RecordCard.vue'

const { mergeState, primaryRecordRowInfo } = useDedupeOrThrow()
</script>

<template>
  <div
    v-if="ncIsNumber(mergeState.primaryRecordIndex) && primaryRecordRowInfo"
    class="border-l border-nc-border-gray-medium bg-nc-bg-gray-extralight"
  >
    <div class="px-4 py-2 min-h-[38px]">
      <h3 class="font-semibold m-0">Merge Preview</h3>
    </div>

    <div class="h-[calc(100%_-_38px)] nc-scrollbar-thin">
      <div class="flex flex-col gap-4 children:flex-none px-4 pb-4 nc-scollbar-thin relative">
        <RecordCard :record="primaryRecordRowInfo" is-merge-record />
      </div>
    </div>
  </div>
</template>
