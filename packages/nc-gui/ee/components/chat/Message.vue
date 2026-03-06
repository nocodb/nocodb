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
  approveAll: [messageId: string, toolCallIds: string[]]
  denyAll: [messageId: string, toolCallIds: string[]]
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

  // Hide text that immediately precedes an ask_user tool — the Options card renders it
  const filtered: DisplaySegment[] = []
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const next = segments[i + 1]
    if (seg.kind === 'text' && next?.kind === 'tools' && next.blocks.every((b) => b.name === 'ask_user')) {
      continue
    }
    filtered.push(seg)
  }
  return filtered
})

// Collect all AWAITING_APPROVAL tool IDs from this message
const pendingApprovalIds = computed(() => {
  return displayParts.value
    .filter(
      (p): p is Extract<ChatContentBlock, { type: 'tool_use' }> =>
        p.type === 'tool_use' && p.status === ChatToolCallStatus.AWAITING_APPROVAL,
    )
    .map((p) => p.id)
})

const hasPendingApprovals = computed(() => pendingApprovalIds.value.length > 0)

// Track which tool groups are expanded (keyed by first tool's id)
const expandedGroups = ref(new Set<string>())

const toggleGroup = (groupKey: string) => {
  if (expandedGroups.value.has(groupKey)) {
    expandedGroups.value.delete(groupKey)
  } else {
    expandedGroups.value.add(groupKey)
  }
}

// Check if a tool group has any tools awaiting approval
const groupHasPendingApproval = (blocks: Extract<ChatContentBlock, { type: 'tool_use' }>[]) => {
  return blocks.some((b) => b.status === ChatToolCallStatus.AWAITING_APPROVAL)
}

