<script setup lang="ts">
import type { ChatContentBlock, ChatMessageType } from 'nocodb-sdk'
import { ChatMessageRole, ChatToolCallStatus } from 'nocodb-sdk'
import { type NcChatRendererOptions, parseChatMarkdown } from '~/ee/utils/chatMarkdown'

interface Props {
  message?: ChatMessageType
  content?: string
  role?: string
  streamingParts?: ChatContentBlock[]
}

const props = withDefaults(defineProps<Props>(), {
  message: undefined,
  content: '',
  role: undefined,
  streamingParts: undefined,
})

const emits = defineEmits<{
  approveAll: [messageId: string, toolCallIds: string[]]
  denyAll: [messageId: string, toolCallIds: string[]]
}>()

const { message, content, role, streamingParts } = toRefs(props)

const { t } = useI18n()

const messageRole = computed(() => message.value?.role || role.value || ChatMessageRole.USER)
const messageContent = computed(() => message.value?.content || content.value || '')
const messageFiles = computed(() => message.value?.files || [])
const isUser = computed(() => messageRole.value === ChatMessageRole.USER)
const isAssistant = computed(() => messageRole.value === ChatMessageRole.ASSISTANT)

const displayParts = computed<ChatContentBlock[]>(() => {
  if (streamingParts.value?.length) return streamingParts.value
  return message.value?.parts || []
})

const hasParts = computed(() => displayParts.value.length > 0)

type ToolUseBlock = Extract<ChatContentBlock, { type: 'tool_use' }>
type DisplaySegment = { kind: 'text'; text: string } | { kind: 'tools'; blocks: ToolUseBlock[] }

// Extract artifact schema from hidden generate_artifact_schema tool blocks
const artifactSchema = computed(() => {
  for (const part of displayParts.value) {
    if (part.type !== 'tool_use') continue
    const block = part as ToolUseBlock
    const name = block.name === 'base_proxy' ? (block.input?.tool_name as string) : block.name
    if (name !== 'generate_artifact_schema' || !block.output) continue
    try {
      const output = typeof block.output === 'string' ? JSON.parse(block.output) : block.output
      if (output?.type === 'artifact_schema' && Array.isArray(output?.columns)) {
        return { title: output.title, description: output.description, columns: output.columns }
      }
    } catch {
      // ignore
    }
  }
  return undefined
})

// All tool blocks for ThinkingSection — includes hidden tools, but excludes announce (internal only)
const thinkingBlocks = computed<ToolUseBlock[]>(() => {
  return displayParts.value.filter((p): p is ToolUseBlock => p.type === 'tool_use' && (p as ToolUseBlock).name !== 'announce')
})

