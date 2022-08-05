<script setup lang="ts">
import { useExpandedFormStoreOrThrow } from '#imports'
import { enumColor, timeAgo } from '~/utils'
import MdiKeyboardReturnIcon from '~icons/mdi/keyboard-return'
import MdiAccountIcon from '~icons/mdi/account-circle'

const { loadCommentsAndLogs, commentsAndLogs, isCommentsLoading, commentsOnly, saveComment, isYou, comment } =
  useExpandedFormStoreOrThrow()

await loadCommentsAndLogs()
</script>

<template>
  <div>
    <v-skeleton-loader v-if="isCommentsLoading && !commentsAndLogs" type="list-item-avatar-two-line@8" />

    <div v-else class="blue-grey">
      <div v-for="log of commentsAndLogs" :key="log.id" class="flex gap-1 text-xs">
        <MdiAccountIcon class="row-span-2" :class="isYou(log.user) ? 'text-pink-300' : 'text-blue-300 '" />
        <div class="flex-grow">
          <p class="mb-1 caption edited-text text-[10px] text-gray">
            {{ isYou(log.user) ? 'You' : log.user == null ? 'Shared base' : log.user }}
            {{ log.op_type === 'COMMENT' ? 'commented' : log.op_sub_type === 'INSERT' ? 'created' : 'edited' }}
          </p>
          <p
            v-if="log.op_type === 'COMMENT'"
            class="caption mb-0 nc-chip w-full min-h-20px"
            :style="{ backgroundColor: enumColor.light[2] }"
          >
            {{ log.description }}
          </p>

          <p v-else v-dompurify-html="log.details" class="caption mb-0" style="word-break: break-all" />

          <p class="time text-right text-[10px] mb-0">
            {{ timeAgo(log.created_at) }}
          </p>
        </div>
      </div>
    </div>
    <a-checkbox v-model:checked="commentsOnly" @change="loadCommentsAndLogs"
      ><span class="text-xs">Comments only</span>
    </a-checkbox>
    <div class="flex-shrink-1 mt-2 d-flex pl-4">
      <v-icon color="pink lighten-2" class="mr-2"> mdi-account-circle</v-icon>
      <a-input
        v-model:value="comment"
        class="caption comment-box"
        :class="{ focus: showborder }"
        @focusin="showborder = true"
        @focusout="showborder = false"
        @keyup.enter.prevent="saveComment"
      >
        <template #suffix>
          <MdiKeyboardReturnIcon v-if="comment" class="text-sm" small @click="saveComment" />
        </template>
      </a-input>
    </div>
  </div>
</template>

<style scoped>
:deep(.red.lighten-4) {
  @apply bg-red-100;
}

:deep(.green.lighten-4) {
  @apply bg-green-100;
}
</style>
