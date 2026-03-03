import { acceptHMRUpdate, defineStore } from 'pinia'
import type { ChatContentBlock, ChatEventPayload, ChatMessageType, ChatSessionType } from 'nocodb-sdk'
import { ChatMessageRole, ChatToolCallStatus, EventType } from 'nocodb-sdk'

interface StreamingState {
  id: string
  parts: ChatContentBlock[]
}

export const useChatStore = defineStore('chatStore', () => {
  const { $api, $ncSocket } = useNuxtApp()

  const { token, user } = useGlobal()

  const sessions = ref<Map<string, ChatSessionType>>(new Map())

  const messages = ref<Map<string, ChatMessageType[]>>(new Map())

  const activeSessionId = ref<string | null>(null)

  const isLoadingSessions = ref(false)

  const isSendingMessage = ref(false)

  // Streaming state per session — ordered ChatContentBlock[] built live before message-done
  const streamingStates = ref<Map<string, StreamingState>>(new Map())

  // Socket.IO listener cleanup
  let socketListenerId: string | null = null

  const activeSession = computed<ChatSessionType | undefined>(() => {
    if (!activeSessionId.value) return undefined
    return sessions.value.get(activeSessionId.value)
  })

  // Expose the current session's streaming parts for inline rendering in Panel
  const activeStreamingParts = computed<ChatContentBlock[] | undefined>(() => {
    if (!activeSessionId.value) return undefined
    return streamingStates.value.get(activeSessionId.value)?.parts
  })

  const activeMessages = computed<ChatMessageType[]>(() => {
    if (!activeSessionId.value) return []
    const msgs = messages.value.get(activeSessionId.value) || []
    const streaming = streamingStates.value.get(activeSessionId.value)
    if (!streaming || !streaming.parts.length) return msgs

    return [
      ...msgs,
      {
        id: streaming.id,
        fk_session_id: activeSessionId.value,
        role: ChatMessageRole.ASSISTANT,
        parts: streaming.parts,
        created_at: new Date().toISOString(),
      } as ChatMessageType,
    ]
  })

  const sessionList = computed<ChatSessionType[]>(() => {
    return Array.from(sessions.value.values()).sort(
      (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime(),
    )
  })

  // ---------------------------------------------------------------------------
  // Socket.IO — subscribe once to CHAT_EVENT for all sessions
  // ---------------------------------------------------------------------------

  const initChatSocket = () => {
    if (socketListenerId) return
    if (!user.value?.id) return

    socketListenerId = $ncSocket.onMessage(`user:${user.value.id}`, (data: any) => {
      if (data.event !== EventType.CHAT_EVENT) return
      const payload = data as ChatEventPayload
      const { action, sessionId } = payload
      if (!sessionId) return

      switch (action) {
        case 'tool-start': {
          // Early notification: LLM started a tool call (no input yet)
          let state = streamingStates.value.get(sessionId)
          if (!state) {
            state = { id: `streaming-${Date.now()}`, parts: [] }
          }
          streamingStates.value.set(sessionId, {
            ...state,
            parts: [
              ...state.parts,
              {
                type: 'tool_use',
                id: payload.toolCallId || '',
                name: payload.name || '',
                status: ChatToolCallStatus.RUNNING,
              } as ChatContentBlock,
            ],
          })
          break
        }

        case 'token': {
          let state = streamingStates.value.get(sessionId)
          if (!state) {
            state = { id: `streaming-${Date.now()}`, parts: [] }
          }
          // Append to last text block or add a new one
          const parts = [...state.parts]
          const last = parts[parts.length - 1]
          if (last && last.type === 'text') {
            parts[parts.length - 1] = { ...last, text: last.text + (payload.content || '') }
          } else {
            parts.push({ type: 'text', text: payload.content || '' })
          }
          streamingStates.value.set(sessionId, { ...state, parts })
          break
        }

        case 'tool-call': {
          // Update the matching tool_use block's input
          const state = streamingStates.value.get(sessionId)
          if (state) {
            const parts = state.parts.map((p) =>
              p.type === 'tool_use' && p.id === payload.toolCallId ? { ...p, input: payload.args } : p,
            )
            streamingStates.value.set(sessionId, { ...state, parts })
          }
          break
        }

        case 'tool-result': {
          // Update the matching tool_use block's status and output
          const state = streamingStates.value.get(sessionId)
          if (state) {
            const parts = state.parts.map((p) =>
              p.type === 'tool_use' && p.id === payload.toolCallId
                ? {
                    ...p,
                    status: payload.isError ? ChatToolCallStatus.ERROR : ChatToolCallStatus.SUCCESS,
                    output: payload.output,
                    is_error: payload.isError || false,
                  }
                : p,
            )
            streamingStates.value.set(sessionId, { ...state, parts })
          }
          break
        }

        case 'message-update': {
          // Server pushed updated parts for an existing message (e.g. after tool approval execution)
          const currentMsgs = messages.value.get(sessionId)
          if (currentMsgs && payload.messageId && payload.parts?.length) {
            const updated = currentMsgs.map((m) =>
              m.id === payload.messageId ? { ...m, parts: payload.parts as ChatContentBlock[] } : m,
            )
            messages.value.set(sessionId, updated)
          }
          break
        }

        case 'message-done': {
          const streaming = streamingStates.value.get(sessionId)

          if (streaming && streaming.parts.length) {
            // Use server-authoritative parts (ChatContentBlock[]) if available,
            // otherwise fall back to the streaming state we built locally.
            const finalParts: ChatContentBlock[] = payload.parts?.length ? payload.parts : streaming.parts

            const finalMessage = {
              id: payload.messageId || `msg-${Date.now()}`,
              fk_session_id: sessionId,
              role: ChatMessageRole.ASSISTANT,
              parts: finalParts,
              created_at: new Date().toISOString(),
            } as ChatMessageType

            const currentMsgs = messages.value.get(sessionId) || []
            messages.value.set(sessionId, [...currentMsgs, finalMessage])
          } else {
            // No streaming state (e.g. reconnected mid-stream) — fall back to API
            const bId = payload.baseId
            if (bId) {
              loadMessages(bId, sessionId).catch(() => {})
            }
          }

          streamingStates.value.delete(sessionId)
          isSendingMessage.value = false
          break
        }

        case 'error': {
          streamingStates.value.delete(sessionId)
          isSendingMessage.value = false
          message.error(payload.error || 'An error occurred in the AI agent')
          break
        }
      }
    })
  }

  const destroyChatSocket = () => {
    if (socketListenerId) {
      $ncSocket.offMessage(socketListenerId)
      socketListenerId = null
    }
  }

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

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
      streamingStates.value.delete(sessionId)

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

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  const sendMessage = async (bId: string, sessionId: string, content: string) => {
    // Push optimistic user message immediately
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
      // POST enqueues the job — real response arrives via Socket.IO CHAT_EVENT
      await $api.instance.post(`/api/v3/meta/bases/${bId}/chat/sessions/${sessionId}/messages`, {
        content,
      })
      // isSendingMessage stays true until 'message-done' or 'error' socket event
    } catch (e: any) {
      isSendingMessage.value = false
      message.error(await extractSdkResponseErrorMsg(e))

      // Re-fetch to sync state on error
      await loadMessages(bId, sessionId)
    }
  }

  const approveToolCalls = async (
    bId: string,
    sessionId: string,
    messageId: string,
    decisions: Record<string, 'approved' | 'denied'>,
  ) => {
    // Optimistic update: approved → RUNNING (will execute), denied → DENIED
    const currentMsgs = messages.value.get(sessionId)
    if (currentMsgs) {
      const updated = currentMsgs.map((m) => {
        if (m.id !== messageId || !m.parts) return m
        return {
          ...m,
          parts: m.parts.map((p) => {
            if (p.type !== 'tool_use' || p.status !== ChatToolCallStatus.AWAITING_APPROVAL) return p
            const decision = decisions[p.id]
            if (decision === 'approved') return { ...p, status: ChatToolCallStatus.RUNNING }
            if (decision === 'denied') return { ...p, status: ChatToolCallStatus.DENIED, output: 'Denied by user.' }
            return p
          }) as ChatContentBlock[],
        }
      })
      messages.value.set(sessionId, updated)
    }

    isSendingMessage.value = true

    try {
      // POST enqueues the approval job — continuation arrives via Socket.IO CHAT_EVENT
      await $api.instance.post(`/api/v3/meta/bases/${bId}/chat/sessions/${sessionId}/messages/${messageId}/approve`, {
        decisions,
      })
      // isSendingMessage stays true until 'message-done' or 'error' socket event
    } catch (e: any) {
      isSendingMessage.value = false
      message.error(await extractSdkResponseErrorMsg(e))
      await loadMessages(bId, sessionId)
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  const reset = () => {
    sessions.value.clear()
    messages.value.clear()
    streamingStates.value.clear()
    activeSessionId.value = null
    isLoadingSessions.value = false
    isSendingMessage.value = false
    destroyChatSocket()
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
    streamingStates,
    activeSession,
    activeMessages,
    activeStreamingParts,
    sessionList,
    loadSessions,
    createSession,
    deleteSession,
    loadMessages,
    sendMessage,
    approveToolCalls,
    initChatSocket,
    destroyChatSocket,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore as any, import.meta.hot))
}
