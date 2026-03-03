<script setup lang="ts">
import type { ChatContentBlock, ChatMessageType } from 'nocodb-sdk'
import { ChatMessageRole, ChatToolCallStatus } from 'nocodb-sdk'
import { NcMarkdownParser } from '~/helpers/tiptap/functionality/markdown'

interface Props {
  message?: ChatMessageType
  content?: string
  role?: string
  isStreaming?: boolean
  streamingParts?: ChatContentBlock[]
}

const props = withDefaults(defineProps<Props>(), {
  message: undefined,
  content: '',
  role: undefined,
  isStreaming: false,
  streamingParts: undefined,
})

const emits = defineEmits<{
  approve: [messageId: string, toolCallId: string]
  deny: [messageId: string, toolCallId: string]
}>()

const { message, content, role, isStreaming, streamingParts } = toRefs(props)

const { t } = useI18n()

const messageRole = computed(() => message.value?.role || role.value || ChatMessageRole.USER)
const messageContent = computed(() => message.value?.content || content.value || '')
const isUser = computed(() => messageRole.value === ChatMessageRole.USER)
const isAssistant = computed(() => messageRole.value === ChatMessageRole.ASSISTANT)

// Unified parts: active streaming wins; fall back to persisted parts
const displayParts = computed<ChatContentBlock[]>(() => {
  if (streamingParts.value?.length) return streamingParts.value
  return message.value?.parts || []
})

const hasParts = computed(() => displayParts.value.length > 0)

// Group consecutive tool_use blocks so they collapse as "First Tool +N"
type DisplaySegment =
  | { kind: 'text'; text: string }
  | { kind: 'tools'; blocks: Extract<ChatContentBlock, { type: 'tool_use' }>[] }

const displaySegments = computed<DisplaySegment[]>(() => {
  const parts = displayParts.value
  const segments: DisplaySegment[] = []
  for (const part of parts) {
    if (part.type === 'text') {
      segments.push({ kind: 'text', text: part.text || '' })
    } else if (part.type === 'tool_use') {
      const last = segments[segments.length - 1]
      if (last?.kind === 'tools') {
        last.blocks.push(part as Extract<ChatContentBlock, { type: 'tool_use' }>)
      } else {
        segments.push({ kind: 'tools', blocks: [part as Extract<ChatContentBlock, { type: 'tool_use' }>] })
      }
    }
  }
  return segments
})

// Track which tool groups are expanded (keyed by first tool's id)
const expandedGroups = ref(new Set<string>())

const toggleGroup = (groupKey: string) => {
  if (expandedGroups.value.has(groupKey)) {
    expandedGroups.value.delete(groupKey)
  } else {
    expandedGroups.value.add(groupKey)
  }
}

// Check if a tool group has any tools still in progress
const isGroupRunning = (blocks: Extract<ChatContentBlock, { type: 'tool_use' }>[]) => {
  return blocks.some((b) => b.status === ChatToolCallStatus.RUNNING || b.status === ChatToolCallStatus.PENDING)
}

// Count completed tools in a group
const completedCount = (blocks: Extract<ChatContentBlock, { type: 'tool_use' }>[]) => {
  return blocks.filter((b) => b.status !== ChatToolCallStatus.RUNNING && b.status !== ChatToolCallStatus.PENDING).length
}

// Render text as markdown
const renderMarkdown = (text: string) => {
  if (!text) return ''
  return NcMarkdownParser.parse(text, { linkify: true, breaks: true })
}

