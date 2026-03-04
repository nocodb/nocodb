import { acceptHMRUpdate, defineStore } from 'pinia'
import type { ChatMessageType, ChatSessionType } from 'nocodb-sdk'

export const useChatStore = defineStore('chatStore', () => {
  const sessions = ref<Map<string, ChatSessionType>>(new Map())

  const messages = ref<Map<string, ChatMessageType[]>>(new Map())

  const activeSessionId = ref<string | null>(null)

  const isLoadingSessions = ref(false)

  const isLoadingMessages = ref(false)

  const isSendingMessage = ref(false)

  const activeSession = computed<ChatSessionType | undefined>(() => {
    if (!activeSessionId.value) return undefined
    return sessions.value.get(activeSessionId.value)
  })

  const activeMessages = computed<ChatMessageType[]>(() => {
    if (!activeSessionId.value) return []
    return messages.value.get(activeSessionId.value) || []
  })

  const sessionList = computed<ChatSessionType[]>(() => {
    return Array.from(sessions.value.values()).sort(
      (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime(),
    )
  })

  const loadSessions = async (_wsId: string) => {}

  const createSession = async (_wsId: string, _title?: string): Promise<ChatSessionType | undefined> => {
    return undefined
  }

  const deleteSession = async (_wsId: string, _sessionId: string) => {}

  const loadMessages = async (_wsId: string, _sessionId: string) => {}

  const sendMessage = async (_wsId: string, _sessionId: string, _content: string, _baseId?: string) => {}

  const reset = () => {
    sessions.value.clear()
    messages.value.clear()
    activeSessionId.value = null
    isSendingMessage.value = false
  }

  return {
    sessions,
    messages,
    activeSessionId,
    isLoadingSessions,
    isLoadingMessages,
    isSendingMessage,
    activeSession,
    activeMessages,
    sessionList,
    loadSessions,
    createSession,
    deleteSession,
    loadMessages,
    sendMessage,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore as any, import.meta.hot))
}
