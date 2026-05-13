import { EventType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { SmartTextPayload } from 'nocodb-sdk'

interface SmartTextRealtimeOptions {
  tableId: Ref<string | null | undefined>
  rowId: Ref<string | null | undefined>
  columnId: Ref<string | null | undefined>
  /** Only subscribe while this is true (e.g. modal visible / panel open). */
  isActive: Ref<boolean>
  /** Read at message-arrival time. Determines `onApply` vs `onConflict`. */
  isDirty: () => boolean
  /** Local user has no unsaved edits — content can be swapped silently. */
  onApply: (payload: { pm: Record<string, any> | null; md: string | null; mdHash: string | null }) => void
  /** Local user is mid-edit — surface a refresh-banner via this callback. */
  onConflict: (payload: { pm: Record<string, any> | null; md: string | null; mdHash: string | null }) => void
}

/**
 * Subscribe to per-cell SmartText updates over socket.io.
 *
 * Joins `event-smart-text:{ws}:{base}:{table}:{col}:{row}` while `isActive` is
 * true and the cell ids are all populated. Re-subscribes when the active cell
 * changes; unsubscribes on inactive / scope dispose. Self-echoes are filtered
 * by `$ncSocket.onMessage` via the originating socketId.
 */
export function useSmartTextRealtime(opts: SmartTextRealtimeOptions) {
  const { $ncSocket } = useNuxtApp()

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const basesStore = useBases()
  const { activeProjectId } = storeToRefs(basesStore)

  const currentListenerId = ref<string | null>(null)
  const currentChannel = ref<string | null>(null)

  const unsubscribe = () => {
    if (currentListenerId.value) {
      $ncSocket.offMessage(currentListenerId.value)
      currentListenerId.value = null
      currentChannel.value = null
    }
  }

  // Channel order must match backend broadcastEvent scopes:
  // `event-smart-text:{ws}:{base}:{tableId}:{columnId}:{rowId}`.
  const channelKey = (ws: string, base: string, tableId: string, columnId: string, rowId: string) =>
    `${EventType.SMART_TEXT_EVENT}:${ws}:${base}:${tableId}:${columnId}:${rowId}`

  watch(
    [opts.isActive, opts.tableId, opts.columnId, opts.rowId, activeWorkspaceId, activeProjectId],
    ([active, tableId, columnId, rowId, ws, base]) => {
      if (!active || !tableId || !columnId || !rowId || !ws || !base) {
        unsubscribe()
        return
      }

      const next = channelKey(ws, base, tableId, columnId, rowId)
      if (currentChannel.value === next) return

      unsubscribe()

      const listenerId = $ncSocket.onMessage(next, (data: SmartTextPayload) => {
        if (!data || data.action !== 'update') return
        // Defensive — the room is already cell-scoped, but guard anyway in case
        // a future scope reuse / wildcard subscribes a broader room.
        if (data.tableId !== opts.tableId.value) return
        if (data.rowId !== opts.rowId.value) return
        if (data.columnId !== opts.columnId.value) return

        const payload = { pm: data.pm ?? null, md: data.md ?? null, mdHash: data.mdHash ?? null }
        if (opts.isDirty()) opts.onConflict(payload)
        else opts.onApply(payload)
      })

      if (listenerId) {
        currentListenerId.value = listenerId
        currentChannel.value = next
      }
    },
    { immediate: true },
  )

  tryOnScopeDispose(unsubscribe)

  return { unsubscribe }
}