// Fallback for content-only assistant messages (no parts)
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
      <!-- User message: plain text -->
      <div v-if="messageContent && isUser" class="text-sm whitespace-pre-wrap break-words leading-relaxed text-white">
        {{ messageContent }}
      </div>

      <!-- Assistant message: unified parts rendering with tool grouping -->
      <template v-else-if="isAssistant && hasParts">
        <div class="space-y-2">
          <template v-for="(seg, si) in displaySegments" :key="si">
            <!-- Text segment -->
            <div
              v-if="seg.kind === 'text' && seg.text"
              v-dompurify-html="renderMarkdown(seg.text)"
              class="nc-chat-markdown nc-rich-text-content text-sm text-nc-content-gray-emphasis break-words"
            />

            <!-- Tool group: single tool → show directly; multiple → collapsible group -->
            <template v-else-if="seg.kind === 'tools'">
              <!-- Single tool — no grouping needed -->
              <ChatToolCall
                v-if="seg.blocks.length === 1"
                :block="seg.blocks[0]"
                :index="0"
                @approve="emits('approve', message?.id!, $event)"
                @deny="emits('deny', message?.id!, $event)"
              />

              <!-- Multiple consecutive tools — collapsed group -->
              <div v-else class="nc-chat-tool-group">
                <!-- Always show first tool -->
                <ChatToolCall
                  :block="seg.blocks[0]"
                  :index="0"
                  @approve="emits('approve', message?.id!, $event)"
                  @deny="emits('deny', message?.id!, $event)"
                />

                <!-- "+N more" toggle with group progress -->
                <button
                  class="nc-chat-tool-group-toggle flex items-center gap-1 px-2.5 py-1 text-[11px] text-nc-content-gray-subtle hover:text-nc-content-gray transition-colors"
                  @click="toggleGroup(seg.blocks[0].id)"
                >
                  <!-- Loader while group has running tools -->
                  <GeneralLoader v-if="isGroupRunning(seg.blocks)" :size="12" class="flex-none" />
                  <GeneralIcon
                    v-else
                    icon="chevronDown"
                    class="flex-none w-3 h-3 transition-transform duration-200"
                    :class="{ 'rotate-180': expandedGroups.has(seg.blocks[0].id) }"
                  />
                  <span v-if="isGroupRunning(seg.blocks)">
                    {{ `${completedCount(seg.blocks)}/${seg.blocks.length}` }}
                  </span>
                  <span v-else-if="!expandedGroups.has(seg.blocks[0].id)">
                    {{ `+${seg.blocks.length - 1} more` }}
                  </span>
                  <span v-else>{{ t('msg.chat.showLess') }}</span>
                </button>

                <!-- Expanded: remaining tools -->
                <template v-if="expandedGroups.has(seg.blocks[0].id)">
                  <ChatToolCall
                    v-for="(b, bi) in seg.blocks.slice(1)"
                    :key="b.id"
                    :block="b"
                    :index="bi + 1"
                    @approve="emits('approve', message?.id!, $event)"
                    @deny="emits('deny', message?.id!, $event)"
                  />
                </template>
              </div>
            </template>
          </template>
        </div>
        <!-- Streaming indicator: shown at the end of the message while AI is still working -->
        <div v-if="isStreaming" class="flex items-center gap-1 mt-2 pt-1.5 border-t-1 border-nc-border-gray-light">
          <span class="nc-chat-dot" />
          <span class="nc-chat-dot" style="animation-delay: 160ms" />
          <span class="nc-chat-dot" style="animation-delay: 320ms" />
          <span class="text-[11px] text-nc-content-gray-muted ml-1">{{ t('msg.chat.working') }}</span>
        </div>
      </template>

      <!-- Fallback: text-only assistant message without parts (shouldn't occur for new messages) -->
      <template v-else-if="isAssistant">
        <div
          v-if="renderedContent"
          v-dompurify-html="renderedContent"
          class="nc-chat-markdown nc-rich-text-content text-sm text-nc-content-gray-emphasis break-words"
        />
      </template>

      <!-- Pre-first-event spinner (standalone loading message) -->
      <template v-if="isStreaming && isAssistant && !hasParts">
        <div v-if="!messageContent" class="flex items-center gap-1 py-0.5">
          <span class="nc-chat-dot" />
          <span class="nc-chat-dot" style="animation-delay: 160ms" />
          <span class="nc-chat-dot" style="animation-delay: 320ms" />
        </div>
        <span v-else class="nc-chat-cursor block w-1.5 h-3 mt-0.5 bg-nc-content-gray-muted rounded-sm" />
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

.nc-chat-tool-group {
  @apply space-y-1;
}

.nc-chat-tool-group-toggle {
  @apply rounded-md cursor-pointer select-none;

  &:hover {
    @apply bg-nc-bg-gray-light;
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
