<script setup lang="ts">
import type { ChatContentBlock } from 'nocodb-sdk'
import { ChatToolCallStatus } from 'nocodb-sdk'
import { extractKeyArg } from '~/ee/utils/chatUtils'

type ToolUseBlock = Extract<ChatContentBlock, { type: 'tool_use' }>

interface Props {
  block: ToolUseBlock
  index?: number
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
})

const { block } = toRefs(props)

const { t } = useI18n()

const { bases } = storeToRefs(useBases())

const { $e } = useNuxtApp()

const isExpanded = ref(false)
const showFullResult = ref(false)

const MAX_RESULT_LINES = 8

const SCHEMA_TOOLS = new Set([
  'list_tables',
  'create_table',
  'rename_table',
  'delete_table',
  'add_field',
  'modify_field',
  'delete_field',
  'create_view',
  'list_views',
  'rename_view',
  'delete_view',
])

const DATA_PREFIXES = [
  'query_',
  'get_',
  'create_record',
  'update_record',
  'delete_record',
  'count_',
  'link_',
  'unlink_',
  'list_linked_',
]

const isProxy = computed(() => block.value.name === 'base_proxy')

const proxyBaseName = computed(() => {
  if (!isProxy.value) return null
  const baseId = block.value.input?.base_id as string | undefined
  if (!baseId) return null
  return bases.value.get(baseId)?.title ?? null
})

const effectiveName = computed(() => {
  if (isProxy.value && block.value.input?.tool_name) {
    return block.value.input.tool_name as string
  }
  return block.value.name
})

const effectiveInput = computed(() => {
  if (isProxy.value) {
    return (block.value.input?.tool_args as Record<string, unknown>) ?? {}
  }
  return block.value.input
})

const isError = computed(() => block.value.status === ChatToolCallStatus.ERROR || block.value.is_error)
const isInProgress = computed(
  () => block.value.status === ChatToolCallStatus.RUNNING || block.value.status === ChatToolCallStatus.PENDING,
)
const isAwaitingApproval = computed(() => block.value.status === ChatToolCallStatus.AWAITING_APPROVAL)
const isDenied = computed(() => block.value.status === ChatToolCallStatus.DENIED)

const { copy } = useCopy()

async function copyText(text: string) {
  try {
    await copy(text)
    message.toast(t('general.copied'))
  } catch {
    message.error(t('msg.error.copyToClipboardError'))
  }
}

const displayName = computed(() => effectiveName.value.replace(/_/g, ' '))

const keyArg = computed(() => extractKeyArg(effectiveInput.value as Record<string, unknown>))

const category = computed(() => {
  const name = effectiveName.value
  if (SCHEMA_TOOLS.has(name) || name.startsWith('describe_')) {
    return { icon: 'table', color: 'text-nc-content-blue' }
  }
  if (DATA_PREFIXES.some((p) => name.startsWith(p))) {
    return { icon: 'database', color: 'text-nc-content-green' }
  }
  return { icon: 'filter', color: 'text-nc-content-purple' }
})

