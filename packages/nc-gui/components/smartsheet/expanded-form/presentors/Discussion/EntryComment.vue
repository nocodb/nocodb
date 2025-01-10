<script setup lang="ts">

import dayjs from 'dayjs'

/* interface */

const props = defineProps<{
  comment: any
}>()

/* formatting */

function formatDateToRelative(date: string) {
  return dayjs(date).fromNow()
}

</script>

<template>
  <div class="bg-white p-3 rounded-lg -ml-8 border border-gray-300 border-1 shadow-sm relative group">
    <div>
      <span class="font-medium text-sm">
        {{ props.comment.displayName }}
      </span>
      <span class="text-xs text-gray-500 ml-2">
        {{ formatDateToRelative(props.comment.created_at) }}
      </span>
    </div>
    <div class="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-1">
      <NcTooltip>
        <NcButton
          class="!w-7 !h-7 !bg-transparent !hover:bg-gray-200"
          size="xsmall"
          type="text"
        >
          <GeneralIcon class="text-md" icon="pencil" />
        </NcButton>
        <template #title>Click to edit</template>
      </NcTooltip>
      <NcTooltip>
        <NcButton
          class="!w-7 !h-7 !bg-transparent !hover:bg-gray-200"
          size="xsmall"
          type="text"
        >
          <GeneralIcon class="text-md" icon="checkCircle" />
        </NcButton>
        <template #title>Click to resolve</template>
      </NcTooltip>
    </div>
    <p class="mb-0 mt-2">
      {{ props.comment.comment }}
    </p>
    <div class="mt-2">
      <GeneralEmojiPicker container-class="border-1 border-gray-300 rounded-full">
        <GeneralIcon class="w-[16px]" icon="ncSmile" />
      </GeneralEmojiPicker>
    </div>
  </div>
</template>
