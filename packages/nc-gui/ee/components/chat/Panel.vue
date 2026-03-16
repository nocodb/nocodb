<script setup lang="ts">
import type { ChatAttachmentType, ChatContentBlock, TableType, ViewType } from 'nocodb-sdk'
import { ChatMessageRole, ChatToolCallStatus } from 'nocodb-sdk'

const { isPanelExpanded, chatPanelWidth, isResizing, isFullScreen, isSidebarOpen, startResize, toggleFullScreen, toggleSidebar } =
  useChatPanel()

const { blockAiChat, isEEFeatureBlocked } = useEeConfig()

const chatStore = useChatStore()

const {
  activeMessages,
  isSendingMessage,
  isLoadingMessages,
  activeSession,
  sessionList,
  isLoadingSessions,
  activeStreamingParts,
  visibleStreamingParts,
  followUps,
} = storeToRefs(chatStore)

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const { base } = storeToRefs(useBase())

const { $e } = useNuxtApp()

const messageListRef = ref<HTMLDivElement>()

const chatInputRef = ref<{ uploadFiles: (files: FileList | File[]) => Promise<void> }>()

const emptyStateInputRef = ref<{ uploadFiles: (files: FileList | File[]) => Promise<void> }>()

const isDragOverPanel = ref(false)

const dragLeaveTimeout = ref<ReturnType<typeof setTimeout>>()

const hasLoadedSessions = ref(false)

const dismissedQuestionIds = ref(new Set<string>())

const isNearBottom = ref(true)

const isEmptyState = computed(() => !activeMessages.value.length && !isSendingMessage.value)

const sessionTitle = computed(() => {
  const title = activeSession.value?.title
  if (!title || title === 'New Chat') return ''
  return title
})

const pendingQuestion = computed(() => {
  const msgs = activeMessages.value
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (!m) continue
    if (m.role === ChatMessageRole.USER) return null
    if (m.role === ChatMessageRole.ASSISTANT) {
      const block = m.parts?.find(
        (p): p is Extract<ChatContentBlock, { type: 'tool_use' }> =>
          p.type === 'tool_use' && p.status === ChatToolCallStatus.AWAITING_INPUT,
      )
      if (!block) return null
      let output: any = block.output
      if (typeof output === 'string') {
        try {
          output = JSON.parse(output)
        } catch {
          return null
        }
      }
      let questions: { question: string; options: string[] }[]
      if (output?.questions && Array.isArray(output.questions)) {
        questions = output.questions
      } else if (output?.question && output?.options) {
        questions = [{ question: output.question, options: output.options }]
      } else {
        return null
      }
      return { toolCallId: block.id, questions }
    }
  }
  return null
})

const showScrollButton = computed(() => !isNearBottom.value && activeMessages.value.length > 0)

// Show AgentStatus only during the initial phase before any tool steps appear
const hasVisibleStreamingTools = computed(() => visibleStreamingParts.value?.some((p) => p.type === 'tool_use') ?? false)

const latestAssistantMessage = computed(() => {
  const msgs = activeMessages.value
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.role === ChatMessageRole.ASSISTANT) return msgs[i]
  }
  return undefined
})

const latestFollowUps = computed<string[] | undefined>(() => {
  const msg = latestAssistantMessage.value
  return msg?.id ? followUps.value.get(msg.id) : undefined
})

const panelWidthStyle = computed(() => {
  if (isFullScreen.value) {
    return { width: 'calc(100vw - var(--mini-sidebar-width))' }
  }
  return { width: `${chatPanelWidth.value}px` }
})

const scrollToBottom = (force = false) => {
  nextTick(() => {
    requestAnimationFrame(() => {
      if (messageListRef.value && (force || isNearBottom.value)) {
        messageListRef.value.scrollTop = messageListRef.value.scrollHeight
        isNearBottom.value = true
      }
    })
  })
}

const debouncedScrollToBottom = useDebounceFn(() => scrollToBottom(), 100)

const checkIfNearBottom = useThrottleFn(() => {
  const el = messageListRef.value
  if (!el) return
  isNearBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}, 100)

const handleSend = async (content: string, files?: ChatAttachmentType[]) => {
  $e('a:chat:message:send', { hasFiles: !!files?.length })

  const trimmed = content.trim()
  const title = !chatStore.activeSessionId ? (trimmed.length > 50 ? `${trimmed.slice(0, 47)}...` : trimmed) : undefined

  await chatStore.sendMessage(content, title, files)
}

const handleNewSession = () => {
  $e('c:chat:session:new')
  chatStore.activeSessionId = null
}

