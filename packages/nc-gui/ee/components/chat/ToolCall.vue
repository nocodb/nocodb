<script setup lang="ts">
import type { ChatContentBlock } from 'nocodb-sdk'
import { ChatToolCallStatus } from 'nocodb-sdk'

type ToolUseBlock = Extract<ChatContentBlock, { type: 'tool_use' }>

interface Props {
  block: ToolUseBlock
  index?: number
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
})

const emits = defineEmits<{
  approve: [toolCallId: string]
  deny: [toolCallId: string]
}>()

const { block } = toRefs(props)

const { t } = useI18n()

const isExpanded = ref(false)

const isSuccess = computed(() => block.value.status === ChatToolCallStatus.SUCCESS)
const isError = computed(() => block.value.status === ChatToolCallStatus.ERROR || block.value.is_error)
const isRunning = computed(() => block.value.status === ChatToolCallStatus.RUNNING)
const isPending = computed(() => block.value.status === ChatToolCallStatus.PENDING)
const isAwaitingApproval = computed(() => block.value.status === ChatToolCallStatus.AWAITING_APPROVAL)
const isDenied = computed(() => block.value.status === ChatToolCallStatus.DENIED)

const toolCategory = computed(() => {
  const name = block.value.name
  if (
    name === 'list_tables' ||
    name.startsWith('describe_') ||
    name === 'create_table' ||
    name === 'rename_table' ||
    name === 'delete_table' ||
    name === 'add_field' ||
    name === 'modify_field' ||
    name === 'delete_field' ||
    name === 'create_view' ||
    name === 'list_views' ||
    name === 'rename_view' ||
    name === 'delete_view'
  ) {
    return 'schema'
  }
  if (
    name.startsWith('query_') ||
    name.startsWith('get_') ||
    name.startsWith('create_record') ||
    name.startsWith('update_record') ||
    name.startsWith('delete_record') ||
    name.startsWith('count_')
  ) {
    return 'data'
  }
  if (name === 'ask_user') {
    return 'view'
  }
  return 'view'
})

const categoryIcon = computed(() => {
  switch (toolCategory.value) {
    case 'schema':
      return 'table'
    case 'data':
      return 'database'
    default:
      return 'filter'
  }
})

const categoryTextColor = computed(() => {
  switch (toolCategory.value) {
    case 'schema':
      return 'text-nc-content-blue'
    case 'data':
      return 'text-nc-content-green'
    default:
      return 'text-nc-content-purple'
  }
})

// Extract the most useful inline argument to show next to the tool name
const keyArg = computed(() => {
  const args = block.value.input
  if (!args || typeof args !== 'object') return null
  // Priority: table_name > title > first string value
  if (args.table_name) return args.table_name
  if (args.title) return args.title
  const firstStr = Object.values(args).find((v) => typeof v === 'string' && v.length < 40)
  return firstStr || null
})

const displayName = computed(() => block.value.name.replace(/_/g, ' '))

const formattedArgs = computed(() => {
  try {
    const args = block.value.input
    if (!args || Object.keys(args).length === 0) return null
    return JSON.stringify(args, null, 2)
  } catch {
    return String(block.value.input)
  }
})

const formattedOutput = computed(() => {
  if (block.value.output === undefined || block.value.output === null) return ''
  try {
    if (typeof block.value.output === 'string') return block.value.output
    return JSON.stringify(block.value.output, null, 2)
  } catch {
    return String(block.value.output)
  }
})

// Truncate long results
const MAX_RESULT_LINES = 8
const outputLines = computed(() => formattedOutput.value.split('\n'))
const isResultLong = computed(() => outputLines.value.length > MAX_RESULT_LINES)
const showFullResult = ref(false)
const visibleOutput = computed(() => {
  if (!isResultLong.value || showFullResult.value) return formattedOutput.value
  return `${outputLines.value.slice(0, MAX_RESULT_LINES).join('\n')}\n…`
})
</script>

