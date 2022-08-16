<script setup lang="ts">
import { enumColor, nextTick, ref, timeAgo, useExpandedFormStoreOrThrow, watch } from '#imports'

const { loadCommentsAndLogs, commentsAndLogs, isCommentsLoading, commentsOnly, saveComment, isYou, comment } =
  useExpandedFormStoreOrThrow()

const commentsWrapperEl = ref<HTMLDivElement>()

await loadCommentsAndLogs()

const showborder = ref(false)

watch(
  commentsAndLogs,
  () => {
    nextTick(() => {
      if (commentsWrapperEl.value) commentsWrapperEl.value.scrollTop = commentsWrapperEl.value?.scrollHeight
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="h-full d-flex flex-column w-full">
    <div ref="commentsWrapperEl" class="flex-grow-1 min-h-[100px] overflow-y-auto scrollbar-thin-primary p-2">
      <v-skeleton-loader v-if="isCommentsLoading && !commentsAndLogs" type="list-item-avatar-two-line@8" />

      <template v-else>
        <div v-for="log of commentsAndLogs" :key="log.id" class="flex gap-1 text-xs">
          <MdiAccountCircle class="row-span-2" :class="isYou(log.user) ? 'text-pink-300' : 'text-blue-300 '" />
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
      </template>
    </div>
    <div class="border-1 my-2 w-full ml-6" />
    <div class="p-0">
      <div class="flex justify-center">
        <a-checkbox v-model:checked="commentsOnly" @change="loadCommentsAndLogs"
          ><span class="text-[11px] text-gray-500">Comments only</span>
        </a-checkbox>
      </div>
      <div class="flex-shrink-1 mt-2 d-flex pl-4">
        <a-input
          v-model:value="comment"
          class="!text-xs"
          ghost
          :class="{ focus: showborder }"
          @focusin="showborder = true"
          @focusout="showborder = false"
          @keyup.enter.prevent="saveComment"
        >
          <template #addonBefore>
            <div class="flex align-center">
              <mdi-account-circle class="text-lg text-pink-300" small @click="saveComment" />
            </div>
          </template>
          <template #suffix>
            <mdi-keyboard-return v-if="comment" class="text-sm" small @click="saveComment" />
          </template>
        </a-input>
      </div>
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