const handleDeleteSession = async (sessionId: string) => {
  $e('a:chat:session:delete')
  await chatStore.deleteSession(sessionId)
}

const handleSelectSession = (sessionId: string) => {
  $e('c:chat:session:select')
  chatStore.activeSessionId = sessionId
}

const handleRenameSession = async (sessionId: string, title: string) => {
  $e('a:chat:session:rename')
  await chatStore.renameSession(sessionId, title)
}

const handleOptionSelect = (choice: string) => {
  $e('c:chat:option:select')
  handleSend(choice)
}

const handleOptionSkip = () => {
  if (pendingQuestion.value) {
    $e('c:chat:option:skip')
    dismissedQuestionIds.value = new Set([...dismissedQuestionIds.value, pendingQuestion.value.toolCallId])
  }
}

const handleApproveAll = async (messageId: string, toolCallIds: string[]) => {
  if (!chatStore.activeSessionId) return
  $e('a:chat:tool:approve', { count: toolCallIds.length })
  const decisions: Record<string, 'approved' | 'denied'> = {}
  for (const id of toolCallIds) decisions[id] = 'approved'
  await chatStore.approveToolCalls(chatStore.activeSessionId, messageId, decisions)
}

const handleDenyAll = async (messageId: string, toolCallIds: string[]) => {
  if (!chatStore.activeSessionId) return
  $e('a:chat:tool:deny', { count: toolCallIds.length })
  const decisions: Record<string, 'approved' | 'denied'> = {}
  for (const id of toolCallIds) decisions[id] = 'denied'
  await chatStore.approveToolCalls(chatStore.activeSessionId, messageId, decisions)
}

watch(
  () => chatStore.activeSessionId,
  async (sessionId) => {
    dismissedQuestionIds.value = new Set()

    if (sessionId) {
      await chatStore.loadMessages(sessionId)
      scrollToBottom(true)
    }
  },
)

watch(
  () => activeMessages.value.length,
  () => scrollToBottom(),
)

watch(activeStreamingParts, () => debouncedScrollToBottom(), { deep: true })

// Initialize socket + load sessions when panel opens and base is ready.
// blockAiChat starts false on cloud (data not loaded) — skip init until resolved.
watch(
  [isPanelExpanded, activeWorkspaceId, () => base.value?.id, blockAiChat],
  async ([expanded, wsId, baseId, blocked], [, oldWsId, oldBaseId]) => {
    if ((wsId && wsId !== oldWsId) || (baseId && baseId !== oldBaseId)) {
      hasLoadedSessions.value = false
      chatStore.reset()
    }

    if (expanded && wsId && baseId && !blocked) {
      chatStore.initChatSocket()

      if (!hasLoadedSessions.value) {
        hasLoadedSessions.value = true
        await chatStore.loadSessions(wsId, baseId)
      }

      scrollToBottom(true)
    }
  },
  { immediate: true },
)

watch(latestFollowUps, (val) => {
  if (val?.length) scrollToBottom()
})

onUnmounted(() => chatStore.destroyChatSocket())

const { getMeta } = useMetas()

const { activeProjectId } = storeToRefs(useBases())

const citationMeta = ref<TableType>()

const citationActiveSource = computed(() => {
  return citationMeta.value?.source_id && base.value?.sources?.find((s) => s.id === citationMeta.value?.source_id)
})

provide(
  MetaInj,
  computed(() => citationMeta.value),
)
provide(ActiveSourceInj, citationActiveSource)
provide(IsGridInj, ref(true))
provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(false))
provide(IsCalendarInj, ref(false))
provide(IsPublicInj, ref(false))
provide(IsExpandedFormOpenInj, ref(false))
provide(RowHeightInj, ref(1 as const))

const citationReloadHook = createEventHook()
provide(ReloadViewDataHookInj, citationReloadHook)
provide(ReloadRowDataHookInj, citationReloadHook)

const undefinedView = ref(undefined as unknown as ViewType)
useProvideSmartsheetLtarHelpers(computed(() => citationMeta.value))
useProvideSmartsheetStore(
  undefinedView,
  computed(() => citationMeta.value),
)
useProvideKanbanViewStore(
  computed(() => citationMeta.value),
  undefinedView,
)
useProvideViewColumns(
  undefinedView,
  computed(() => citationMeta.value),
)

const { open: openCitationExpandedForm } = useExpandedFormDetached()