const displaySegments = computed<DisplaySegment[]>(() => {
  const parts = displayParts.value
  const segments: DisplaySegment[] = []
  for (const part of parts) {
    if (part.type === 'text') {
      segments.push({ kind: 'text', text: part.text || '' })
    } else if (part.type === 'tool_use') {
      // Only include visible tool blocks (e.g. awaiting_approval) in display segments
      if (part.visibility === 'hidden') continue

      const last = segments[segments.length - 1]
      if (last?.kind === 'tools') {
        last.blocks.push(part as ToolUseBlock)
      } else {
        segments.push({ kind: 'tools', blocks: [part as ToolUseBlock] })
      }
    }
  }

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

const textSegments = computed(() => displaySegments.value.filter((s) => s.kind === 'text') as { kind: 'text'; text: string }[])

// During streaming: thinking first (natural order), then text.
// After streaming: text first, then thinking section at the bottom.
const showThinkingFirst = computed(() => !!streamingParts.value?.length)

const pendingApprovalIds = computed(() => {
  return displayParts.value
    .filter((p): p is ToolUseBlock => p.type === 'tool_use' && p.status === ChatToolCallStatus.AWAITING_APPROVAL)
    .map((p) => p.id)
})

const hasPendingApprovals = computed(() => pendingApprovalIds.value.length > 0)

const ncTableComp = resolveComponent('ChatMarkdownTableMention')
const ncFieldComp = resolveComponent('ChatMarkdownFieldMention')
const ncRecordsComp = resolveComponent('ChatMarkdownEmbeddedGrid')
const ncDataComp = resolveComponent('ChatMarkdownVirtualTable')
const ncRecordSourceComp = resolveComponent('ChatMarkdownRecordCitation')
const ncViewComp = resolveComponent('ChatMarkdownViewMention')
const ncDashboardComp = resolveComponent('ChatMarkdownDashboardMention')

const xmlComponents = computed<NcChatRendererOptions['xmlComponents']>(() => ({
  'nc-table': { component: ncTableComp },
  'nc-field': { component: ncFieldComp },
  'nc-records': { component: ncRecordsComp },
  'nc-data': {
    component: ncDataComp,
    ...(artifactSchema.value ? { props: { schema: artifactSchema.value } } : {}),
  },
  'nc-record-source': { component: ncRecordSourceComp },
  'nc-view': { component: ncViewComp },
  'nc-dashboard': { component: ncDashboardComp },
}))

const isStreaming = computed(() => !!streamingParts.value?.length)

const renderedContent = computed(() => {
  if (!messageContent.value || !isAssistant.value) return []
  return parseChatMarkdown(messageContent.value, { xmlComponents: xmlComponents.value, streaming: isStreaming.value })
})

const citationMap = computed(() => {
  const map = new Map<string, number>()
  let counter = 0

  const scanText = (text: string) => {
    for (const match of text.matchAll(/<nc-record-source\s+[^>]*\/?>/g)) {
      const rId = match[0].match(/recordId="([^"]*)"/)
      const tId = match[0].match(/tableId="([^"]*)"/)
      if (rId && tId) {
        const key = `${tId[1]}:${rId[1]}`
        if (!map.has(key)) {
          map.set(key, ++counter)
        }
      }
    }
  }

  if (hasParts.value) {
    for (const part of displayParts.value) {
      if (part.type === 'text') {
        scanText((part as any).text || '')
      }
    }
  } else if (messageContent.value) {
    scanText(messageContent.value)
  }

  return map
})

// URL citation map: maps each <nc-url-source url="..."> URL to a sequential number
const urlCitationMap = computed(() => {
  const map = new Map<string, number>()
  let counter = 0
  const scanText = (text: string) => {
    for (const match of text.matchAll(/<nc-url-source\s+url="([^"]*)"\s*\/>/g)) {
      const url = match[1]
      if (url && !map.has(url)) map.set(url, ++counter)
    }
  }
  if (hasParts.value) {
    for (const part of displayParts.value) {
      if (part.type === 'text') scanText((part as any).text || '')
    }
  } else if (messageContent.value) {
    scanText(messageContent.value)
  }
  return map
})

// Web source metadata map: maps URL to { title, favicon } from web_search/web_scrape results
const webSourceMetaMap = computed(() => {
  const map = new Map<string, { title?: string; favicon?: string }>()
  for (const block of thinkingBlocks.value) {
    const webResults = (block.metadata as any)?.webResults
    if (Array.isArray(webResults)) {
      for (const r of webResults) {
        if (r.url && !map.has(r.url)) map.set(r.url, { title: r.title, favicon: r.favicon })
      }
    }
  }
  return map
})

provide('ChatCitationMap', citationMap)
provide('ChatUrlCitationMap', urlCitationMap)
provide('ChatWebSourceMetaMap', webSourceMetaMap)
const renderMarkdown = (text: string) => {
  if (!text) return []
  return parseChatMarkdown(text, { xmlComponents: xmlComponents.value, streaming: isStreaming.value })
}
</script>