// A group is considered expanded if manually expanded OR forced by pending approvals
const isGroupExpanded = (blocks: Extract<ChatContentBlock, { type: 'tool_use' }>[]) => {
  return expandedGroups.value.has(blocks[0].id) || groupHasPendingApproval(blocks)
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
  <div class="nc-chat-message" :class="{ 'nc-chat-message-user': isUser, 'nc-chat-message-assistant': isAssistant }">
    <!-- User message: right-aligned bubble -->
    <template v-if="isUser">
      <div class="flex justify-end">
        <div class="max-w-[80%] rounded-xl px-3 py-2.5 bg-nc-brand-50">
          <div class="text-sm whitespace-pre-wrap break-words leading-relaxed text-nc-gray-600">
            {{ messageContent }}
          </div>
        </div>
      </div>
    </template>

    <!-- Assistant message: full-width content block with AI icon -->
    <template v-else-if="isAssistant">
      <div class="flex gap-2">
        <!-- AI icon -->
        <div class="flex-none w-6 h-6 rounded-md bg-nc-bg-brand-soft flex items-center justify-center mt-0.5">
          <GeneralIcon icon="ncAutoAwesome" class="w-3.5 h-3.5 text-nc-content-brand" />
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <!-- Parts-based rendering with tool grouping -->
          <template v-if="hasParts">
            <div class="space-y-2">
              <template v-for="(seg, si) in displaySegments" :key="si">
                <!-- Text segment -->
                <div
                  v-if="seg.kind === 'text' && seg.text"
                  v-dompurify-html="renderMarkdown(seg.text)"
                  class="nc-chat-markdown nc-rich-text-content text-nc-gray-600 break-words"
                />

                <!-- Tool group: single tool → show directly; multiple → collapsible group -->
                <template v-else-if="seg.kind === 'tools'">
                  <!-- Single tool — no grouping needed -->
                  <ChatToolCall v-if="seg.blocks.length === 1" :block="seg.blocks[0]" :index="0" />

                  <!-- Multiple consecutive tools — collapsed group -->
                  <div v-else class="nc-chat-tool-group">
                    <!-- Always show first tool -->
                    <ChatToolCall :block="seg.blocks[0]" :index="0" />

                    <!-- "+N more" toggle — hidden when group has pending approvals (forced open) -->
                    <button
                      v-if="!groupHasPendingApproval(seg.blocks)"
                      class="nc-chat-tool-group-toggle flex items-center gap-1 px-2.5 py-1 text-[11px] text-nc-content-gray-subtle hover:text-nc-content-gray transition-colors"
                      @click="toggleGroup(seg.blocks[0].id)"
                    >
                      <GeneralLoader v-if="isGroupRunning(seg.blocks)" :size="12" class="flex-none" />
                      <GeneralIcon
                        v-else
                        icon="chevronDown"
                        class="flex-none w-3 h-3 transition-transform duration-200"
                        :class="{ 'rotate-180': isGroupExpanded(seg.blocks) }"
                      />
                      <span v-if="isGroupRunning(seg.blocks)">
                        {{ `${completedCount(seg.blocks)}/${seg.blocks.length}` }}
                      </span>
                      <span v-else-if="!isGroupExpanded(seg.blocks)">
                        {{ `+${seg.blocks.length - 1} more` }}
                      </span>
                      <span v-else>{{ t('msg.chat.showLess') }}</span>
                    </button>

                    <!-- Expanded: remaining tools -->
                    <template v-if="isGroupExpanded(seg.blocks)">
                      <ChatToolCall v-for="(b, bi) in seg.blocks.slice(1)" :key="b.id" :block="b" :index="bi + 1" />
                    </template>
                  </div>
                </template>
              </template>
            </div>

            <!-- Batch approval bar -->
            <div
              v-if="hasPendingApprovals"
              class="nc-chat-approval-bar flex items-center justify-between gap-2 mt-2 pt-2 border-t-1 border-nc-border-yellow"
            >
              <span class="text-[12px] font-medium text-nc-content-yellow-dark">
                {{ t('msg.chat.pendingApprovalCount', { count: pendingApprovalIds.length }, pendingApprovalIds.length) }}
              </span>
              <div class="flex items-center gap-1.5">
                <NcButton
                  size="xxsmall"
                  type="text"
                  class="!text-nc-content-red-dark !h-5.5 !px-2 text-[11px] font-medium"
                  @click="emits('denyAll', message?.id!, pendingApprovalIds)"
                >
                  {{ t('msg.chat.denyAllTools') }}
                </NcButton>
                <NcButton
                  size="xxsmall"
                  type="primary"
                  class="!h-5.5 !px-2.5 text-[11px] font-medium"
                  @click="emits('approveAll', message?.id!, pendingApprovalIds)"
                >
                  {{ t('msg.chat.approveAllTools') }}
                </NcButton>
              </div>
            </div>

            <!-- Streaming indicator -->
            <div v-if="isStreaming" class="flex items-center gap-1 mt-2 pt-1.5">
              <span class="nc-chat-dot" />
              <span class="nc-chat-dot" style="animation-delay: 160ms" />
              <span class="nc-chat-dot" style="animation-delay: 320ms" />
              <span class="text-[11px] text-nc-content-gray-muted ml-1">{{ t('msg.chat.working') }}</span>
            </div>
          </template>

          <!-- Fallback: text-only assistant message without parts -->
          <template v-else>
            <div
              v-if="renderedContent"
              v-dompurify-html="renderedContent"
              class="nc-chat-markdown nc-rich-text-content text-nc-gray-600 break-words"
            />
          </template>

          <!-- Pre-first-event spinner (standalone loading message) -->
          <template v-if="isStreaming && !hasParts">
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

// Chat markdown — 13px to match grid cells, generous spacing
.nc-chat-markdown {
  font-size: 14px;
  line-height: 1.6;

  :deep(p) {
    @apply mb-3 last:mb-0;
  }

  :deep(h1) {
    @apply font-semibold mb-2 mt-4 first:mt-0;
    font-size: 1.125rem;
  }

  :deep(h2) {
    @apply font-semibold mb-2 mt-3 first:mt-0;
    font-size: 1rem;
  }

  :deep(h3) {
    @apply font-semibold mb-1.5 mt-3 first:mt-0;
    font-size: 0.875rem;
  }

  :deep(ol) {
    @apply pl-5 my-3;
  }

  :deep(ul) {
    @apply pl-5 my-2;
  }

  :deep(ol > li) {
    list-style-type: decimal;
    @apply mb-2 last:mb-0 pl-1;
  }

  :deep(ul > li) {
    list-style-type: disc;
    @apply mb-1.5 last:mb-0 pl-1;
  }

  // Nested lists — tighter spacing, more indentation
  :deep(li > ul),
  :deep(li > ol) {
    @apply mt-1.5 mb-0 pl-5;
  }

  :deep(code) {
    @apply font-mono text-[12px] bg-nc-bg-gray-light rounded px-1 py-0.5;
  }

  :deep(pre) {
    @apply rounded-md p-2 my-3 overflow-x-auto nc-scrollbar-thin bg-nc-bg-gray-light;

    code {
      @apply bg-transparent p-0;
    }
  }

  :deep(a) {
    @apply text-nc-content-brand underline;
  }

  :deep(blockquote) {
    @apply border-l-2 border-nc-border-gray-medium pl-3 my-3 text-nc-content-gray-subtle;
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
