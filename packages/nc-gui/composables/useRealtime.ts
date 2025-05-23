import { debounce } from 'lodash-es'
import { metadataManager } from '~/db/MetaManager'
import type { RealtimeEvent } from '~/plugins/socket'
import { RealtimeEventType } from '~/plugins/socket'
import { useRealtimeStore } from '~/store/realtime'

export enum RealtimeSyncStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  SYNCING = 'syncing',
  CONNECTED = 'connected',
  ERROR = 'error',
}

const useRealtime = createSharedComposable(() => {
  const { $realtime } = useNuxtApp()
  const { activeProjectId } = storeToRefs(useBases())
  const realtimeStore = useRealtimeStore()

  // Queue for batching events
  const eventQueue = ref<RealtimeEvent[]>([])

  // Process events in batches for better performance
  const processEventQueue = debounce(async () => {
    if (eventQueue.value.length === 0) return

    const events = [...eventQueue.value]
    eventQueue.value = []

    realtimeStore.setStatus(RealtimeSyncStatus.SYNCING)

    try {
      // Group events by type for more efficient processing
      const insertEvents = events.filter((e) => e.type === RealtimeEventType.META_INSERT)
      const updateEvents = events.filter((e) => e.type === RealtimeEventType.META_UPDATE)
      const deleteEvents = events.filter((e) => e.type === RealtimeEventType.META_DELETE)

      // Process events in the correct order: deletes, then inserts, then updates
      // This helps avoid foreign key constraint issues
      for (const event of [...deleteEvents, ...insertEvents, ...updateEvents]) {
        // Handle event in store first
        realtimeStore.handleEvent(event)

        // Apply to local database
        await metadataManager.applyEvent(event)

        // Record successful processing
        realtimeStore.recordProcessedEvent()
      }

      realtimeStore.setStatus(RealtimeSyncStatus.CONNECTED)
    } catch (err) {
      console.error('Error processing realtime events:', err)
      realtimeStore.setError(err.message)
    } finally {
    }
  }, 300) // Process events in batches with a short delay

  // Keep track of connection status
  watch(
    () => $realtime.status.value,
    (newStatus) => {
      switch (newStatus) {
        case 'connected':
          realtimeStore.setStatus(RealtimeSyncStatus.CONNECTED)
          break
        case 'connecting':
          realtimeStore.setStatus(RealtimeSyncStatus.CONNECTING)
          break
        case 'disconnected':
        case 'error':
          if (realtimeStore.status !== RealtimeSyncStatus.ERROR) {
            realtimeStore.setError(newStatus === 'error' ? 'Connection error' : 'Disconnected', newStatus)
          }
          break
      }
    },
  )

  // Initial subscription
  onMounted(async () => {
    if (activeProjectId?.value) {
      try {
        // Update UI state
        realtimeStore.setStatus(RealtimeSyncStatus.CONNECTING)
        console.log('Initializing realtime connection for base:', activeProjectId.value)

        // Try to subscribe to realtime events with retries
        let subscribed = false
        let attempts = 0
        const maxAttempts = 3

        while (!subscribed && attempts < maxAttempts) {
          attempts++
          try {
            console.log(`Subscription attempt ${attempts}/${maxAttempts}`)
            await $realtime.subscribe('nc', activeProjectId.value)
            subscribed = true
            console.log('Successfully subscribed to realtime events')
          } catch (subscribeErr) {
            console.warn(`Subscription attempt ${attempts} failed:`, subscribeErr)

            if (attempts < maxAttempts) {
              // Wait before retrying
              await new Promise((resolve) => setTimeout(resolve, 1000 * attempts))
            } else {
              throw subscribeErr // Re-throw on final attempt
            }
          }
        }

        // Start sync process
        if (subscribed) {
          console.log('Starting metadata sync process')
          await realtimeStore.syncBase(activeProjectId.value)
          console.log('Metadata sync completed')
        }
      } catch (err) {
        console.error('Failed to initialize realtime connection:', err)
        realtimeStore.setError(err.message)
      }
    }
  })

  // Manage subscriptions when active project changes
  watch(activeProjectId, async (newBaseId, oldBaseId) => {
    if (oldBaseId) {
      try {
        console.log(`Unsubscribing from base: ${oldBaseId}`)
        await $realtime.unsubscribe('nc', oldBaseId)
        realtimeStore.updateSubscription(oldBaseId, false)
        console.log(`Successfully unsubscribed from base: ${oldBaseId}`)
      } catch (err) {
        console.warn('Error unsubscribing from base:', err)
      }
    }

    if (newBaseId) {
      try {
        // Connect to new base
        realtimeStore.setStatus(RealtimeSyncStatus.CONNECTING)
        console.log(`Subscribing to new base: ${newBaseId}`)

        // Try to subscribe to realtime events with retries
        let subscribed = false
        let attempts = 0
        const maxAttempts = 3

        while (!subscribed && attempts < maxAttempts) {
          attempts++
          try {
            console.log(`Subscription attempt ${attempts}/${maxAttempts} for base ${newBaseId}`)
            await $realtime.subscribe('nc', newBaseId)
            subscribed = true
            console.log(`Successfully subscribed to base: ${newBaseId}`)
          } catch (subscribeErr) {
            console.warn(`Subscription attempt ${attempts} failed:`, subscribeErr)

            if (attempts < maxAttempts) {
              // Wait before retrying
              await new Promise((resolve) => setTimeout(resolve, 1000 * attempts))
            } else {
              throw subscribeErr // Re-throw on final attempt
            }
          }
        }

        // Clear existing event queue when switching bases
        eventQueue.value = []
        console.log('Event queue cleared')

        // Start sync process
        if (subscribed) {
          console.log(`Starting metadata sync for base: ${newBaseId}`)
          await realtimeStore.syncBase(newBaseId)
          console.log(`Metadata sync completed for base: ${newBaseId}`)
        }
      } catch (err) {
        console.error('Failed to subscribe to new base:', err)
        realtimeStore.setError(err.message)
      }
    }
  })

  // Subscribe to realtime events with cleanup
  const removeListener = $realtime.on((event) => {
    // Add the event to the queue
    eventQueue.value.push(event)

    // Process the queue
    processEventQueue()
  })

  // Clean up on component unmount
  onBeforeUnmount(() => {
    removeListener()
    processEventQueue.cancel()

    if (activeProjectId.value) {
      $realtime.unsubscribe('nc', activeProjectId.value).catch((err) => {
        console.warn('Error unsubscribing on unmount:', err)
      })
    }
  })

  /**
   * Force a manual sync of metadata
   */
  const syncMetadata = async (workspaceId = 'nc', baseId = activeProjectId.value) => {
    if (!baseId) return
    await realtimeStore.syncBase(baseId, workspaceId)
  }

  /**
   * Check for and sync any missed events
   */
  const syncMissedEvents = async (workspaceId = 'nc', baseId = activeProjectId.value) => {
    if (!baseId) return 0
    return await realtimeStore.syncMissedEvents(baseId, workspaceId)
  }

  /**
   * Reset a base's local data and force a resync
   */
  const resetAndResyncBase = async (workspaceId = 'nc', baseId = activeProjectId.value) => {
    if (!baseId) return false
    return await realtimeStore.resetAndResyncBase(baseId, workspaceId)
  }

  /**
   * Toggle realtime notification settings
   */
  const toggleNotifications = (setting: 'showEventToasts' | 'showErrorToasts' | 'autoSyncOnReconnect', value?: boolean) => {
    realtimeStore.toggleNotifications(setting, value)
  }

  // Function to manually test the sync API
  const testSyncEvents = async (baseId = activeProjectId.value) => {
    if (!baseId) {
      console.error('No base ID provided for testing')
      return { success: false, error: 'No base ID provided' }
    }

    try {
      console.log('Testing syncEvents API for base:', baseId)
      const { $api } = useNuxtApp()

      if (!$api) {
        return { success: false, error: 'API client not available' }
      }

      // Call the API directly
      const response = await $api.base.syncEvents({
        workspace_id: 'nc',
        base_id: baseId,
        since: '', // Empty string to get all events
        sinceType: 'event_id',
        offset: 0,
        limit: 100,
      })

      console.log('SyncEvents API test response:', response)
      return {
        success: true,
        data: response,
        count: Array.isArray(response) ? response.length : 0,
      }
    } catch (error) {
      console.error('SyncEvents API test failed:', error)
      return {
        success: false,
        error: error.message || 'Unknown error',
        details: error,
      }
    }
  }
  
  /**
   * Execute a custom SQL query on the PgLite database
   * @param query SQL query to execute
   * @returns Query results
   */
  const executeQuery = async (query: string) => {
    if (!metadataManager) {
      return { 
        success: false, 
        error: 'Metadata manager not initialized' 
      }
    }

    try {
      console.log('Executing query:', query)
      
      // Get the Knex instance
      const knex = metadataManager.getKnex()
      
      // Determine if this is a SELECT query or an action query
      const isSelect = query.trim().toLowerCase().startsWith('select')
      
      if (isSelect) {
        // For SELECT queries, return the results
        const results = await knex.raw(query)
        console.log('Query results:', results)
        return { 
          success: true, 
          results,
          isSelect: true,
          rowCount: results?.length || 0
        }
      } else {
        // For action queries (INSERT, UPDATE, DELETE), return affected rows
        const result = await knex.raw(query)
        console.log('Query affected rows:', result)
        return { 
          success: true, 
          isSelect: false,
          affectedRows: result,
          message: `Query executed successfully. Affected rows: ${result}`
        }
      }
    } catch (error) {
      console.error('Query execution failed:', error)
      return { 
        success: false, 
        error: error.message || 'Unknown error',
        details: error 
      }
    }
  }

  return {
    // Core services
    metadataManager,
    realtimeStore,

    // State computed properties (for backward compatibility)
    isConnected: computed(() => realtimeStore.isConnected),
    isSyncing: computed(() => realtimeStore.isSyncing),
    hasError: computed(() => realtimeStore.hasError),

    // Sync operations
    syncMetadata,
    syncMissedEvents,
    resetAndResyncBase,
    toggleNotifications,

    // Testing functions
    testSyncEvents,
    executeQuery,

    // Notification settings
    notificationSettings: computed(() => realtimeStore.notifications),
  }
})

export default useRealtime
