<script setup lang="ts">
import { enumColor, ref, timeAgo, useExpandedFormStoreOrThrow, watch } from '#imports'

const { loadCommentsAndLogs, commentsAndLogs, isCommentsLoading, commentsOnly, saveComment, isYou, comment } =
  useExpandedFormStoreOrThrow()

const commentsWrapperEl = ref<HTMLDivElement>()

await loadCommentsAndLogs()

const showborder = ref(false)

watch(
  commentsAndLogs,
  () => {
    // todo: replace setTimeout
    setTimeout(() => {
      if (commentsWrapperEl.value) commentsWrapperEl.value.scrollTop = commentsWrapperEl.value?.scrollHeight
    }, 200)
  },
  { immediate: true },
)
</script>

<template>
  <div class="h-full flex flex-col w-full bg-[#eceff1] p-2">
    <div ref="commentsWrapperEl" class="flex-1 min-h-[100px] overflow-y-auto scrollbar-thin-dull p-2 space-y-2">
      <a-skeleton v-if="isCommentsLoading && !commentsAndLogs" type="list-item-avatar-two-line@8" />

      <template v-else>
        <div v-for="log of commentsAndLogs" :key="log.id" class="flex gap-1 text-xs">
          <MdiAccountCircle class="row-span-2" :class="isYou(log.user) ? 'text-pink-300' : 'text-blue-300 '" />

          <div class="flex-1">
            <p class="mb-1 caption edited-text text-[10px] text-gray-500">
              {{ isYou(log.user) ? 'You' : log.user == null ? 'Shared base' : log.user }}
              {{ log.op_type === 'COMMENT' ? 'commented' : log.op_sub_type === 'INSERT' ? 'created' : 'edited' }}
            </p>

            <p
              v-if="log.op_type === 'COMMENT'"
              class="block caption my-2 nc-chip w-full min-h-20px p-2 rounded"
              :style="{ backgroundColor: enumColor.light[2] }"
            >
              {{ log.description }}
            </p>

            <p v-else v-dompurify-html="log.details" class="caption my-3" style="word-break: break-all" />

            <p class="time text-right text-[10px] mb-0 mt-1 text-gray-500">
              {{ timeAgo(log.created_at) }}
            </p>
          </div>
        </div>
      </template>
    </div>

    <div class="border-1 my-2 w-full" />

    <div class="p-0">
      <div class="flex justify-center">
        <!--        Comments only -->
        <a-checkbox v-model:checked="commentsOnly" v-e="['c:row-expand:comment-only']" @change="loadCommentsAndLogs">
          {{ $t('labels.commentsOnly') }}

          <span class="text-[11px] text-gray-500" />
        </a-checkbox>
      </div>

      <div class="shrink mt-2 flex">
        <a-input
          v-model:value="comment"
          class="!text-xs nc-comment-box"
          ghost
          :class="{ focus: showborder }"
          @focusin="showborder = true"
          @focusout="showborder = false"
          @keyup.enter.prevent="saveComment"
        >
          <template #addonBefore>
            <div class="flex items-center">
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
