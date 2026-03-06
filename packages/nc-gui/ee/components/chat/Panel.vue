<script setup lang="ts">
import type { ChatContentBlock } from 'nocodb-sdk'
import { ChatMessageRole, ChatToolCallStatus } from 'nocodb-sdk'

const { isPanelExpanded, chatPanelWidth, isResizing, startResize } = useChatPanel()

const { blockAiChat } = useEeConfig()

const chatStore = useChatStore()

const {
  activeMessages,
  isSendingMessage,
  isLoadingMessages,
  activeSession,
  sessionList,
  isLoadingSessions,
  activeStreamingParts,
} = storeToRefs(chatStore)

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const { base } = storeToRefs(useBase())

const { t } = useI18n()

const { $e } = useNuxtApp()

const messageListRef = ref<HTMLDivElement>()

onUnmounted(() => chatStore.destroyChatSocket())

const hasInitialized = ref(false)

const showSessionList = ref(false)

// Inline rename state
const renamingSessionId = ref<string | null>(null)
const renameValue = ref('')
const isRenaming = ref(false)

const renameInputRef = ref<HTMLInputElement>()

const startRename = (sessionId: string | undefined, currentTitle: string) => {
  if (!sessionId) return
  renamingSessionId.value = sessionId
  renameValue.value = currentTitle || ''
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

const confirmRename = async (sessionId: string | null) => {
  if (!sessionId || isRenaming.value) return
  isRenaming.value = true

  const trimmed = renameValue.value.trim()
  if (trimmed && activeWorkspaceId.value) {
    $e('a:chat:session:rename')
    await chatStore.renameSession(activeWorkspaceId.value, sessionId, trimmed)
  }
  renamingSessionId.value = null
  isRenaming.value = false
}

const cancelRename = () => {
  renamingSessionId.value = null
}

// Track dismissed ask_user cards (local — resets when session changes)
const dismissedInputIds = ref(new Set<string>())

watch(
  () => chatStore.activeSessionId,
  () => {
    dismissedInputIds.value = new Set()
  },
)

// Detect the last unanswered ask_user tool call
const pendingUserInput = computed(() => {
  const msgs = activeMessages.value
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (!m) continue
    // If the user has already replied, stop searching
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
      // Support both new multi-question format and legacy single-question format
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

const isNearBottom = ref(true)

const checkIfNearBottom = () => {
  const el = messageListRef.value
  if (!el) return
  isNearBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

const scrollToBottom = (force = false) => {
  nextTick(() => {
    if (messageListRef.value && (force || isNearBottom.value)) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
      isNearBottom.value = true
    }
  })
}

const showScrollButton = computed(() => !isNearBottom.value && activeMessages.value.length > 0)

// Auto-scroll when a new message is appended or streaming content updates
watch(() => activeMessages.value.length, () => scrollToBottom())
watch(activeStreamingParts, () => scrollToBottom(), { deep: true })

// Initialize: ensure socket listener and load sessions when panel opens and workspace is ready.
// Also watch blockAiChat — on cloud, blockAiChat starts false (data not loaded) so isPanelExpanded
// may briefly be true from localStorage. We skip initialization while blockAiChat hasn't resolved.
watch(
  [isPanelExpanded, activeWorkspaceId, blockAiChat],
  async ([expanded, wsId, blocked], [, oldWsId]) => {
    if (wsId && wsId !== oldWsId) {
      // Workspace changed — reset and re-init
      hasInitialized.value = false
      chatStore.reset()
    }

    if (expanded && wsId && !blocked) {
      chatStore.initChatSocket()

      if (!hasInitialized.value) {
        hasInitialized.value = true
        await chatStore.loadSessions(wsId)
      }

      scrollToBottom(true)
    }
  },
  { immediate: true },
)

// Load messages when active session changes, then scroll to bottom
watch(
  () => chatStore.activeSessionId,
  async (sessionId) => {
    if (sessionId && activeWorkspaceId.value) {
      await chatStore.loadMessages(activeWorkspaceId.value, sessionId)
      scrollToBottom(true)
    }
  },
)

const handleSend = async (content: string) => {
  if (!activeWorkspaceId.value) return

  $e('a:chat:message:send')

  // Create session if none exists
  if (!chatStore.activeSessionId) {
    const session = await chatStore.createSession(activeWorkspaceId.value)
    if (!session?.id) return
  }

  await chatStore.sendMessage(activeWorkspaceId.value, chatStore.activeSessionId!, content, base.value?.id)
  scrollToBottom(true)
}

const handleNewSession = () => {
  $e('c:chat:session:new')
  showSessionList.value = false
  chatStore.activeSessionId = null
}

const handleDeleteSession = async (sessionId: string) => {
  if (!activeWorkspaceId.value) return
  $e('a:chat:session:delete')
  await chatStore.deleteSession(activeWorkspaceId.value, sessionId)
}

const handleSelectSession = (sessionId: string) => {
  $e('c:chat:session:select')
  chatStore.activeSessionId = sessionId
  showSessionList.value = false
}

const handleStarterPrompt = (prompt: string) => {
  handleSend(prompt)
}

const handleUserInput = (choice: string) => {
  $e('c:chat:option:select')
  handleSend(choice)
}

const handleSkipInput = () => {
  if (pendingUserInput.value) {
    $e('c:chat:option:skip')
    dismissedInputIds.value = new Set([...dismissedInputIds.value, pendingUserInput.value.toolCallId])
  }
}

const handleApproveAll = async (messageId: string, toolCallIds: string[]) => {
  if (!activeWorkspaceId.value || !chatStore.activeSessionId) return
  $e('a:chat:tool:approve', { count: toolCallIds.length })
  const decisions: Record<string, 'approved' | 'denied'> = {}
  for (const id of toolCallIds) decisions[id] = 'approved'
  await chatStore.approveToolCalls(activeWorkspaceId.value, chatStore.activeSessionId, messageId, decisions, base.value?.id)
}

const handleDenyAll = async (messageId: string, toolCallIds: string[]) => {
  if (!activeWorkspaceId.value || !chatStore.activeSessionId) return
  $e('a:chat:tool:deny', { count: toolCallIds.length })
  const decisions: Record<string, 'approved' | 'denied'> = {}
  for (const id of toolCallIds) decisions[id] = 'denied'
  await chatStore.approveToolCalls(activeWorkspaceId.value, chatStore.activeSessionId, messageId, decisions, base.value?.id)
}
</script>

<template>
  <Transition name="nc-chat-slide">
    <div
      v-show="isPanelExpanded"
      class="nc-chat-panel"
      :class="{ 'nc-chat-panel-resizing': isResizing }"
      :style="{ width: `${chatPanelWidth}px` }"
    >
      <!-- Resize handle -->
      <div class="nc-chat-resize-handle" @mousedown="startResize" />

      <div class="flex flex-col h-full min-w-0">
        <!-- Header -->
        <div
          class="h-[var(--topbar-height)] flex items-center justify-between gap-2 px-3 border-b-1 border-nc-border-gray-medium bg-nc-bg-default flex-none"
        >
          <!-- Left: icon + title -->
          <div class="flex items-center gap-1.5 min-w-0 flex-1">
            <GeneralIcon icon="ncAutoAwesome" class="flex-none w-4 h-4 text-nc-content-brand" />

            <!-- Inline rename input (shown on double-click) -->
            <input
              v-if="renamingSessionId"
              ref="renameInputRef"
              v-model="renameValue"
              class="flex-1 min-w-0 text-sm font-semibold text-nc-content-gray bg-nc-bg-default border-1 border-nc-fill-primary rounded px-1.5 py-0.5 outline-none"
              @keydown.enter.prevent.stop="confirmRename(renamingSessionId)"
              @keydown.escape.prevent.stop="cancelRename"
              @keydown.stop
              @blur="confirmRename(renamingSessionId)"
            />

            <!-- Title with dropdown (when not renaming) -->
            <template v-else>
              <NcDropdown
                v-if="sessionList.length > 1"
                v-model:visible="showSessionList"
                placement="bottomLeft"
                :trigger="['click']"
                class="min-w-0 flex-1"
              >
                <button
                  class="flex items-center gap-1 min-w-0 max-w-full px-1.5 py-0.5 rounded transition-colors hover:bg-nc-bg-gray-light cursor-pointer"
                  @dblclick.stop="startRename(activeSession?.id!, activeSession?.title || '')"
                >
                  <span class="text-sm font-semibold text-nc-content-gray truncate">
                    {{ activeSession?.title || t('labels.newChat') }}
                  </span>
                  <GeneralIcon
                    icon="chevronDown"
                    class="flex-none w-3.5 h-3.5 text-nc-content-gray-subtle transition-transform duration-200"
                    :class="{ 'rotate-180': showSessionList }"
                  />
                </button>

                <template #overlay>
                  <div class="nc-chat-session-menu">
                    <template v-if="sessionList.length > 0">
                      <div class="px-3 py-1">
                        <span class="text-[11px] font-semibold text-nc-content-gray-muted uppercase tracking-wider">
                          {{ t('labels.recentChats') }}
                        </span>
                      </div>

                      <div class="flex flex-col gap-y-0.5 max-h-[280px] overflow-y-auto nc-scrollbar-thin">
                        <div
                          v-for="session in sessionList"
                          :key="session.id"
                          class="group flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
                          :class="{ 'bg-nc-bg-brand-soft': session.id === activeSession?.id }"
                          @click="handleSelectSession(session.id!)"
                        >
                          <GeneralIcon icon="ncMessageSquare" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />

                          <NcTooltip class="flex-1 min-w-0 truncate text-[13px]" show-on-truncate-only>
                            <template #title>{{ session.title || t('labels.newChat') }}</template>
                            <span
                              :class="
                                session.id === activeSession?.id
                                  ? 'text-nc-content-brand font-medium'
                                  : 'text-nc-content-gray-subtle'
                              "
                            >
                              {{ session.title || t('labels.newChat') }}
                            </span>
                          </NcTooltip>

                          <!-- Delete — reveals on hover -->
                          <NcButton
                            size="xxsmall"
                            type="text"
                            class="flex-none !bg-transparent hover:!bg-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                            @click.stop="handleDeleteSession(session.id!)"
                          >
                            <GeneralIcon icon="delete" class="w-3.5 h-3.5 text-nc-content-gray-muted hover:text-nc-content-red" />
                          </NcButton>
                        </div>
                      </div>
                    </template>
                  </div>
                </template>
              </NcDropdown>

              <span
                v-else
                class="text-sm font-semibold text-nc-content-gray truncate cursor-default"
                @dblclick="activeSession?.id && startRename(activeSession.id, activeSession.title || '')"
              >
                {{ activeSession?.title || t('labels.newChat') }}
              </span>
            </template>
          </div>

          <!-- Right: new chat + close -->
          <div class="flex items-center gap-0.5">
            <NcTooltip :title="t('labels.newChat')" placement="bottom" :arrow="false">
              <NcButton size="small" type="text" class="nc-chat-header-btn" @click="handleNewSession">
                <GeneralIcon icon="plus" />
              </NcButton>
            </NcTooltip>

            <NcTooltip :title="t('general.close')" placement="bottom" :arrow="false">
              <NcButton size="small" type="text" class="nc-chat-header-btn" @click="isPanelExpanded = false">
                <GeneralIcon icon="close" class="w-4 h-4" />
              </NcButton>
            </NcTooltip>
          </div>
        </div>

        <!-- Messages -->
        <div ref="messageListRef" class="flex-1 overflow-y-auto nc-scrollbar-thin relative" @scroll="checkIfNearBottom">
          <div v-if="isLoadingSessions || isLoadingMessages" class="flex items-center justify-center h-full">
            <GeneralLoader size="large" />
          </div>
          <template v-else>
            <!-- Empty state -->
            <ChatEmptyState v-if="!activeMessages.length && !isSendingMessage" @prompt="handleStarterPrompt" />

            <!-- Message list -->
            <div v-else class="p-4 space-y-4">
              <ChatMessage
                v-for="msg in activeMessages"
                :key="msg.id"
                :message="msg"
                :streaming-parts="msg.id.startsWith('streaming-') ? activeStreamingParts : undefined"
                :is-streaming="msg.id.startsWith('streaming-') && isSendingMessage"
                @approve-all="handleApproveAll"
                @deny-all="handleDenyAll"
              />

              <!-- Loading indicator: shown only before first streaming part arrives -->
              <ChatMessage v-if="isSendingMessage && !activeStreamingParts?.length" :is-streaming="true" role="assistant" />
            </div>
          </template>
        </div>

        <!-- Scroll to bottom button -->
        <Transition name="nc-fade">
          <div v-if="showScrollButton" class="nc-chat-scroll-btn-wrapper">
            <NcTooltip :title="$t('general.scrollToBottom')" placement="top" :arrow="false">
              <NcButton size="small" type="secondary" class="nc-chat-scroll-btn" @click="scrollToBottom(true)">
                <GeneralIcon icon="arrowDown" class="w-4 h-4" />
              </NcButton>
            </NcTooltip>
          </div>
        </Transition>

        <!-- Option picker card (shown when AI asks a question) -->
        <Transition name="nc-slide-up">
          <ChatOptions
            v-if="pendingUserInput && !dismissedInputIds.has(pendingUserInput.toolCallId) && !isSendingMessage"
            :questions="pendingUserInput.questions"
            class="mx-3 mb-2"
            @select="handleUserInput"
            @skip="handleSkipInput"
          />
        </Transition>

        <!-- Input -->
        <ChatInput :disabled="isSendingMessage" @send="handleSend" @cancel="chatStore.cancelSending" />
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.nc-chat-panel {
  @apply fixed top-0 right-0 h-full flex flex-col bg-nc-bg-default border-l-1 border-nc-border-gray-medium;

  z-index: 100;
  box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.16), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
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

.nc-chat-session-menu {
  @apply py-1.5 min-w-[280px] max-w-[360px];
}

.nc-chat-header-btn {
  @apply !bg-transparent hover:!bg-transparent;

  :deep(svg) {
    @apply w-4 h-4;
    color: var(--nc-content-gray-muted);
    transition: color 150ms ease;
  }

  &:hover :deep(svg) {
    color: var(--nc-content-gray);
  }
}

.nc-chat-delete-btn {
  :deep(svg) {
    color: var(--nc-content-red);
    transition: color 150ms ease;
  }

  &:hover :deep(svg) {
    color: var(--nc-content-red-dark);
  }
}

.nc-chat-scroll-btn-wrapper {
  @apply flex justify-center;
  margin-top: -32px;
  position: relative;
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
</style>
