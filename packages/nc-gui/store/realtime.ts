import { defineStore } from 'pinia'
import { MetadataError, MetadataErrorType, metadataManager } from '~/db/MetaManager'
import type { RealtimeEvent } from '~/plugins/socket'
import { RealtimeEventType } from '~/plugins/socket'
import { RealtimeSyncStatus } from '~/composables/useRealtime'

export interface RealtimeState {
  // Current connection status
  status: RealtimeSyncStatus
  // Current error if any
  error: { message: string; type: string } | null
  // Statistics for realtime events
  stats: {
    // Total events received
    eventsReceived: number
    // Successful events processed
    eventsProcessed: number
    // Total errors encountered
    errors: number
    // Last sync timestamp
    lastSyncTime: number | null
    // Last event timestamp
    lastEventTime: number | null
    // Number of base bootstraps
    bootstrapCount: number
  }
  // Info about the current or most recent sync operation
  syncInfo: {
    // Base being synced
    baseId: string | null
    // Last event ID processed
    lastEventId: string | null
    // Start time of current sync operation
    startTime: number | null
    // End time of last sync operation
    endTime: number | null
    // If sync is in progress
    inProgress: boolean
  }
  // Notification settings
  notifications: {
    // Show notification toasts for events
    showEventToasts: boolean
    // Show notification toasts for errors
    showErrorToasts: boolean
    // Auto-sync on reconnect
    autoSyncOnReconnect: boolean
  }
  // Per-base subscription status
  subscriptions: Record<
    string,
    {
      active: boolean
      lastError: string | null
      lastSync: number | null
    }
  >
}

