import { acceptHMRUpdate, defineStore } from 'pinia'
import type { ChatContentBlock, ChatMessageType, ChatSessionType } from 'nocodb-sdk'

export const useChatStore = defineStore('chatStore', () => {
  const activeSessionId = ref<string | null>(null)

  const isLoadingSessions = ref(false)

  const isLoadingMessages = ref(false)

  const isSendingMessage = ref(false)

  const agentLabel = ref<string | null>(null)

  const followUps = ref<Map<string, string[]>>(new Map())

  const emptySuggestions = ref<Map<string, string[]>>(new Map())

  const isLoadingSuggestions = ref(false)

  const activeSession = computed<ChatSessionType | undefined>(() => undefined)

  const activeMessages = computed<ChatMessageType[]>(() => [])

  const activeStreamingParts = computed<ChatContentBlock[] | undefined>(() => undefined)

  const visibleStreamingParts = computed<ChatContentBlock[] | undefined>(() => undefined)

  const sessionList = computed<ChatSessionType[]>(() => [])

  const loadSessions = async (_wsId: string) => {}

  const deleteSession = async (_wsId: string, _sessionId: string) => {}

  const renameSession = async (_wsId: string, _sessionId: string, _title: string) => {}

  const loadMessages = async (_wsId: string, _sessionId: string) => {}

  const sendMessage = async (_wsId: string, _sessionId: string, _content: string, _baseId?: string) => {}

  const approveToolCalls = async (
    _wsId: string,
    _sessionId: string,
    _messageId: string,
    _decisions: Record<string, 'approved' | 'denied'>,
    _baseId?: string,
  ) => {}

  const messageFeedback = async (_sessionId: string, _messageId: string, _score: 1 | 0) => {}

  const fetchSuggestions = async (_wsId: string, _type: string, _baseId?: string) => {}

  const cancelSending = async () => {}

  const initChatSocket = () => {}

  const destroyChatSocket = () => {}

  const reset = () => {
    activeSessionId.value = null
    isSendingMessage.value = false
  }

  return {
    activeSessionId,
    isLoadingSessions,
    isLoadingMessages,
    isSendingMessage,
    agentLabel,
    followUps,
    emptySuggestions,
    isLoadingSuggestions,
    activeSession,
    activeMessages,
    activeStreamingParts,
    visibleStreamingParts,
    sessionList,
    loadSessions,
    createSession,
    deleteSession,
    renameSession,
    loadMessages,
    sendMessage,
    approveToolCalls,
    messageFeedback,
    fetchSuggestions,
    cancelSending,
    initChatSocket,
    destroyChatSocket,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore as any, import.meta.hot))
}