const formattedArgs = computed(() => {
  try {
    const args = effectiveInput.value
    if (!args || Object.keys(args).length === 0) return null
    return JSON.stringify(args, null, 2)
  } catch {
    return String(effectiveInput.value)
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

const outputLines = computed(() => formattedOutput.value.split('\n'))

const visibleOutput = computed(() => {
  if (outputLines.value.length <= MAX_RESULT_LINES || showFullResult.value) return formattedOutput.value
  return `${outputLines.value.slice(0, MAX_RESULT_LINES).join('\n')}\n…`
})

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) $e('c:chat:tool-call:expand', { tool: effectiveName.value })
}
</script>

<template>
  <div
    class="nc-chat-tool-call rounded-lg overflow-hidden transition-all duration-150"
    :class="{
      'border-1 border-nc-border-red-medium bg-nc-bg-red-light': isError,
      'border-1 border-nc-border-yellow bg-nc-bg-yellow-light': isAwaitingApproval,
      'border-1 border-nc-border-gray-light bg-nc-bg-gray-extralight': isDenied,
      'border-1 border-nc-border-gray-light bg-nc-bg-gray-extralight hover:bg-nc-bg-gray-light':
        !isError && !isAwaitingApproval && !isDenied,
    }"
    :style="{ '--i': index }"
  >
    <div class="flex items-center gap-1.5 px-2 py-1.5 select-none cursor-pointer" @click="toggleExpanded">
      <GeneralLoader v-if="isInProgress" :size="14" class="flex-none" />
      <GeneralIcon
        v-else-if="isAwaitingApproval"
        icon="ncAlertCircle"
        class="flex-none w-3.5 h-3.5 text-nc-content-yellow-dark"
      />
      <GeneralIcon v-else :icon="category.icon" class="flex-none w-3.5 h-3.5" :class="category.color" />

      <span class="text-captionSm leading-none capitalize truncate" :class="category.color">
        {{ displayName }}
      </span>

      <span
        v-if="proxyBaseName"
        class="text-captionXs text-nc-content-purple bg-nc-bg-purple-light rounded px-1 py-0.5 max-w-[120px] truncate leading-none flex-shrink-0"
      >
        {{ proxyBaseName }}
      </span>

      <span
        v-if="keyArg"
        class="text-captionSm text-nc-content-gray-subtle bg-nc-bg-gray-light rounded px-1 py-0.5 max-w-[120px] truncate leading-none flex-shrink-0"
      >
        {{ keyArg }}
      </span>

      <span
        v-if="block.agent"
        class="text-captionXs text-nc-content-gray-muted bg-nc-bg-gray-light rounded px-1 py-0.5 leading-none flex-shrink-0"
      >
        {{ block.agent }}
      </span>

      <div class="flex-1 min-w-0" />

      <GeneralIcon
        icon="chevronDown"
        class="flex-none w-3 h-3 text-nc-content-gray-muted transition-transform duration-200"
        :class="{ 'rotate-180': isExpanded }"
      />
    </div>

    <Transition name="nc-tool-expand">
      <div v-if="isExpanded" class="border-t-1 border-nc-border-gray-light px-2 py-2 space-y-2">
        <div v-if="formattedArgs" class="space-y-1">
          <div class="flex items-center justify-between">
            <div class="text-captionXsBold uppercase tracking-wide text-nc-content-gray-muted">
              {{ t('msg.chat.toolInput') }}
            </div>
            <NcTooltip :title="t('general.copy')" placement="top">
              <NcButton type="text" size="xxsmall" class="!h-5 !w-5 !min-w-5" @click.stop="copyText(formattedArgs!)">
                <GeneralIcon icon="copy" class="w-3 h-3" />
              </NcButton>
            </NcTooltip>
          </div>
          <pre
            class="text-captionSm leading-relaxed text-nc-content-gray-emphasis bg-nc-bg-default rounded-md p-2 overflow-x-auto nc-scrollbar-thin max-h-32"
            >{{ formattedArgs }}</pre
          >
        </div>

        <div v-if="block.output !== undefined" class="space-y-1">
          <div class="flex items-center justify-between">
            <div class="text-captionXsBold uppercase tracking-wide text-nc-content-gray-muted">
              {{ isError ? t('msg.chat.toolError') : t('msg.chat.toolOutput') }}
            </div>
            <NcTooltip v-if="formattedOutput" :title="t('general.copy')" placement="top">
              <NcButton type="text" size="xxsmall" class="!h-5 !w-5 !min-w-5" @click.stop="copyText(formattedOutput)">
                <GeneralIcon icon="copy" class="w-3 h-3" />
              </NcButton>
            </NcTooltip>
          </div>

          <div class="relative">
            <pre
              class="text-captionSm leading-relaxed rounded-md p-2 overflow-x-auto nc-scrollbar-thin"
              :class="isError ? 'bg-nc-bg-red-light text-nc-content-red' : 'bg-nc-bg-default text-nc-content-gray-emphasis'"
              >{{ visibleOutput }}</pre
            >
            <button
              v-if="outputLines.length > MAX_RESULT_LINES"
              class="mt-1 text-captionSm text-nc-content-brand hover:underline"
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