<template>
  <div
    class="nc-chat-tool-call w-72 rounded-lg overflow-hidden transition-all duration-150"
    :class="{
      'border-1 border-nc-border-red-medium bg-nc-bg-red-light': isError,
      'border-1 border-nc-border-yellow bg-nc-bg-yellow-light': isAwaitingApproval,
      'border-1 border-nc-border-gray-light bg-nc-bg-gray-extralight': isDenied,
      'border-1 border-nc-border-gray-light bg-nc-bg-gray-extralight hover:bg-nc-bg-gray-light':
        !isError && !isAwaitingApproval && !isDenied,
    }"
    :style="{ '--i': index }"
  >
    <!-- Compact header row -->
    <div
      class="flex items-center gap-1.5 px-2.5 py-1.5 select-none"
      :class="{ 'cursor-pointer': !isAwaitingApproval }"
      @click="!isAwaitingApproval && (isExpanded = !isExpanded)"
    >
      <!-- Status indicator -->
      <div class="flex-none w-3.5 h-3.5 flex items-center justify-center">
        <GeneralLoader v-if="isRunning || isPending" :size="12" />
        <GeneralIcon v-else-if="isAwaitingApproval" icon="ncAlertCircle" class="w-3.5 h-3.5 text-nc-content-yellow-dark" />
        <span v-else-if="isError" class="w-2 h-2 rounded-full bg-nc-fill-red" />
        <span v-else-if="isDenied" class="w-2 h-2 rounded-full bg-nc-bg-gray-medium" />
        <span v-else class="w-2 h-2 rounded-full bg-nc-fill-green" />
      </div>

      <!-- Category icon -->
      <GeneralIcon :icon="categoryIcon" class="flex-none w-3.5 h-3.5" :class="categoryTextColor" />

      <!-- Tool name -->
      <span class="text-[12px] font-medium leading-none capitalize truncate" :class="categoryTextColor">
        {{ displayName }}
      </span>

      <!-- Key arg pill -->
      <span
        v-if="keyArg"
        class="text-[11px] text-nc-content-gray-subtle bg-nc-bg-gray-light rounded px-1 py-0.5 max-w-[120px] truncate leading-none flex-shrink-0"
      >
        {{ keyArg }}
      </span>

      <div class="flex-1 min-w-0" />

      <!-- Inline Allow / Deny for awaiting approval -->
      <template v-if="isAwaitingApproval">
        <NcButton
          size="xxsmall"
          type="text"
          class="!text-nc-content-red-dark !h-5 !px-1.5 text-[11px] font-medium"
          @click.stop="emits('deny', block.id)"
        >
          {{ t('general.deny') }}
        </NcButton>
        <NcButton
          size="xxsmall"
          type="primary"
          class="!h-5 !px-2 text-[11px] font-medium"
          @click.stop="emits('approve', block.id)"
        >
          {{ t('general.allow') }}
        </NcButton>
      </template>

      <!-- Chevron (hidden for awaiting approval — buttons take its place) -->
      <GeneralIcon
        v-else
        icon="chevronDown"
        class="flex-none w-3 h-3 text-nc-content-gray-muted transition-transform duration-200"
        :class="{ 'rotate-180': isExpanded }"
      />
    </div>

    <!-- Expanded content -->
    <Transition name="nc-tool-expand">
      <div v-if="isExpanded" class="border-t-1 border-nc-border-gray-light px-2.5 py-2 space-y-2">
        <!-- Arguments -->
        <div v-if="formattedArgs" class="space-y-1">
          <div class="text-[10px] uppercase tracking-wide font-semibold text-nc-content-gray-muted">
            {{ t('msg.chat.toolInput') }}
          </div>
          <pre
            class="text-[11px] leading-relaxed text-nc-content-gray-emphasis bg-nc-bg-default rounded-md p-2 overflow-x-auto nc-scrollbar-thin max-h-32"
            >{{ formattedArgs }}</pre
          >
        </div>

        <!-- Result -->
        <div v-if="block.output !== undefined" class="space-y-1">
          <div class="text-[10px] uppercase tracking-wide font-semibold text-nc-content-gray-muted">
            {{ isError ? t('msg.chat.toolError') : t('msg.chat.toolOutput') }}
          </div>
          <div class="relative">
            <pre
              class="text-[11px] leading-relaxed rounded-md p-2 overflow-x-auto nc-scrollbar-thin"
              :class="isError ? 'bg-nc-bg-red-light text-nc-content-red' : 'bg-nc-bg-default text-nc-content-gray-emphasis'"
              >{{ visibleOutput }}</pre
            >
            <button
              v-if="isResultLong"
              class="mt-1 text-[11px] text-nc-content-brand hover:underline"
              @click.stop="showFullResult = !showFullResult"
            >
              {{
                showFullResult
                  ? t('msg.chat.showLess')
                  : t('msg.chat.showMoreLines', { count: outputLines.length - MAX_RESULT_LINES })
              }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-tool-call {
  animation: nc-tool-slide-in 200ms ease both;
  animation-delay: calc(var(--i, 0) * 70ms);
}

@keyframes nc-tool-slide-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.nc-tool-expand-enter-active,
.nc-tool-expand-leave-active {
  transition: all 180ms ease;
  overflow: hidden;
}

.nc-tool-expand-enter-from,
.nc-tool-expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.nc-tool-expand-enter-to,
.nc-tool-expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
