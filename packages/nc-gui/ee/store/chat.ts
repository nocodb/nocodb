import { acceptHMRUpdate, defineStore } from 'pinia'
import type {
  ChatAttachmentType,
  ChatContentBlock,
  ChatEventPayload,
  ChatMessageType,
  ChatSendMessageResponseType,
  ChatSessionType,
  ChatToolVisibility,
} from 'nocodb-sdk'
import { ChatEventAction, ChatMessageRole, ChatToolCallStatus, EventType, NC_NEW_SESSION } from 'nocodb-sdk'

interface StreamingState {
  id: string
  parts: ChatContentBlock[]
}

export const useChatStore = defineStore('chatStore', () => {
  const { $api, $ncSocket } = useNuxtApp()

  const { t } = useI18n()

  const { token, user, ncNavigateTo } = useGlobal()

  const workspaceStore = useWorkspace()

  const sessions = ref<Map<string, ChatSessionType>>(new Map())
  const activeSessionId = ref<string | null>(null)
  const isLoadingSessions = ref(false)
  const loadedWorkspaceId = ref<string | null>(null)
  const loadedBaseId = ref<string | null>(null)
  const freshSessionIds = new Set<string>()
  const sessionStorageKey = (wsId: string, baseId: string) => `nc-chat-active-session-${wsId}-${baseId}`

  const messages = ref<Map<string, ChatMessageType[]>>(new Map())
  const isLoadingMessages = ref(false)
  const isSendingMessage = ref(false)
  const cancelledSessionIds = new Set<string>()

  const streamingStates = ref<Map<string, StreamingState>>(new Map())
  const activeAgent = ref<string | null>(null)
  const agentLabel = ref<string | null>(null)

  const followUps = ref<Map<string, string[]>>(new Map())
  const emptySuggestions = ref<Map<string, string[]>>(new Map())
  const isLoadingSuggestions = ref(false)

  let socketListenerId: string | null = null
  let disconnectUnsub: (() => void) | null = null
  let reconnectUnsub: (() => void) | null = null

  const activeSession = computed<ChatSessionType | undefined>(() => {
    if (!activeSessionId.value) return undefined
    return sessions.value.get(activeSessionId.value)
  })

  const activeStreamingParts = computed<ChatContentBlock[] | undefined>(() => {
    if (!activeSessionId.value) return undefined
    return streamingStates.value.get(activeSessionId.value)?.parts
  })

  const visibleStreamingParts = computed<ChatContentBlock[] | undefined>(() => {
    const parts = activeStreamingParts.value
    if (!parts) return undefined
    return parts.filter((p) => p.type !== 'tool_use' || p.visibility !== 'hidden')
  })

  const activeMessages = computed<ChatMessageType[]>(() => {
    const sessionKey = activeSessionId.value || (isSendingMessage.value ? NC_NEW_SESSION : null)
    if (!sessionKey) return []
    const msgs = messages.value.get(sessionKey) || []
    const streaming = streamingStates.value.get(sessionKey)
    if (!streaming || !streaming.parts.length) return msgs

    return [
      ...msgs,
      {
        id: streaming.id,
        fk_session_id: sessionKey,
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

  const getOrCreateStreaming = (sessionId: string): StreamingState => {
    return streamingStates.value.get(sessionId) || { id: `streaming-${Date.now()}`, parts: [] }
  }

  const clearStreaming = (sessionId: string) => {
    streamingStates.value.delete(sessionId)
    isSendingMessage.value = false
    activeAgent.value = null
    agentLabel.value = null
  }

  const handleUiAction = (output: string) => {
    try {
      const parsed = typeof output === 'string' ? JSON.parse(output) : output
      if (!parsed?.__ui_action) return

      const wsId = workspaceStore.activeWorkspaceId

      switch (parsed.__ui_action) {
        case 'navigate_base':
          if (parsed.base_id) ncNavigateTo({ workspaceId: wsId, baseId: parsed.base_id })
          break
        case 'open_table':
          if (parsed.table_id) ncNavigateTo({ workspaceId: wsId, baseId: parsed.base_id, tableId: parsed.table_id })
          break
        case 'open_dashboard':
          if (parsed.dashboard_id) ncNavigateTo({ workspaceId: wsId, baseId: parsed.base_id, dashboardId: parsed.dashboard_id })
          break
        case 'open_view':
          if (parsed.table_id && parsed.view_id)
            ncNavigateTo({ workspaceId: wsId, baseId: parsed.base_id, tableId: parsed.table_id, viewId: parsed.view_id })
          break
      }
    } catch {}
  }

  const processToolOutputActions = (parts: ChatContentBlock[]) => {
    for (const p of parts) {
      if (p.type === 'tool_use' && p.output && !p.is_error) {
        handleUiAction(p.output)
      }
    }
  }

  const loadSessions = async (wsId: string, baseId: string) => {
    loadedWorkspaceId.value = wsId
    loadedBaseId.value = baseId

    try {
      isLoadingSessions.value = true

      const { data } = await $api.instance.get(`/api/v2/internal/${wsId}/${baseId}/chat/sessions`)
      const sessionsList = (data?.list || data || []) as ChatSessionType[]

      for (const session of sessionsList) {
        if (session.id) sessions.value.set(session.id, session)
      }

      if (!activeSessionId.value && sessionsList?.length > 0) {
        const persisted = localStorage.getItem(sessionStorageKey(wsId, baseId))
        activeSessionId.value = persisted && sessions.value.has(persisted) ? persisted : sessionsList[0].id || null
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoadingSessions.value = false
    }
  }

  const deleteSession = async (sessionId: string) => {
    if (!loadedWorkspaceId.value || !loadedBaseId.value) return
    try {
      await $api.instance.delete(`/api/v2/internal/${loadedWorkspaceId.value}/${loadedBaseId.value}/chat/sessions/${sessionId}`)

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

  const renameSession = async (sessionId: string, title: string) => {
    if (!loadedWorkspaceId.value || !loadedBaseId.value) return
    try {
      await $api.instance.patch(`/api/v2/internal/${loadedWorkspaceId.value}/${loadedBaseId.value}/chat/sessions/${sessionId}`, {
        title,
      })

      const session = sessions.value.get(sessionId)
      if (session) session.title = title
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const fetchFollowUps = async (sessionId: string, messageId: string) => {
    if (!loadedWorkspaceId.value || !loadedBaseId.value) return
    try {
      const { data } = await $api.instance.get(
        `/api/v2/internal/${loadedWorkspaceId.value}/${loadedBaseId.value}/chat/sessions/${sessionId}/follow-ups`,
      )

      if (data?.followUps?.length) {
        followUps.value.set(messageId, data.followUps)
      }
    } catch {}
  }

  const loadMessages = async (sessionId: string) => {
    if (!loadedWorkspaceId.value || !loadedBaseId.value) return
    freshSessionIds.delete(sessionId)

    isLoadingMessages.value = true

    try {
      const { data } = await $api.instance.get(
        `/api/v2/internal/${loadedWorkspaceId.value}/${loadedBaseId.value}/chat/sessions/${sessionId}/messages`,
      )
      const messagesList = (data?.list || data || []) as ChatMessageType[]

      messages.value.set(sessionId, messagesList)

      const lastMsg = messagesList[messagesList.length - 1]

      // If last message is from user, an LLM turn may be in progress (e.g. other tab).
      // Auto-clear after 10s if no socket event arrives.
      if (lastMsg?.role === ChatMessageRole.USER) {
        isSendingMessage.value = true
        setTimeout(() => {
          if (isSendingMessage.value) isSendingMessage.value = false
        }, 10_000)
      }

      // Generate follow-ups for the last assistant message (non-blocking)
      if (lastMsg?.role === ChatMessageRole.ASSISTANT && lastMsg.id && !followUps.value.has(lastMsg.id)) {
        fetchFollowUps(sessionId, lastMsg.id)
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoadingMessages.value = false
    }
  }

  const sendMessage = async (content: string, title?: string, files?: ChatAttachmentType[]) => {
    if (isSendingMessage.value || !loadedWorkspaceId.value || !loadedBaseId.value) return

    const isNewSession = !activeSessionId.value
    const sessionId = activeSessionId.value || NC_NEW_SESSION

    cancelledSessionIds.delete(sessionId)

    const userMessage: ChatMessageType = {
      id: `temp-${Date.now()}`,
      fk_session_id: sessionId,
      role: ChatMessageRole.USER,
      content,
      files: files?.length ? files : undefined,
      created_at: new Date().toISOString(),
    }

    const currentMessages = messages.value.get(sessionId) || []
    messages.value.set(sessionId, [...currentMessages, userMessage])
    isSendingMessage.value = true

    try {
      const { data } = await $api.instance.post<ChatSendMessageResponseType>(
        `/api/v2/internal/${loadedWorkspaceId.value}/${loadedBaseId.value}/chat/sessions/${sessionId}/messages`,
        {
          content,
          ...(files?.length ? { files } : {}),
          ...(isNewSession && title ? { title } : {}),
        },
      )

      if (data.session?.id) {
        sessions.value.set(data.session.id, data.session)
        freshSessionIds.add(data.session.id)
        activeSessionId.value = data.session.id

        // Move optimistic messages from sentinel key to real session ID
        const pendingMessages = messages.value.get(NC_NEW_SESSION)
        if (pendingMessages) {
          messages.value.set(data.session.id, pendingMessages)
          messages.value.delete(NC_NEW_SESSION)
        }
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))

      if (isNewSession) {
        messages.value.delete(NC_NEW_SESSION)
      } else {
        await loadMessages(sessionId)
      }

      isSendingMessage.value = false
    }
  }

  const approveToolCalls = async (sessionId: string, messageId: string, decisions: Record<string, 'approved' | 'denied'>) => {
    cancelledSessionIds.delete(sessionId)

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

    if (!loadedWorkspaceId.value || !loadedBaseId.value) return

    try {
      await $api.instance.post(
        `/api/v2/internal/${loadedWorkspaceId.value}/${loadedBaseId.value}/chat/sessions/${sessionId}/messages/${messageId}/approve`,
        {
          decisions,
        },
      )
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      await loadMessages(sessionId)
      isSendingMessage.value = false
    }
  }

  const fetchSuggestions = async (type: string, fileNames?: string[]) => {
    if (!loadedWorkspaceId.value || !loadedBaseId.value) return
    isLoadingSuggestions.value = true
    try {
      const params: Record<string, string> = { type }
      if (fileNames?.length) {
        params.fileNames = fileNames.join(',')
      }

      const { data } = await $api.instance.get(
        `/api/v2/internal/${loadedWorkspaceId.value}/${loadedBaseId.value}/chat/suggestions`,
        { params },
      )

      if (data?.suggestions?.length) {
        emptySuggestions.value.set(type, data.suggestions)
      }
    } catch {
      // Suggestions API failed — skeleton stays visible
    } finally {
      isLoadingSuggestions.value = false
    }
  }

  const initChatSocket = () => {
    if (socketListenerId || !user.value?.id) return

    // Reset sending state on disconnect to avoid permanently locked UI.
    // On reconnect, reload messages in case we missed events while disconnected.
    disconnectUnsub = $ncSocket.on('disconnect', () => {
      if (isSendingMessage.value) isSendingMessage.value = false
    })

    reconnectUnsub = $ncSocket.on('reconnect', () => {
      const sessionId = activeSessionId.value
      if (sessionId && loadedWorkspaceId.value && loadedBaseId.value) {
        loadMessages(sessionId).catch(() => {})
      }
    })

    socketListenerId = $ncSocket.onMessage(`user:${user.value.id}`, (data: any) => {
      if (data.event !== EventType.CHAT_EVENT) return
      const payload = data as ChatEventPayload
      const { action, sessionId } = payload
      if (!sessionId) return

      // Ignore events for cancelled sessions; terminal events clear the flag
      if (cancelledSessionIds.has(sessionId)) {
        if (action === ChatEventAction.ERROR || action === ChatEventAction.MESSAGE_DONE) {
          cancelledSessionIds.delete(sessionId)
        }
        return
      }

      switch (action) {
        case ChatEventAction.AGENT_SWITCH: {
          activeAgent.value = payload.agent || null
          if (payload.agentLabel) agentLabel.value = payload.agentLabel
          break
        }

        case ChatEventAction.TOOL_START: {
          const state = getOrCreateStreaming(sessionId)
          streamingStates.value.set(sessionId, {
            ...state,
            parts: [
              ...state.parts,
              {
                type: 'tool_use',
                id: payload.toolCallId || '',
                name: payload.name || '',
                status: ChatToolCallStatus.RUNNING,
                agent: payload.agent,
                visibility: payload.visibility as ChatToolVisibility | undefined,
              } as ChatContentBlock,
            ],
          })
          break
        }

        case ChatEventAction.TOKEN: {
          const state = getOrCreateStreaming(sessionId)
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

        case ChatEventAction.TOOL_CALL: {
          const state = streamingStates.value.get(sessionId)
          if (state) {
            const parts = state.parts.map((p) =>
              p.type === 'tool_use' && p.id === payload.toolCallId ? { ...p, input: payload.args } : p,
            )
            streamingStates.value.set(sessionId, { ...state, parts })
          }
          break
        }

        case ChatEventAction.TOOL_RESULT: {
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

        case ChatEventAction.MESSAGE_UPDATE: {
          const currentMsgs = messages.value.get(sessionId)
          if (currentMsgs && payload.messageId && payload.parts?.length) {
            const updated = currentMsgs.map((m) =>
              m.id === payload.messageId ? { ...m, parts: payload.parts as ChatContentBlock[] } : m,
            )
            messages.value.set(sessionId, updated)
            processToolOutputActions(payload.parts)
          }
          break
        }

        case ChatEventAction.MESSAGE_DONE: {
          const streaming = streamingStates.value.get(sessionId)

          if (streaming && streaming.parts.length) {
            // Prefer server-authoritative parts, fall back to locally-built streaming state
            const finalParts: ChatContentBlock[] = payload.parts?.length ? payload.parts : streaming.parts

            const currentMsgs = messages.value.get(sessionId) || []
            messages.value.set(sessionId, [
              ...currentMsgs,
              {
                id: payload.messageId || `msg-${Date.now()}`,
                fk_session_id: sessionId,
                role: ChatMessageRole.ASSISTANT,
                parts: finalParts,
                bt_span_id: payload.btSpanId ?? undefined,
                created_at: new Date().toISOString(),
              } as ChatMessageType,
            ])
          } else if (loadedWorkspaceId.value && loadedBaseId.value) {
            // No streaming state (e.g. reconnected mid-stream) — fall back to API
            loadMessages(sessionId).catch(() => {})
          }

          const doneParts = payload.parts?.length ? payload.parts : streaming?.parts
          if (doneParts) processToolOutputActions(doneParts)

          clearStreaming(sessionId)
          break
        }

        case ChatEventAction.FOLLOW_UPS: {
          if (payload.followUps?.length && payload.messageId) {
            followUps.value.set(payload.messageId, payload.followUps)
          }
          break
        }

        case ChatEventAction.ERROR: {
          clearStreaming(sessionId)
          message.error(payload.error || t('msg.error.aiAgentError'))
          break
        }

        case ChatEventAction.SESSION_CREATE: {
          if (payload.session?.id && !sessions.value.has(payload.session.id)) {
            sessions.value.set(payload.session.id, payload.session)
          }
          break
        }

        case ChatEventAction.SESSION_UPDATE: {
          if (payload.session?.id) {
            const existing = sessions.value.get(payload.session.id)
            if (existing) Object.assign(existing, payload.session)
          }
          break
        }

        case ChatEventAction.SESSION_DELETE: {
          sessions.value.delete(sessionId)
          messages.value.delete(sessionId)
          streamingStates.value.delete(sessionId)

          if (activeSessionId.value === sessionId) {
            activeSessionId.value = sessionList.value[0]?.id || null
          }
          break
        }

        case ChatEventAction.USER_MESSAGE: {
          if (payload.message) {
            const currentMsgs = messages.value.get(sessionId) || []

            // Avoid duplicates — sender tab already has the optimistic message
            if (!currentMsgs.some((m) => m.id === payload.message!.id)) {
              messages.value.set(sessionId, [...currentMsgs, payload.message])
            }

            if (sessionId === activeSessionId.value) {
              isSendingMessage.value = true
            }
          }
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
    if (disconnectUnsub) {
      disconnectUnsub()
      disconnectUnsub = null
    }
    if (reconnectUnsub) {
      reconnectUnsub()
      reconnectUnsub = null
    }
  }

  const messageFeedback = async (sessionId: string, messageId: string, score: 1 | 0) => {
    if (!loadedWorkspaceId.value || !loadedBaseId.value || !sessionId || !messageId) return
    try {
      await $api.instance.post(
        `/api/v2/internal/${loadedWorkspaceId.value}/${loadedBaseId.value}/chat/sessions/${sessionId}/messages/${messageId}/feedback`,
        { score },
      )
    } catch {}
  }

  const cancelSending = async () => {
    const sessionId = activeSessionId.value
    if (!sessionId) return

    // Block socket events immediately — streaming freezes visually.
    // Auto-clear after 30s if the terminal event (MESSAGE_DONE/ERROR) never arrives.
    cancelledSessionIds.add(sessionId)
    setTimeout(() => cancelledSessionIds.delete(sessionId), 30_000)

    if (loadedWorkspaceId.value && loadedBaseId.value) {
      try {
        await $api.instance.post(
          `/api/v2/internal/${loadedWorkspaceId.value}/${loadedBaseId.value}/chat/sessions/${sessionId}/abort`,
        )
      } catch {}
    }

    // Promote frozen streaming to a final message, resolving RUNNING tools to ERROR
    const streaming = streamingStates.value.get(sessionId)
    if (streaming && streaming.parts.length) {
      const resolvedParts = streaming.parts.map((p) =>
        p.type === 'tool_use' && p.status === ChatToolCallStatus.RUNNING ? { ...p, status: ChatToolCallStatus.ERROR } : p,
      ) as ChatContentBlock[]

      const currentMsgs = messages.value.get(sessionId) || []
      messages.value.set(sessionId, [
        ...currentMsgs,
        {
          id: streaming.id,
          fk_session_id: sessionId,
          role: ChatMessageRole.ASSISTANT,
          parts: resolvedParts,
          created_at: new Date().toISOString(),
        } as ChatMessageType,
      ])
    }

    clearStreaming(sessionId)
  }

  const reset = () => {
    sessions.value.clear()
    messages.value.clear()
    streamingStates.value.clear()
    followUps.value.clear()
    emptySuggestions.value.clear()
    freshSessionIds.clear()
    cancelledSessionIds.clear()
    loadedWorkspaceId.value = null
    loadedBaseId.value = null
    activeSessionId.value = null
    isLoadingSessions.value = false
    isSendingMessage.value = false
    isLoadingSuggestions.value = false
    destroyChatSocket()
  }

  watch(activeSessionId, (id, oldId) => {
    if (!id || !loadedWorkspaceId.value) return
    if (loadedBaseId.value) localStorage.setItem(sessionStorageKey(loadedWorkspaceId.value, loadedBaseId.value), id)

    // Reset sending state when switching — shouldn't carry over from previous session
    if (oldId && id !== oldId && isSendingMessage.value) {
      isSendingMessage.value = false
    }
  })

  watch(token, (newToken) => {
    if (!newToken) reset()
  })

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
