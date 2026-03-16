<script setup lang="ts">
import type { ChatContentBlock } from 'nocodb-sdk'
import { ChatToolCallStatus } from 'nocodb-sdk'
import { extractKeyArg } from '~/ee/utils/chatUtils'

type ToolUseBlock = Extract<ChatContentBlock, { type: 'tool_use' }>

interface Props {
  block: ToolUseBlock
}

const props = defineProps<Props>()

const { block } = toRefs(props)

const isError = computed(() => block.value.status === ChatToolCallStatus.ERROR || block.value.is_error)
const isRunning = computed(
  () => block.value.status === ChatToolCallStatus.RUNNING || block.value.status === ChatToolCallStatus.PENDING,
)
const isSuccess = computed(() => block.value.status === ChatToolCallStatus.SUCCESS)
const isAwaitingApproval = computed(() => block.value.status === ChatToolCallStatus.AWAITING_APPROVAL)
const isDenied = computed(() => block.value.status === ChatToolCallStatus.DENIED)

const displayName = computed(() => block.value.name.replace(/_/g, ' '))

const keyArg = computed(() => extractKeyArg(block.value.input as Record<string, unknown>))
</script>

<template>
  <span
    class="nc-chat-action-chip inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-captionSm leading-tight"
    :class="{
      'bg-nc-bg-red-light text-nc-content-red': isError,
      'bg-nc-bg-green-light text-nc-content-green-dark': isSuccess,
      'bg-nc-bg-yellow-light text-nc-content-yellow-dark': isAwaitingApproval,
      'bg-nc-bg-gray-light text-nc-content-gray-subtle': isRunning || isDenied,
    }"
  >
    <GeneralLoader v-if="isRunning" :size="10" class="flex-none" />
    <GeneralIcon v-else-if="isError" icon="ncAlertCircle" class="flex-none w-3 h-3" />
    <GeneralIcon v-else-if="isAwaitingApproval" icon="ncAlertCircle" class="flex-none w-3 h-3" />
    <GeneralIcon v-else-if="isDenied" icon="ncXCircle" class="flex-none w-3 h-3" />
    <GeneralIcon v-else icon="check" class="flex-none w-3 h-3" />
    <span class="capitalize truncate max-w-[140px]">{{ displayName }}</span>
    <span v-if="keyArg" class="text-nc-content-gray-muted truncate max-w-[100px]">{{ keyArg }}</span>
  </span>
</template>
