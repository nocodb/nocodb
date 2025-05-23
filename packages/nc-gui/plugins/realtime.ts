import { defineNuxtPlugin } from '#app'
import RealtimeStatus from '~/components/realtime/Status.vue'
import RealtimeSyncOverlay from '~/components/realtime/SyncOverlay.vue'
import { useRealtimeStore } from '~/store/realtime'
import { RealtimeSyncStatus } from '~/composables/useRealtime'

export default defineNuxtPlugin((nuxtApp) => {
  // Register components globally
  nuxtApp.vueApp.component('RealtimeStatus', RealtimeStatus)
  nuxtApp.vueApp.component('RealtimeSyncOverlay', RealtimeSyncOverlay)
  
  // Get stores and services
  const realtimeStore = useRealtimeStore()
  
  // Wait until socket.ts plugin is initialized
  nuxtApp.hook('app:created', () => {
    // Ensure $realtime is defined
    if (!nuxtApp.$realtime) {
      console.warn('Realtime plugin: $realtime is not defined. Socket plugin may not be initialized yet.')
      return
    }
    
    const { $realtime, $toast } = nuxtApp
    
    // Setup auto-reconnect behavior
    let reconnectHandler: ReturnType<typeof watch> | null = null
    
    // Watch for connection status changes
    reconnectHandler = watch(
      () => $realtime.status?.value,
      async (newStatus, oldStatus) => {
        // Skip if status is undefined
        if (newStatus === undefined) return
        
        // If reconnected after disconnection
        if (newStatus === 'connected' && oldStatus !== 'connected') {
          // Check if auto-sync is enabled
          if (realtimeStore.notifications.autoSyncOnReconnect) {
            // Get the active project ID
            const { activeProjectId } = storeToRefs(useBases())
            
            if (activeProjectId.value) {
              // Sync missed events if any
              try {
                console.log('Auto-reconnect sync enabled, attempting to sync missed events for base:', activeProjectId.value);
                
                // Explicitly call the API with retry logic
                const { $api } = nuxtApp;
                if (!$api) {
                  console.error('API client not available for sync');
                  return;
                }

                // Get the last synchronized event ID from metadata
                const dbInstance = metadataManager.getKnex();
                const syncData = await dbInstance('sync_metadata')
                  .where({ workspace_id: 'nc', base_id: activeProjectId.value })
                  .first();
                
                console.log('Sync data for auto-reconnect:', syncData);
                
                // Check if we have sync data before syncing
                if (syncData && syncData.last_event_id) {
                  console.log('Calling syncMissedEvents with lastEventId:', syncData.last_event_id);
                  
                  // Call the store method with proper error handling
                  realtimeStore.syncMissedEvents(activeProjectId.value).then(count => {
                    console.log('Sync completed, processed events:', count);
                    if (count > 0 && $toast) {
                      $toast.info(`Synchronized ${count} missed events`)
                    }
                  }).catch(err => {
                    console.error('Failed to sync missed events:', err)
                    // Handle error directly in the catch block to prevent further exceptions
                    if (realtimeStore.notifications.showErrorToasts && $toast) {
                      try {
                        const errorMsg = err?.message || 'Unknown error'
                        $toast.error(`Sync failed: ${errorMsg}`)
                      } catch (toastError) {
                        console.error('Failed to show error toast:', toastError)
                      }
                    }
                  })
                } else {
                  console.log('No sync data available, attempting full bootstrap instead');
                  realtimeStore.syncBase(activeProjectId.value)
                    .then(success => {
                      if (success && $toast) {
                        $toast.success('Base synchronized successfully');
                      }
                    })
                    .catch(err => {
                      console.error('Bootstrap failed:', err);
                    });
                }
              } catch (err) {
                console.error('Error initiating sync process:', err)
              }
            }
          }
        }
        
        // Update UI status
        if (newStatus === 'connected') {
          realtimeStore.setStatus(RealtimeSyncStatus.CONNECTED)
        } else if (newStatus === 'connecting') {
          realtimeStore.setStatus(RealtimeSyncStatus.CONNECTING)
        } else if (newStatus === 'error' || newStatus === 'disconnected') {
          realtimeStore.setStatus(RealtimeSyncStatus.ERROR)
        }
      },
      { immediate: true }
    )
    
    // Clean up on app unmount
    nuxtApp.hook('app:unmounted', () => {
      if (reconnectHandler) {
        reconnectHandler()
      }
    })
  })
  
  return {
    provide: {
      realtimeStore,
    }
  }
})