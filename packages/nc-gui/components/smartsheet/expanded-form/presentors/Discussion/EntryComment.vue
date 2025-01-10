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
  <div class="bg-white rounded-lg border border-gray-300 border-1 shadow-sm relative group my-4 nc-audit-comment-block">
    <div class="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-200 rounded-t-lg">
      <GeneralUserIcon :email="props.comment.user" class="w-[24px] aspect-square" />
      <span class="font-medium text-sm">
        {{ props.comment.displayName }}
      </span>
      <span class="text-xs text-gray-500">
        {{ timeAgo(props.comment.created_at) }}
      </span>
      <div class="flex-1 text-right" />
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
      class="!text-small !leading-18px !text-gray-800 px-5 py-4"
      read-only
      sync-value-change
    />
  </div>
</template>

<style scoped lang="scss">
.nc-audit-comment-block::before {
  content: '';
  @apply absolute -top-4.5 left-5.75 w-[1px] h-4.5 bg-gray-200;
}
</style>