<template>
  <div class="nc-chat-message" :class="{ 'nc-chat-message-user': isUser, 'nc-chat-message-assistant': isAssistant }">
    <template v-if="isUser">
      <div class="flex flex-col items-end gap-1.5">
        <div v-if="messageFiles.length" class="flex items-center gap-1.5 flex-wrap justify-end max-w-[80%]">
          <div
            v-for="(file, fi) in messageFiles"
            :key="fi"
            class="nc-chat-message-file flex items-center gap-2 px-2 py-1.5 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default max-w-52"
          >
            <GeneralIcon :icon="getAttachmentIcon(file.title, file.mimetype)" class="w-9 h-9 flex-none" />
            <div class="flex flex-col min-w-0 flex-1">
              <NcTooltip :title="file.title" show-on-truncate-only class="truncate leading-tight">
                <span class="text-small text-nc-content-gray-emphasis">{{ file.title }}</span>
              </NcTooltip>
              <span class="text-captionSm text-nc-content-gray-subtle leading-tight">{{
                getFileTypeLabel(file.title, file.mimetype)
              }}</span>
            </div>
          </div>
        </div>
        <div v-if="messageContent" class="max-w-[80%] rounded-xl px-3 py-2.5 bg-nc-brand-50">
          <div class="whitespace-pre-wrap break-words text-bodyLg text-nc-content-gray">
            {{ messageContent }}
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="isAssistant">
      <div class="min-w-0">
        <template v-if="hasParts">
          <div class="space-y-3">
            <template v-if="showThinkingFirst">
              <ChatThinkingSection v-if="thinkingBlocks.length" :blocks="thinkingBlocks" :is-streaming="true" />
              <div v-for="(seg, si) in textSegments" :key="si" class="nc-chat-markdown text-nc-content-gray break-words">
                <component :is="() => renderMarkdown(seg.text)" />
              </div>
            </template>
            <template v-else>
              <div v-for="(seg, si) in textSegments" :key="si" class="nc-chat-markdown text-nc-content-gray break-words">
                <component :is="() => renderMarkdown(seg.text)" />
              </div>
              <ChatThinkingSection v-if="thinkingBlocks.length" :blocks="thinkingBlocks" :is-streaming="false" />
            </template>
            <template v-for="(seg, si) in displaySegments" :key="`approval-${si}`">
              <template v-if="seg.kind === 'tools' && seg.blocks.some((b) => b.status === 'awaiting_approval')">
                <div class="space-y-1">
                  <ChatToolsCall
                    v-for="(b, bi) in seg.blocks.filter((bl) => bl.status === 'awaiting_approval')"
                    :key="b.id"
                    :block="b"
                    :index="bi"
                  />
                </div>
              </template>
            </template>
          </div>

          <div
            v-if="hasPendingApprovals"
            class="nc-chat-approval-bar flex items-center justify-between gap-2 mt-2 pt-2 border-t-1 border-nc-orange-200"
          >
            <span class="text-captionSm text-orange-700">
              {{ t('msg.chat.pendingApprovalCount', { count: pendingApprovalIds.length }, pendingApprovalIds.length) }}
            </span>
            <div class="flex items-center gap-1.5">
              <NcButton
                size="small"
                type="text"
                class="!text-nc-content-red-dark"
                @click="emits('denyAll', message?.id!, pendingApprovalIds)"
              >
                {{ t('msg.chat.denyAllTools') }}
              </NcButton>
              <NcButton size="small" type="primary" @click="emits('approveAll', message?.id!, pendingApprovalIds)">
                {{ t('msg.chat.approveAllTools') }}
              </NcButton>
            </div>
          </div>
        </template>
        <template v-else>
          <div v-if="renderedContent.length" class="nc-chat-markdown text-nc-content-gray break-words">
            <component :is="() => renderedContent" />
          </div>
        </template>
        <ChatFeedbackButtons
          v-if="!isStreaming && message?.id && message?.fk_session_id"
          :session-id="message.fk_session_id"
          :message-id="message.id"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-markdown {
  @apply text-bodyLg;
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

  :deep(li > ul),
  :deep(li > ol) {
    @apply mt-1.5 mb-0 pl-5;
  }

  :deep(code) {
    @apply font-mono text-bodySm bg-nc-bg-gray-light rounded px-1 py-0.5;
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

  :deep(.nc-md-table) {
    @apply w-full my-3 text-bodyDefaultSm border-1 border-nc-border-gray-medium rounded-lg overflow-hidden;
    border-collapse: separate;
    border-spacing: 0;
  }

  :deep(.nc-md-table th) {
    @apply text-left font-semibold text-nc-content-gray-subtle bg-nc-bg-gray-light px-2.5 py-1.5 border-b-1 border-nc-border-gray-medium;
  }

  :deep(.nc-md-table th:not(:last-child)) {
    @apply border-r-1 border-nc-border-gray-light;
  }

  :deep(.nc-md-table td) {
    @apply text-left text-nc-content-gray px-2.5 py-1.5 border-b-1 border-nc-border-gray-light;
  }

  :deep(.nc-md-table td:not(:last-child)) {
    @apply border-r-1 border-nc-border-gray-light;
  }

  :deep(.nc-md-table tr:last-child td) {
    @apply border-b-0;
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
</style>
