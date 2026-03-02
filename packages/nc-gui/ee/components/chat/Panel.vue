<script setup lang="ts">
import { Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { ChatMessageRole, ChatToolCallStatus } from 'nocodb-sdk'

const { isPanelExpanded, chatPanelSize, toggleChatPanel } = useChatPanel()

const chatStore = useChatStore()

const { activeMessages, isSendingMessage, activeSession, sessionList, isLoadingSessions } = storeToRefs(chatStore)

const { base } = storeToRefs(useBase())

const { activeView } = storeToRefs(useViewsStore())

const { t } = useI18n()

const isReady = ref(false)

const messageListRef = ref<HTMLDivElement>()

const hasInitialized = ref(false)

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
    // If the user has already replied, stop searching
    if (m.role === ChatMessageRole.USER) return null
    if (m.role === ChatMessageRole.ASSISTANT) {
      const tc = m.tool_calls?.find((c) => c.status === ChatToolCallStatus.AWAITING_INPUT)
      if (!tc) return null
      const result = m.tool_results?.find((r) => r.tool_call_id === tc.id)
      if (!result?.output) return null
      const output = typeof result.output === 'string' ? JSON.parse(result.output) : result.output
      if (!output?.question || !output?.options) return null
      return { toolCallId: tc.id, question: output.question as string, options: output.options as string[] }
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

// Auto-scroll when messages change
watch(activeMessages, scrollToBottom, { deep: true })

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

  // Create session if none exists
  if (!chatStore.activeSessionId) {
    const session = await chatStore.createSession(base.value.id)
    if (!session?.id) return
  }

  const context = {
    base_id: base.value.id,
    workspace_id: base.value.fk_workspace_id || '',
    table_id: activeView.value?.fk_model_id || undefined,
    view_id: activeView.value?.id || undefined,
    user_role: 'owner',
  }

  await chatStore.sendMessage(base.value.id, chatStore.activeSessionId!, content, context)
}

const handleNewSession = async () => {
  if (!base.value?.id) return
  await chatStore.createSession(base.value.id)
}

const handleDeleteSession = async (sessionId: string) => {
  if (!base.value?.id) return
  await chatStore.deleteSession(base.value.id, sessionId)
}

const handleSelectSession = async (sessionId: string) => {
  chatStore.activeSessionId = sessionId
}

const handleStarterPrompt = (prompt: string) => {
  handleSend(prompt)
}

const handleUserInput = (choice: string) => {
  handleSend(choice)
}

const handleSkipInput = () => {
  if (pendingUserInput.value) {
    dismissedInputIds.value = new Set([...dismissedInputIds.value, pendingUserInput.value.toolCallId])
  }
}

const handleApprove = async (messageId: string, toolCallId: string) => {
  if (!base.value?.id || !chatStore.activeSessionId) return
  await chatStore.approveToolCalls(base.value.id, chatStore.activeSessionId, messageId, {
    [toolCallId]: 'approved',
  })
}

const handleDeny = async (messageId: string, toolCallId: string) => {
  if (!base.value?.id || !chatStore.activeSessionId) return
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
          class="h-[var(--toolbar-height)] flex items-center justify-between gap-3 px-4 py-2 border-b-1 border-nc-border-gray-medium bg-nc-bg-default"
        >
          <div class="flex items-center gap-2">
            <NcButton size="small" type="text" @click="toggleChatPanel">
              <GeneralIcon icon="ncMessageSquare" class="flex-none !text-nc-content-gray-subtle" />
            </NcButton>
            <span class="text-sm font-medium text-nc-content-gray-subtle">{{ t('labels.aiChat') }}</span>
          </div>
          <div class="flex items-center gap-1">
            <!-- Session selector -->
            <NcDropdown v-if="sessionList.length > 1" placement="bottomRight">
              <NcButton size="small" type="text">
                <GeneralIcon icon="chevronDown" class="!text-nc-content-gray-subtle" />
              </NcButton>
              <template #overlay>
                <NcMenu>
                  <NcMenuItem
                    v-for="session in sessionList"
                    :key="session.id"
                    :class="{ '!bg-nc-bg-gray-light': session.id === activeSession?.id }"
                    @click="handleSelectSession(session.id!)"
                  >
                    <div class="flex items-center justify-between w-full gap-2">
                      <span class="truncate">{{ session.title || t('labels.newChat') }}</span>
                      <NcButton
                        size="xxsmall"
                        type="text"
                        class="!text-nc-content-gray-subtle"
                        @click.stop="handleDeleteSession(session.id!)"
                      >
                        <GeneralIcon icon="delete" class="w-3.5 h-3.5" />
                      </NcButton>
                    </div>
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
            <!-- New session -->
            <NcTooltip :title="t('labels.newChat')">
              <NcButton v-e="['c:chat:new-session']" size="small" type="text" @click="handleNewSession">
                <GeneralIcon icon="plus" class="!text-nc-content-gray-subtle" />
              </NcButton>
            </NcTooltip>
          </div>
        </div>

        <!-- Messages -->
        <div ref="messageListRef" class="flex-1 overflow-y-auto nc-scrollbar-thin">
          <div v-if="isLoadingSessions" class="flex items-center justify-center h-full">
            <GeneralLoader size="large" />
          </div>
          <template v-else>
            <!-- Empty state -->
            <ChatEmptyState
              v-if="!activeMessages.length && !isSendingMessage"
              @prompt="handleStarterPrompt"
            />

            <!-- Message list -->
            <div v-else class="p-4 space-y-4">
              <ChatMessage
                v-for="msg in activeMessages"
                :key="msg.id"
                :message="msg"
                @approve="handleApprove"
                @deny="handleDeny"
              />

              <!-- Loading indicator while waiting for AI response -->
              <ChatMessage v-if="isSendingMessage" :is-streaming="true" role="assistant" />
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
