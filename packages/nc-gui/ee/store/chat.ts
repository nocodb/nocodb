import { acceptHMRUpdate, defineStore } from 'pinia'
import type { ChatMessageType, ChatSessionType } from 'nocodb-sdk'
import { ChatMessageRole } from 'nocodb-sdk'

export const useChatStore = defineStore('chatStore', () => {
  const { $api } = useNuxtApp()

  const { token } = useGlobal()

  const sessions = ref<Map<string, ChatSessionType>>(new Map())

  const messages = ref<Map<string, ChatMessageType[]>>(new Map())

  const activeSessionId = ref<string | null>(null)

  const isLoadingSessions = ref(false)

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

  const loadSessions = async (bId: string) => {
    try {
      isLoadingSessions.value = true

      const { data } = await $api.instance.get(`/api/v3/meta/bases/${bId}/chat/sessions`)

      const sessionsList = (data?.list || data || []) as ChatSessionType[]

      for (const session of sessionsList) {
        if (session.id) {
          sessions.value.set(session.id, session)
        }
      }

      // Auto-select first session if none active
      if (!activeSessionId.value && sessionsList.length > 0) {
        activeSessionId.value = sessionsList[0].id || null
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoadingSessions.value = false
    }
  }

  const createSession = async (bId: string, title?: string): Promise<ChatSessionType | undefined> => {
    try {
      const { data: session } = await $api.instance.post(`/api/v3/meta/bases/${bId}/chat/sessions`, {
        title: title || 'New Chat',
      })

      if (session.id) {
        sessions.value.set(session.id, session)
        messages.value.set(session.id, [])
        activeSessionId.value = session.id
      }

      return session
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return undefined
    }
  }

  const deleteSession = async (bId: string, sessionId: string) => {
    try {
      await $api.instance.delete(`/api/v3/meta/bases/${bId}/chat/sessions/${sessionId}`)

      sessions.value.delete(sessionId)
      messages.value.delete(sessionId)

      if (activeSessionId.value === sessionId) {
        const remaining = sessionList.value
        activeSessionId.value = remaining.length > 0 ? remaining[0].id || null : null
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const loadMessages = async (bId: string, sessionId: string) => {
    try {
      const { data } = await $api.instance.get(`/api/v3/meta/bases/${bId}/chat/sessions/${sessionId}/messages`)

      const messagesList = (data?.list || data || []) as ChatMessageType[]

      messages.value.set(sessionId, messagesList)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const sendMessage = async (bId: string, sessionId: string, content: string) => {
    // Push optimistic user message
    const userMessage: ChatMessageType = {
      id: `temp-${Date.now()}`,
      fk_session_id: sessionId,
      role: ChatMessageRole.USER,
      content,
      created_at: new Date().toISOString(),
    }

    const currentMessages = messages.value.get(sessionId) || []
    messages.value.set(sessionId, [...currentMessages, userMessage])

    isSendingMessage.value = true

    try {
      const { data } = await $api.instance.post(`/api/v3/meta/bases/${bId}/chat/sessions/${sessionId}/messages`, {
        content,
      })

      // Backend returns the updated message list
      const messagesList = (data?.list || data || []) as ChatMessageType[]
      messages.value.set(sessionId, messagesList)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))

      // Re-fetch to sync state
      await loadMessages(bId, sessionId)
    } finally {
      isSendingMessage.value = false
    }
  }

  const approveToolCalls = async (
    bId: string,
    sessionId: string,
    messageId: string,
    decisions: Record<string, 'approved' | 'denied'>,
  ) => {
    try {
      isSendingMessage.value = true

      const { data } = await $api.instance.post(
        `/api/v3/meta/bases/${bId}/chat/sessions/${sessionId}/messages/${messageId}/approve`,
        { decisions },
      )

      const messagesList = (data?.list || data || []) as ChatMessageType[]
      messages.value.set(sessionId, messagesList)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      await loadMessages(bId, sessionId)
    } finally {
      isSendingMessage.value = false
    }
  }

  const reset = () => {
    sessions.value.clear()
    messages.value.clear()
    activeSessionId.value = null
    isLoadingSessions.value = false
    isSendingMessage.value = false
  }

  // Reset on logout
  watch(token, (newToken) => {
    if (!newToken) reset()
  })

  return {
    sessions,
    messages,
    activeSessionId,
    isLoadingSessions,
    isSendingMessage,
    activeSession,
    activeMessages,
    sessionList,
    loadSessions,
    createSession,
    deleteSession,
    loadMessages,
    sendMessage,
    approveToolCalls,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore as any, import.meta.hot))
}