const handleOpenCitationRecord = async (tableId: string, recordId: string, recordData?: Record<string, any>) => {
  if (!activeProjectId.value) return

  try {
    const meta = (await getMeta(activeProjectId.value, tableId)) as TableType
    if (!meta) return

    citationMeta.value = meta

    await nextTick()

    openCitationExpandedForm({
      isOpen: true,
      row: { row: recordData ? { ...recordData } : {}, oldRow: recordData ? { ...recordData } : {}, rowMeta: {} },
      meta,
      loadRow: true,
      rowId: recordId,
      useMetaFields: true,
    })
  } catch (e: any) {
    console.warn('Failed to open citation record:', e)
  }
}

provide('OpenCitationRecord', handleOpenCitationRecord)

const handlePanelDragOver = (e: DragEvent) => {
  if (isSendingMessage.value) return
  e.preventDefault()

  if (dragLeaveTimeout.value) {
    clearTimeout(dragLeaveTimeout.value)
    dragLeaveTimeout.value = undefined
  }

  isDragOverPanel.value = true
}

const handlePanelDragLeave = () => {
  // Debounce drag leave to avoid flicker when moving between child elements
  dragLeaveTimeout.value = setTimeout(() => {
    isDragOverPanel.value = false
  }, 50)
}

const handlePanelDrop = async (e: DragEvent) => {
  if (isSendingMessage.value) return
  e.preventDefault()
  isDragOverPanel.value = false

  if (!e.dataTransfer?.files?.length) return

  $e('c:chat:file-drop', { count: e.dataTransfer.files.length })

  const target = chatInputRef.value || emptyStateInputRef.value
  if (target) {
    await target.uploadFiles(e.dataTransfer.files)
  }
}
</script>

<template>
  <LazySmartsheetExpandedFormDetached />
  <Transition name="nc-chat-slide">
    <div
      v-show="isPanelExpanded"
      class="nc-chat-panel"
      :class="{ 'nc-chat-panel-resizing': isResizing, 'nc-chat-panel-fullscreen': isFullScreen }"
      :style="panelWidthStyle"
      @keydown.stop
      @dragover="handlePanelDragOver"
      @dragleave="handlePanelDragLeave"
      @drop="handlePanelDrop"
    >
      <!-- Drop overlay -->
      <Transition name="nc-fade">
        <div v-if="isDragOverPanel" class="nc-chat-drop-overlay">
          <div class="nc-chat-drop-overlay-content">
            <GeneralIcon icon="ncUpload" class="w-8 h-8 text-nc-content-brand" />
            <span class="text-body text-nc-content-gray-emphasis mt-2">Drop files here</span>
            <span class="text-bodySm text-nc-content-gray-subtle">CSV, PDF, JSON, Excel, TXT, MD</span>
          </div>
        </div>
      </Transition>
      <div v-if="!isFullScreen" class="nc-chat-resize-handle" @mousedown="startResize" />
      <div class="flex h-full min-w-0">
        <div v-if="isFullScreen" class="nc-chat-sidebar-wrapper" :class="{ 'nc-chat-sidebar-open': isSidebarOpen }">
          <ChatSessionSidebar
            :sessions="sessionList"
            :active-session-id="activeSession?.id"
            :is-loading="isLoadingSessions"
            @select="handleSelectSession"
            @delete="handleDeleteSession"
            @rename="handleRenameSession"
            @new-chat="handleNewSession"
            @close="toggleSidebar"
          />
        </div>

        <div class="flex flex-col h-full min-w-0 flex-1">
          <ChatHeader
            :session-title="sessionTitle"
            :active-session="activeSession"
            :session-list="sessionList"
            :is-full-screen="isFullScreen"
            :is-sidebar-open="isSidebarOpen"
            @new-chat="handleNewSession"
            @close="isPanelExpanded = false"
            @toggle-full-screen="toggleFullScreen"
            @toggle-sidebar="toggleSidebar"
            @select-session="handleSelectSession"
            @delete-session="handleDeleteSession"
            @rename-session="handleRenameSession"
          />

          <div class="flex-1 overflow-hidden relative">
            <div ref="messageListRef" class="h-full overflow-y-auto nc-scrollbar-thin" @scroll="checkIfNearBottom">
              <div
                :class="[
                  { 'max-w-800px mx-auto w-full': isFullScreen },
                  { 'min-h-full flex flex-col justify-center': isEmptyState },
                ]"
              >
                <div v-if="isLoadingSessions || isLoadingMessages" class="flex items-center justify-center h-full">
                  <GeneralLoader size="large" />
                </div>
                <template v-else>
                  <ChatEmptyState v-if="isEmptyState" ref="emptyStateInputRef" @prompt="handleSend" />
                  <div v-else class="space-y-4" :class="isFullScreen ? 'p-4' : 'px-6 py-4'">
                    <ChatMessage
                      v-for="msg in activeMessages"
                      :key="msg.id"
                      :message="msg"
                      :streaming-parts="msg.id.startsWith('streaming-') ? visibleStreamingParts : undefined"
                      @approve-all="handleApproveAll"
                      @deny-all="handleDenyAll"
                    />
                    <ChatAgentStatus v-if="!hasVisibleStreamingTools" />
                    <ChatFollowUps
                      v-if="latestFollowUps?.length && !isSendingMessage"
                      :suggestions="latestFollowUps"
                      @select="handleSend"
                    />
                  </div>
                </template>
              </div>
            </div>
            <Transition name="nc-fade">
              <div v-if="showScrollButton" class="nc-chat-scroll-btn-wrapper" data-testid="nc-chat-scroll-to-bottom">
                <NcTooltip :title="$t('general.scrollToBottom')" placement="top" :arrow="false">
                  <NcButton size="small" type="secondary" class="nc-chat-scroll-btn" @click="scrollToBottom(true)">
                    <GeneralIcon icon="arrowDown" class="w-4 h-4" />
                  </NcButton>
                </NcTooltip>
              </div>
            </Transition>
          </div>
          <Transition name="nc-slide-up">
            <ChatOptions
              v-if="pendingQuestion && !dismissedQuestionIds.has(pendingQuestion.toolCallId) && !isSendingMessage"
              :questions="pendingQuestion.questions"
              class="mx-3 mb-2"
              :class="{ 'max-w-800px mx-auto w-full': isFullScreen }"
              @select="handleOptionSelect"
              @skip="handleOptionSkip"
            />
          </Transition>
          <ChatInput
            v-if="!isEmptyState"
            ref="chatInputRef"
            :disabled="isSendingMessage"
            :class="{ 'max-w-800px mx-auto w-full': isFullScreen }"
            @send="handleSend"
            @cancel="chatStore.cancelSending"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.nc-chat-panel {
  @apply fixed top-0 right-0 h-full flex flex-col bg-nc-bg-default;

  z-index: 100;
  border-left: 1px solid var(--nc-border-gray-medium);
  box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.16), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
  transition: width 250ms ease, box-shadow 250ms ease, border-left-color 250ms ease;
}

