import { EventType, PresencePageType } from 'nocodb-sdk'
import type {
  PresenceAnnouncePayload,
  PresenceBatchPayload,
  PresenceLeavePayload,
  PresenceLocationChangePayload,
  PresencePayload,
} from 'nocodb-sdk'

const HEARTBEAT_INTERVAL = 30_000
const PRESENCE_TIMEOUT = 90_000
const SUBSCRIBE_SETTLE_MS = 500

const PRESENCE_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#14b8a6',
  '#a855f7',
  '#f43f5e',
]

function getConsistentColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]
}

const colorCache = new Map<string, string>()

function getCachedColor(userId: string): string {
  let color = colorCache.get(userId)
  if (!color) {
    color = getConsistentColor(userId)
    colorCache.set(userId, color)
  }
  return color
}

export interface CollaboratorPresence {
  userId: string
  email: string
  displayName: string
  /** Table ID (TABLE), dashboard ID (DASHBOARD), or workflow ID (AUTOMATION) */
  resourceId?: string
  /** Only meaningful when pageType is TABLE */
  viewId?: string
  pageType?: PresencePageType
  lastSeen: number
  color: string
  meta?: Record<string, any> | null
}

export const usePresence = createSharedComposable(() => {
  const { $ncSocket } = useNuxtApp()
  const { user } = useGlobal()
  const { activeTableId } = storeToRefs(useTablesStore())
  const { activeView } = storeToRefs(useViewsStore())
  const { activeDashboardId } = storeToRefs(useDashboardStore())
  const { activeWorkflowId } = storeToRefs(useWorkflowStore())
  const { activeScriptId } = storeToRefs(useScriptStore())
  const { activeWorkspaceId } = storeToRefs(useWorkspace())
  const { baseId: activeBaseId } = storeToRefs(useBase())

  const currentLocation = computed(() => {
    if (activeDashboardId.value) {
      return { pageType: PresencePageType.DASHBOARD, resourceId: activeDashboardId.value, viewId: undefined }
    }
    if (activeWorkflowId.value) {
      return { pageType: PresencePageType.AUTOMATION, resourceId: activeWorkflowId.value, viewId: undefined }
    }
    if (activeScriptId.value) {
      return { pageType: PresencePageType.SCRIPT, resourceId: activeScriptId.value, viewId: undefined }
    }
    return { pageType: PresencePageType.TABLE, resourceId: activeTableId.value, viewId: activeView.value?.id }
  })

  const collaborators = ref<Map<string, CollaboratorPresence>>(new Map())
  const activePresenceListener = ref<string | null>(null)
  const currentEventKey = ref<string | null>(null)
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let announceTimeout: ReturnType<typeof setTimeout> | null = null
  let unsubReconnect: (() => void) | null = null

  const presenceEnabled = useLocalStorage('nc-presence-enabled', true)

  const followingUserId = ref<string | null>(null)

  const follow = (userId: string) => {
    followingUserId.value = userId
  }

  const unfollow = () => {
    followingUserId.value = null
  }

  const followedCollab = computed(() => (followingUserId.value ? collaborators.value.get(followingUserId.value) ?? null : null))

  // ── Emit helpers ──────────────────────────────────────────────────────────
  const sendAnnounce = () => {
    if (!user.value?.id || !presenceEnabled.value) return
    const { pageType, resourceId, viewId } = currentLocation.value
    $ncSocket.emit('presence:update', {
      action: 'announce',
      user: {
        id: user.value.id,
        email: user.value.email,
        displayName: user.value.display_name,
        meta: user.value.meta || null,
      },
      resource: { id: resourceId!, type: pageType!, viewId },
    })
  }

  const sendHeartbeat = () => {
    if (!user.value?.id || !presenceEnabled.value) return
    const { pageType, resourceId, viewId } = currentLocation.value
    $ncSocket.emit('presence:update', {
      action: 'heartbeat',
      user: { id: user.value.id },
      resource: { id: resourceId!, type: pageType!, viewId },
    })
  }

  const sendLeave = () => {
    if (!currentEventKey.value || !user.value?.id) return
    $ncSocket.emit('presence:update', {
      action: 'leave',
      user: { id: user.value.id },
    })
  }

  // ── Presence event handler ────────────────────────────────────────────────
  const handlePresenceEvent = (payload: PresencePayload) => {
    if (!payload?.action) return
    if ('user' in payload && (payload as { user?: { id?: string } }).user?.id === user.value?.id) return

    if (payload.action === 'batch') {
      const { users } = payload as PresenceBatchPayload
      for (const u of users) {
        if (u.user.id === user.value?.id) continue
        collaborators.value.set(u.user.id, {
          userId: u.user.id,
          email: u.user.email,
          displayName: u.user.displayName,
          meta: u.user.meta,
          resourceId: u.resource.id,
          viewId: u.resource.viewId,
          pageType: u.resource.type as PresencePageType,
          lastSeen: u.lastSeen || Date.now(),
          color: getCachedColor(u.user.id),
        })
      }
      return
    }

    if (payload.action === 'leave') {
      const userId = (payload as PresenceLeavePayload).user.id
      collaborators.value.delete(userId)
      if (followingUserId.value === userId) unfollow()
      return
    }

    if (payload.action === 'location-change') {
      const p = payload as PresenceLocationChangePayload
      const existing = collaborators.value.get(p.user.id)
      if (existing) {
        collaborators.value.set(p.user.id, {
          ...existing,
          ...(p.resource.id !== undefined && { resourceId: p.resource.id }),
          ...(p.resource.viewId !== undefined && { viewId: p.resource.viewId }),
          ...(p.resource.type !== undefined && { pageType: p.resource.type as PresencePageType }),
          lastSeen: Date.now(),
        })
      }
      return
    }

    const p = payload as PresenceAnnouncePayload
    const existing = collaborators.value.get(p.user.id)
    collaborators.value.set(p.user.id, {
      ...(existing || {}),
      userId: p.user.id,
      email: p.user.email,
      displayName: p.user.displayName,
      meta: p.user.meta,
      resourceId: p.resource.id,
      viewId: p.resource.viewId,
      pageType: p.resource.type as PresencePageType,
      lastSeen: Date.now(),
      color: getCachedColor(p.user.id),
    })
  }

  // ── Heartbeat / stale cleanup ─────────────────────────────────────────────
  const cleanupStale = () => {
    const now = Date.now()
    for (const [userId, collab] of collaborators.value) {
      if (now - collab.lastSeen > PRESENCE_TIMEOUT) {
        collaborators.value.delete(userId)
        if (followingUserId.value === userId) followingUserId.value = null
      }
    }
  }

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  const startHeartbeat = () => {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      sendHeartbeat()
      cleanupStale()
    }, HEARTBEAT_INTERVAL)
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopHeartbeat()
    } else {
      sendHeartbeat()
      startHeartbeat()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  // ── Watch presenceEnabled toggle ──────────────────────────────────────────
  watch(presenceEnabled, (enabled) => {
    if (enabled) {
      sendAnnounce()
      startHeartbeat()
    } else {
      sendLeave()
      stopHeartbeat()
    }
  })

  // ── Room join / leave ─────────────────────────────────────────────────────
  const joinRoom = (wsId: string, bId: string) => {
    const eventKey = `${EventType.PRESENCE_EVENT}:${wsId}:${bId}`
    currentEventKey.value = eventKey

    const listenerId = $ncSocket.onMessage(eventKey, handlePresenceEvent)
    activePresenceListener.value = listenerId ?? null

    if (announceTimeout) clearTimeout(announceTimeout)
    announceTimeout = setTimeout(() => {
      if (currentEventKey.value === eventKey) {
        sendAnnounce()
        startHeartbeat()
      }
    }, SUBSCRIBE_SETTLE_MS)
  }

  const leaveRoom = () => {
    if (announceTimeout) {
      clearTimeout(announceTimeout)
      announceTimeout = null
    }
    if (activePresenceListener.value) {
      $ncSocket.offMessage(activePresenceListener.value)
      activePresenceListener.value = null
    }
    stopHeartbeat()
    collaborators.value.clear()
    sendLeave()
    currentEventKey.value = null
  }

  watch(
    [activeWorkspaceId, activeBaseId],
    ([wsId, bId]) => {
      leaveRoom()
      if (wsId && bId) joinRoom(wsId, bId)
    },
    { immediate: true },
  )

  watch(currentLocation, (newLoc, oldLoc) => {
    if (!currentEventKey.value) return
    const changed =
      newLoc.pageType !== oldLoc.pageType || newLoc.resourceId !== oldLoc.resourceId || newLoc.viewId !== oldLoc.viewId
    if (changed) sendHeartbeat()
  })

  unsubReconnect = $ncSocket.on('reconnect', () => {
    collaborators.value.clear()
    if (currentEventKey.value) {
      setTimeout(sendAnnounce, SUBSCRIBE_SETTLE_MS)
    }
  })

  const activeCollaborators = computed(() =>
    Array.from(collaborators.value.values()).sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? '')),
  )

  tryOnScopeDispose(() => {
    leaveRoom()
    if (unsubReconnect) {
      unsubReconnect()
      unsubReconnect = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  return { activeCollaborators, presenceEnabled, followingUserId, followedCollab, follow, unfollow }
})
