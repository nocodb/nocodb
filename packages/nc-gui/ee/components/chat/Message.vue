<script setup lang="ts">
import type { ChatMessageType } from 'nocodb-sdk'
import { ChatMessageRole, ChatToolCallStatus } from 'nocodb-sdk'
import { NcMarkdownParser } from '~/helpers/tiptap/functionality/markdown'

interface Props {
  message?: ChatMessageType
  content?: string
  role?: string
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  message: undefined,
  content: '',
  role: undefined,
  isStreaming: false,
})

const emits = defineEmits<{
  approve: [messageId: string, toolCallId: string]
  deny: [messageId: string, toolCallId: string]
}>()

const { message, content, role, isStreaming } = toRefs(props)

const messageRole = computed(() => message.value?.role || role.value || ChatMessageRole.USER)
const messageContent = computed(() => message.value?.content || content.value || '')
const isUser = computed(() => messageRole.value === ChatMessageRole.USER)
const isAssistant = computed(() => messageRole.value === ChatMessageRole.ASSISTANT)

const toolCalls = computed(() => message.value?.tool_calls || [])
const toolResults = computed(() => message.value?.tool_results || [])

const findResult = (toolCallId: string) => toolResults.value.find((r) => r.tool_call_id === toolCallId)

// Grouping: show first 2 by default; expand to show all if > 3
const VISIBLE_DEFAULT = 2
const showAllTools = ref(false)

const hasActiveTools = computed(() =>
  toolCalls.value.some(
    (tc) => tc.status === ChatToolCallStatus.RUNNING || tc.status === ChatToolCallStatus.PENDING,
  ),
)

const visibleToolCalls = computed(() => {
  if (showAllTools.value || toolCalls.value.length <= VISIBLE_DEFAULT + 1) {
    return toolCalls.value
  }
  return toolCalls.value.slice(0, VISIBLE_DEFAULT)
})

const hiddenCount = computed(() => {
  if (showAllTools.value || toolCalls.value.length <= VISIBLE_DEFAULT + 1) return 0
  return toolCalls.value.length - VISIBLE_DEFAULT
})

const errorCount = computed(() => toolCalls.value.filter((tc) => tc.status === ChatToolCallStatus.ERROR).length)

const renderedContent = computed(() => {
  if (!messageContent.value || !isAssistant.value) return ''
  return NcMarkdownParser.parse(messageContent.value, { linkify: true, breaks: true })
})
</script>

<template>
  <div class="nc-chat-message flex" :class="{ 'justify-end': isUser, 'justify-start': isAssistant }">
    <div
      class="max-w-[88%] rounded-xl px-3 py-2.5"
      :class="{
        'bg-nc-fill-primary text-white': isUser,
        'bg-nc-bg-default border-1 border-nc-border-gray-light': isAssistant,
      }"
    >
      <!-- Tool calls section (before message text for assistant) -->
      <div v-if="toolCalls.length" class="space-y-1 mb-2">
        <!-- Active tools label -->
        <div v-if="hasActiveTools" class="flex items-center gap-1.5 mb-1.5">
          <GeneralLoader :size="12" />
          <span class="text-[11px] text-nc-content-gray-subtle">Working…</span>
        </div>

        <!-- Tool call rows -->
        <TransitionGroup tag="div" name="nc-tool-list" class="space-y-1">
          <ChatToolCall
            v-for="(tc, i) in visibleToolCalls"
            :key="tc.id"
            :tool-call="tc"
            :result="findResult(tc.id)"
            :index="i"
            @approve="emits('approve', message?.id!, $event)"
            @deny="emits('deny', message?.id!, $event)"
          />
        </TransitionGroup>

        <!-- Show more / show less toggle -->
        <Transition name="nc-fade">
          <div v-if="hiddenCount > 0 || showAllTools" class="pt-0.5">
            <button
              class="flex items-center gap-1 text-[11px] text-nc-content-gray-subtle hover:text-nc-content-gray-emphasis transition-colors"
              @click="showAllTools = !showAllTools"
            >
              <GeneralIcon
                icon="chevronDown"
                class="w-3 h-3 transition-transform duration-200"
                :class="{ 'rotate-180': showAllTools }"
              />
              <span>{{ showAllTools ? 'Show less' : `+${hiddenCount} more` }}</span>
              <span v-if="errorCount && !showAllTools" class="text-nc-content-red ml-1">
                ({{ errorCount }} failed)
              </span>
            </button>
          </div>
        </Transition>
      </div>

      <!-- User message: plain text -->
      <div
        v-if="messageContent && isUser"
        class="text-sm whitespace-pre-wrap break-words leading-relaxed text-white"
      >
        {{ messageContent }}
      </div>

      <!-- Assistant message: rendered markdown -->
      <div
        v-else-if="renderedContent && isAssistant"
        v-dompurify-html="renderedContent"
        class="nc-chat-markdown nc-rich-text-content text-sm text-nc-content-gray-emphasis break-words"
      />

      <!-- Streaming cursor (assistant only, no content yet) -->
      <template v-if="isStreaming">
        <div v-if="!messageContent && !toolCalls.length" class="flex items-center gap-1 py-0.5">
          <span class="nc-chat-dot" />
          <span class="nc-chat-dot" style="animation-delay: 160ms" />
          <span class="nc-chat-dot" style="animation-delay: 320ms" />
        </div>
        <span v-else-if="messageContent && isAssistant" class="nc-chat-cursor block w-1.5 h-3 mt-0.5 bg-nc-content-gray-muted rounded-sm" />
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-cursor {
  animation: blink 1s step-end infinite;
  vertical-align: middle;
}

.nc-chat-dot {
  @apply inline-block w-1.5 h-1.5 rounded-full bg-nc-content-gray-muted;
  animation: nc-dot-bounce 1.2s ease-in-out infinite both;
}

@keyframes nc-dot-bounce {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

// TransitionGroup for tool call list
.nc-tool-list-enter-active {
  transition: all 220ms ease;
}

.nc-tool-list-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.nc-tool-list-leave-active {
  transition: all 150ms ease;
  position: absolute;
}

.nc-tool-list-leave-to {
  opacity: 0;
}

// Chat markdown — tighten spacing for the compact bubble layout
.nc-chat-markdown {
  :deep(p) {
    @apply mb-1 last:mb-0;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3) {
    @apply font-semibold mb-1;
    font-size: 0.875rem;
  }

  :deep(ul),
  :deep(ol) {
    @apply pl-4 my-1;
  }

  :deep(ul li) {
    list-style-type: disc;
  }

  :deep(ol li) {
    list-style-type: decimal;
  }

  :deep(code) {
    @apply font-mono text-[12px] bg-nc-bg-gray-light rounded px-1 py-0.5;
  }

  :deep(pre) {
    @apply rounded-md p-2 my-1 overflow-x-auto nc-scrollbar-thin bg-nc-bg-gray-light;

    code {
      @apply bg-transparent p-0;
    }
  }

  :deep(a) {
    @apply text-nc-content-brand underline;
  }

  :deep(blockquote) {
    @apply border-l-2 border-nc-border-gray-medium pl-2 my-1 text-nc-content-gray-subtle;
  }
}

// Simple fade for show-more button
.nc-fade-enter-active,
.nc-fade-leave-active {
  transition: opacity 150ms ease;
}

.nc-fade-enter-from,
.nc-fade-leave-to {
  opacity: 0;
}
</style>
