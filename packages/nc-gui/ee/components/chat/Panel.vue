<script setup lang="ts">
import { Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import type { ChatContentBlock } from 'nocodb-sdk'
import { ChatMessageRole, ChatToolCallStatus } from 'nocodb-sdk'

const { isPanelExpanded, chatPanelSize } = useChatPanel()

const chatStore = useChatStore()

const { activeMessages, isSendingMessage, activeSession, sessionList, isLoadingSessions, activeStreamingParts } =
  storeToRefs(chatStore)

const { base } = storeToRefs(useBase())

const { t } = useI18n()

const { $e } = useNuxtApp()

const isReady = ref(false)

const messageListRef = ref<HTMLDivElement>()

onMounted(() => chatStore.initChatSocket())
onUnmounted(() => chatStore.destroyChatSocket())

const hasInitialized = ref(false)

const showSessionList = ref(false)

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
      if (!output?.question || !output?.options) return null
      return { toolCallId: block.id, question: output.question as string, options: output.options as string[] }
    }
  }
  return null
})

const panelSize = computed(() => {
  if (isPanelExpanded.value) {
    return chatPanelSize.value
  }
  return 0
})

defineExpose({
  onReady: () => {
    isReady.value = true
  },
  isReady,
})

watch(isPanelExpanded, (newValue) => {
  if (newValue && !isReady.value) {
    setTimeout(() => {
      isReady.value = true
    }, 300)
  }
})

const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

// Auto-scroll when a new message is appended or streaming content updates
watch(() => activeMessages.value.length, scrollToBottom)
watch(() => activeStreamingParts.value?.length, scrollToBottom)

// Initialize: load sessions when panel opens
watch(
  isPanelExpanded,
  async (expanded) => {
    if (expanded && base.value?.id && !hasInitialized.value) {
      hasInitialized.value = true
      await chatStore.loadSessions(base.value.id)
    }
  },
  { immediate: true },
)

// Reset initialization when base changes
watch(
  () => base.value?.id,
  () => {
    hasInitialized.value = false
    chatStore.reset()
  },
)

// Load messages when active session changes
watch(
  () => chatStore.activeSessionId,
  async (sessionId) => {
    if (sessionId && base.value?.id) {
      await chatStore.loadMessages(base.value.id, sessionId)
    }
  },
)

const handleSend = async (content: string) => {
  if (!base.value?.id) return

  $e('a:chat:message:send')

  // Create session if none exists
  if (!chatStore.activeSessionId) {
    const session = await chatStore.createSession(base.value.id)
    if (!session?.id) return
  }

  await chatStore.sendMessage(base.value.id, chatStore.activeSessionId!, content)
}

const handleNewSession = async () => {
  if (!base.value?.id) return
  showSessionList.value = false
  await chatStore.createSession(base.value.id)
}

const handleDeleteSession = async (sessionId: string) => {
  if (!base.value?.id) return
  await chatStore.deleteSession(base.value.id, sessionId)
}