export const useRealtimeStore = defineStore('realtime', {
  state: (): RealtimeState => ({
    status: RealtimeSyncStatus.IDLE,
    error: null,
    stats: {
      eventsReceived: 0,
      eventsProcessed: 0,
      errors: 0,
      lastSyncTime: null,
      lastEventTime: null,
      bootstrapCount: 0,
    },
    syncInfo: {
      baseId: null,
      lastEventId: null,
      startTime: null,
      endTime: null,
      inProgress: false,
    },
    notifications: {
      showEventToasts: false, // Default to false to avoid notification spam
      showErrorToasts: true,
      autoSyncOnReconnect: true,
    },
    subscriptions: {},
  }),

  getters: {
    // Is realtime connected and ready
    isConnected: (state) => state.status === RealtimeSyncStatus.CONNECTED,

    // Is currently syncing
    isSyncing: (state) => state.status === RealtimeSyncStatus.SYNCING || state.syncInfo.inProgress,

    // Has an error
    hasError: (state) => state.status === RealtimeSyncStatus.ERROR,

    // Get state for a specific base
    baseStatus: (state) => (baseId: string) => {
      return (
        state.subscriptions[baseId] || {
          active: false,
          lastError: null,
          lastSync: null,
        }
      )
    },

    // Time since last sync in seconds
    timeSinceLastSync: (state) => {
      if (!state.stats.lastSyncTime) return null
      return Math.floor((Date.now() - state.stats.lastSyncTime) / 1000)
    },

    // Time since last event in seconds
    timeSinceLastEvent: (state) => {
      if (!state.stats.lastEventTime) return null
      return Math.floor((Date.now() - state.stats.lastEventTime) / 1000)
    },
  },

  actions: {
    /**
     * Update the connection status
     */
    setStatus(status: RealtimeSyncStatus) {
      this.status = status

      // Clear error if connected
      if (status === RealtimeSyncStatus.CONNECTED) {
        this.error = null
      }
    },

    /**
     * Set an error
     */
    setError(message: string | Error, type: string = 'error') {
      // Handle error objects
      const errorMessage = message instanceof Error ? message.message : message

      this.error = { message: errorMessage, type }
      this.status = RealtimeSyncStatus.ERROR
      this.stats.errors++

      // Show error toast if enabled
      if (this.notifications.showErrorToasts) {
        const { $toast } = useNuxtApp()
        if ($toast) {
          $toast.error(errorMessage)
        } else {
          console.error('Toast not available:', errorMessage)
        }
      }
    },

    /**
     * Update subscription status for a base
     */
    updateSubscription(baseId: string, active: boolean, error: string | null = null) {
      this.subscriptions[baseId] = {
        active,
        lastError: error,
        lastSync: active ? Date.now() : this.subscriptions[baseId]?.lastSync || null,
      }
    },

    /**
     * Handle a received event
     */
    handleEvent(event: RealtimeEvent) {
      this.stats.eventsReceived++
      this.stats.lastEventTime = Date.now()

      // Show notification for the event if enabled
      if (this.notifications.showEventToasts) {
        const { $toast } = useNuxtApp()
        const targetName = event.data.target?.split('_')?.pop()?.replace('v2', '') || 'metadata'

        switch (event.type) {
          case RealtimeEventType.META_INSERT:
            $toast.info(`New ${targetName} created`)
            break
          case RealtimeEventType.META_UPDATE:
            $toast.info(`${targetName} updated`)
            break
          case RealtimeEventType.META_DELETE:
            $toast.info(`${targetName} deleted`)
            break
        }
      }

      // Update event ID if present
      if (event.data.eventId) {
        this.syncInfo.lastEventId = event.data.eventId
      }

      // Update base subscription if needed
      if (event.data.base_id && !this.subscriptions[event.data.base_id]) {
        this.updateSubscription(event.data.base_id, true)
      }
    },

    /**
     * Record a successfully processed event
     */
    recordProcessedEvent() {
      this.stats.eventsProcessed++
      this.stats.lastSyncTime = Date.now()
    },

    /**
     * Begin a sync operation
     */
    startSync(baseId: string) {
      this.syncInfo = {
        baseId,
        lastEventId: this.syncInfo.lastEventId,
        startTime: Date.now(),
        endTime: null,
        inProgress: true,
      }
      this.status = RealtimeSyncStatus.SYNCING
    },

    /**
     * End a sync operation
     */
    endSync(success: boolean = true) {
      this.syncInfo.endTime = Date.now()
      this.syncInfo.inProgress = false
      this.stats.lastSyncTime = Date.now()

      if (success) {
        this.status = RealtimeSyncStatus.CONNECTED

        // Update subscription for the base
        if (this.syncInfo.baseId) {
          this.updateSubscription(this.syncInfo.baseId, true)
        }
      } else {
        this.status = RealtimeSyncStatus.ERROR
      }
    },

    /**
     * Record a bootstrap operation
     */
    recordBootstrap(baseId: string) {
      this.stats.bootstrapCount++
      this.stats.lastSyncTime = Date.now()
      this.updateSubscription(baseId, true)
    },

    /**
     * Reset all stats and errors
     */
    resetStats() {
      this.error = null
      this.stats = {
        eventsReceived: 0,
        eventsProcessed: 0,
        errors: 0,
        lastSyncTime: null,
        lastEventTime: null,
        bootstrapCount: 0,
      }
    },

    /**
     * Toggle notification settings
     */
    toggleNotifications(setting: 'showEventToasts' | 'showErrorToasts' | 'autoSyncOnReconnect', value?: boolean) {
      if (value !== undefined) {
        this.notifications[setting] = value
      } else {
        this.notifications[setting] = !this.notifications[setting]
      }
    },

    /**
     * Synchronize metadata for a base
     */
    async syncBase(baseId: string, workspaceId: string = 'nc'): Promise<boolean> {
      if (!baseId) return false

      try {
        this.startSync(baseId)

        // Perform bootstrap from server
        await metadataManager.bootstrap(workspaceId, baseId)

        this.recordBootstrap(baseId)
        this.endSync(true)
        return true
      } catch (err) {
        // Handle different error types
        if (err instanceof MetadataError) {
          this.setError(err.message, err.type)
        } else {
          this.setError(err.message || 'Failed to synchronize metadata', MetadataErrorType.SYNC_FAILED)
        }

        this.endSync(false)

        // Update subscription status
        this.updateSubscription(baseId, false, err.message)

        return false
      }
    },

    /**
     * Check for and synchronize missed events
     */
    async syncMissedEvents(baseId: string, workspaceId: string = 'nc'): Promise<number> {
      if (!baseId) return 0

      try {
        this.startSync(baseId)

        // Sync missed events
        const eventCount = await metadataManager.syncMissedEvents(workspaceId, baseId)

        this.endSync(true)
        return eventCount
      } catch (err) {
        console.error('Error in syncMissedEvents:', err)

        // Handle different error types
        try {
          if (err instanceof MetadataError) {
            this.setError(err.message, err.type)
          } else {
            this.setError(err.message || 'Failed to synchronize missed events', MetadataErrorType.SYNC_FAILED)
          }
        } catch (innerError) {
          // Handle case where error handling itself fails
          console.error('Error in error handler:', innerError)
        }

        // Always end sync even if error handling fails
        try {
          this.endSync(false)
        } catch (syncEndError) {
          console.error('Failed to end sync after error:', syncEndError)
        }

        return 0
      }
    },

    /**
     * Reset a base's local data and resync from server
     */
    async resetAndResyncBase(baseId: string, workspaceId: string = 'nc'): Promise<boolean> {
      if (!baseId) return false

      try {
        this.startSync(baseId)

        // Clear local data
        await metadataManager.clearBaseData(baseId)

        // Bootstrap from server
        await metadataManager.bootstrap(workspaceId, baseId)

        this.recordBootstrap(baseId)
        this.endSync(true)

        // Show success toast
        const { $toast } = useNuxtApp()
        $toast.success('Base data has been reset and resynced successfully')

        return true
      } catch (err) {
        // Handle different error types
        if (err instanceof MetadataError) {
          this.setError(err.message, err.type)
        } else {
          this.setError(err.message || 'Failed to reset and resync base', MetadataErrorType.SYNC_FAILED)
        }

        this.endSync(false)
        return false
      }
    },
  },

  // Use persist plugin to save notification preferences
  persist: {
    paths: ['notifications'],
  },
})