.nc-chat-panel-resizing {
  transition: none;
}

.nc-chat-panel-fullscreen {
  box-shadow: none;
  border-left-color: transparent;
}

.nc-chat-sidebar-wrapper {
  width: 0;
  min-width: 0;
  overflow: hidden;
  transition: width 250ms ease, min-width 250ms ease;
}

.nc-chat-sidebar-open {
  width: 260px;
  min-width: 260px;
  overflow: visible;
}

.nc-chat-slide-enter-active,
.nc-chat-slide-leave-active {
  transition: opacity 150ms ease;
}

.nc-chat-slide-enter-from,
.nc-chat-slide-leave-to {
  opacity: 0;
}

.nc-chat-resize-handle {
  @apply absolute top-0 h-full cursor-col-resize z-50;
  left: -4px;
  width: 12px;

  &::before {
    content: '';
    @apply absolute top-0 h-full w-0.5 rounded-full;
    left: 4px;
    opacity: 0;
    background-color: var(--nc-border-gray-medium);
    transition: opacity 150ms ease, width 150ms ease;
  }

  &:hover::before {
    opacity: 1;
    width: 3px;
  }
}

.nc-chat-panel-resizing .nc-chat-resize-handle::before {
  @apply bg-nc-border-gray-medium;
  width: 3px;
}

.nc-chat-scroll-btn-wrapper {
  @apply absolute left-0 right-0 flex justify-center;
  bottom: 8px;
  z-index: 10;
  pointer-events: none;
}

.nc-chat-scroll-btn {
  @apply !rounded-full !w-8 !h-8 !shadow-md !border-nc-border-gray-medium;
  pointer-events: auto;
}

.nc-fade-enter-active,
.nc-fade-leave-active {
  transition: opacity 150ms ease;
}

.nc-fade-enter-from,
.nc-fade-leave-to {
  opacity: 0;
}

.nc-slide-up-enter-active,
.nc-slide-up-leave-active {
  transition: all 200ms ease;
}

.nc-slide-up-enter-from,
.nc-slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.nc-chat-drop-overlay {
  @apply absolute inset-0 z-50 flex items-center justify-center;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(2px);
  pointer-events: none;
}

.nc-chat-drop-overlay-content {
  @apply flex flex-col items-center p-6 rounded-xl border-2 border-dashed border-nc-border-brand;
}
</style>