const handleSelectSession = (sessionId: string) => {
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

const handleApprove = async (messageId: string, toolCallId: string) => {
  if (!base.value?.id || !chatStore.activeSessionId) return
  $e('a:chat:tool:approve')
  await chatStore.approveToolCalls(base.value.id, chatStore.activeSessionId, messageId, {
    [toolCallId]: 'approved',
  })
}

const handleDeny = async (messageId: string, toolCallId: string) => {
  if (!base.value?.id || !chatStore.activeSessionId) return
  $e('a:chat:tool:deny')
  await chatStore.approveToolCalls(base.value.id, chatStore.activeSessionId, messageId, {
    [toolCallId]: 'denied',
  })
}
</script>

<template>
  <Pane
    v-show="isPanelExpanded || isReady"
    :size="panelSize"
    max-size="60%"
    class="nc-chat-pane"
    :style="
      !isReady
        ? {
            maxWidth: `${chatPanelSize}%`,
          }
        : {}
    "
  >
    <Transition name="layout" :duration="150">
      <div v-show="isPanelExpanded" class="flex flex-col h-full">
        <!-- Header -->
        <div
          class="h-[var(--toolbar-height)] flex items-center justify-between gap-2 px-3 border-b-1 border-nc-border-gray-medium bg-nc-bg-default"
        >
          <!-- Left: icon + session switcher -->
          <div class="flex items-center gap-1.5 min-w-0">
            <GeneralIcon icon="ncMessageSquare" class="flex-none w-4 h-4 text-nc-content-brand" />

            <NcDropdown v-model:visible="showSessionList" placement="bottomLeft" :trigger="['click']">
              <button
                class="flex items-center gap-1 max-w-[200px] px-1.5 py-0.5 rounded transition-colors min-w-0"
                :class="sessionList.length > 1 ? 'hover:bg-nc-bg-gray-light cursor-pointer' : 'cursor-default'"
                :disabled="sessionList.length <= 1"
                @click.capture="sessionList.length <= 1 && $event.stopPropagation()"
              >
                <span class="text-sm font-semibold text-nc-content-gray truncate">
                  {{ activeSession?.title || t('labels.newChat') }}
                </span>
                <GeneralIcon
                  v-if="sessionList.length > 1"
                  icon="chevronDown"
                  class="flex-none w-3.5 h-3.5 text-nc-content-gray-subtle transition-transform duration-200"
                  :class="{ 'rotate-180': showSessionList }"
                />
              </button>

              <template #overlay>
                <div class="nc-chat-session-menu">
                  <!-- Session list -->
                  <template v-if="sessionList.length > 0">
                    <div class="px-3 py-1">
                      <span class="text-[11px] font-semibold text-nc-content-gray-muted uppercase tracking-wider">
                        {{ t('labels.recentChats') }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-y-0.5">
                      <div
                        v-for="session in sessionList"
                        :key="session.id"
                        class="group flex items-center gap-2 px-3 py-2 mx-1 rounded-md cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
                        :class="{ 'bg-nc-bg-gray-light': session.id === activeSession?.id }"
                        @click="handleSelectSession(session.id!)"
                      >
                        <!-- Active dot -->
                        <div class="flex-none w-4 flex items-center justify-center">
                          <div v-if="session.id === activeSession?.id" class="w-1.5 h-1.5 rounded-full bg-nc-content-brand" />
                        </div>

                        <span
                          class="flex-1 min-w-0 truncate text-sm"
                          :class="
                            session.id === activeSession?.id ? 'text-nc-content-gray font-medium' : 'text-nc-content-gray-subtle'
                          "
                        >
                          {{ session.title || t('labels.newChat') }}
                        </span>

                        <!-- Delete — always in layout; opacity reveals on group-hover to avoid shift -->
                        <NcButton
                          size="xxsmall"
                          type="text"
                          class="nc-chat-delete-btn flex-none !-mr-0.5 !bg-transparent hover:!bg-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          @click.stop="handleDeleteSession(session.id!)"
                        >
                          <GeneralIcon icon="delete" class="w-3.5 h-3.5" />
                        </NcButton>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </NcDropdown>
          </div>

          <!-- Right: new chat -->
          <NcTooltip :title="t('labels.newChat')" placement="bottom" :arrow="false">
            <NcButton size="small" type="text" class="nc-chat-header-btn" @click="handleNewSession">
              <GeneralIcon icon="plus" />
            </NcButton>
          </NcTooltip>
        </div>

        <!-- Messages -->
        <div ref="messageListRef" class="flex-1 overflow-y-auto nc-scrollbar-thin">
          <div v-if="isLoadingSessions" class="flex items-center justify-center h-full">
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
                @approve="handleApprove"
                @deny="handleDeny"
              />

              <!-- Loading indicator: shown only before first streaming part arrives -->
              <ChatMessage v-if="isSendingMessage && !activeStreamingParts?.length" :is-streaming="true" role="assistant" />
            </div>
          </template>
        </div>

        <!-- Option picker card (shown when AI asks a question) -->
        <Transition name="nc-slide-up">
          <ChatOptions
            v-if="pendingUserInput && !dismissedInputIds.has(pendingUserInput.toolCallId) && !isSendingMessage"
            :question="pendingUserInput.question"
            :options="pendingUserInput.options"
            class="mx-3 mb-2"
            @select="handleUserInput"
            @skip="handleSkipInput"
          />
        </Transition>

        <!-- Input -->
        <ChatInput :disabled="isSendingMessage" @send="handleSend" />
      </div>
    </Transition>
  </Pane>
</template>

<style lang="scss" scoped>
.nc-chat-pane {
  @apply flex flex-col bg-nc-bg-gray-extralight rounded-l-xl border-1 border-nc-border-gray-medium z-30 -mt-1px;

  box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.16), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
}

.nc-chat-session-menu {
  @apply py-1.5 min-w-[220px] max-w-[280px];
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
