<script setup lang="ts">

import { type CommentType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  comment: any
}>()

/* formatting */

const editedAt = (comment: CommentType) => {
  if (comment.updated_at !== comment.created_at && comment.updated_at) {
    const str = timeAgo(comment.updated_at).replace(' ', '_')
    return `[(edited)](a~~~###~~~Edited_${str}) `
  }
  return ''
}

</script>

<template>
  <div class="bg-white p-3 rounded-lg -ml-8 border border-gray-300 border-1 shadow-sm relative group">
    <div>
      <span class="font-medium text-sm">
        {{ props.comment.displayName }}
      </span>
      <span class="text-xs text-gray-500 ml-2">
        {{ timeAgo(props.comment.created_at) }}
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
    <SmartsheetExpandedFormRichComment
      :value="`${props.comment.comment}  ${editedAt(props.comment)}`"
      class="!text-small !leading-18px !text-gray-800 -ml-1"
      read-only
      sync-value-change
    />
  </div>
</template>
