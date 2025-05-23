<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import useRealtime, { RealtimeSyncStatus } from '~/composables/useRealtime'
import { useRealtimeStore } from '~/store/realtime'

const props = defineProps({
  showAlways: {
    type: Boolean,
    default: false,
  },
})

dayjs.extend(relativeTime)

const { activeProjectId } = storeToRefs(useBases())
const { $realtime, $toast } = useNuxtApp()
const { syncMetadata, syncMissedEvents, resetAndResyncBase, toggleNotifications } = useRealtime()
const realtimeStore = useRealtimeStore()

// UI state
const showStatusDetails = ref(false)
const showStatus = ref(props.showAlways)
const fadeTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// Status computed properties
const isConnected = computed(() => realtimeStore.isConnected)
const isSyncing = computed(() => realtimeStore.isSyncing)
const hasError = computed(() => realtimeStore.hasError)
const isActive = computed(() => realtimeStore.stats.eventsReceived > 0 || isSyncing.value)

// Status icon based on current state
const statusIcon = computed(() => {
  if (isSyncing.value) return resolveComponent('GeneralIconRefresh')
  if (hasError.value) return resolveComponent('GeneralIconWarning')
  if (isConnected.value) return resolveComponent('GeneralIconCheckCircle')
  return resolveComponent('GeneralIconDisconnect')
})

// Status text based on current state
const statusText = computed(() => {
  if (isSyncing.value) return 'Syncing...'
  if (hasError.value) return 'Error'
  if (isConnected.value) return 'Connected'
  return 'Disconnected'
})

// Status class for styling
const statusClass = computed(() => {
  if (isSyncing.value) return 'syncing'
  if (hasError.value) return 'error'
  if (isConnected.value) return 'success'
  return 'default'
})

// Notification settings with two-way binding
const showErrorToasts = computed({
  get: () => realtimeStore.notifications.showErrorToasts,
  set: (value) => toggleNotifications('showErrorToasts', value),
})

const showEventToasts = computed({
  get: () => realtimeStore.notifications.showEventToasts,
  set: (value) => toggleNotifications('showEventToasts', value),
})

const autoSyncOnReconnect = computed({
  get: () => realtimeStore.notifications.autoSyncOnReconnect,
  set: (value) => toggleNotifications('autoSyncOnReconnect', value),
})

// Format timestamp for display
const formatTime = (timestamp: number) => {
  return dayjs(timestamp).fromNow()
}

// Toggle status details popup
const toggleStatusDetails = () => {
  showStatusDetails.value = !showStatusDetails.value

  // If showing details, ensure status is visible
  if (showStatusDetails.value) {
    showStatus.value = true

    // Cancel any fade timer
    if (fadeTimer.value) {
      clearTimeout(fadeTimer.value)
      fadeTimer.value = null
    }
  }
}

// Confirm before resetting data
const confirmReset = () => {
  if (confirm('Are you sure you want to reset all local data? This will delete and re-sync all metadata for the current base.')) {
    resetAndResyncBase().then((success) => {
      if (success) {
        $toast.success('Base data has been reset and resynced successfully')
      }
    })
  }
}

// Watch for changes that should show the status
watch(
  [() => realtimeStore.status, () => realtimeStore.error],
  () => {
    // Show status indicator when state changes
    showStatus.value = true

    // Cancel any existing fade timer
    if (fadeTimer.value) {
      clearTimeout(fadeTimer.value)
      fadeTimer.value = null
    }

    // If not set to always show and not showing details, start fade timer
    if (!props.showAlways && !showStatusDetails.value && realtimeStore.status !== RealtimeSyncStatus.ERROR) {
      fadeTimer.value = setTimeout(() => {
        if (!showStatusDetails.value) {
          showStatus.value = false
        }
      }, 5000)
    }
  },
  { immediate: true },
)

// Show status when events are received
watch(
  () => realtimeStore.stats.eventsReceived,
  (newVal, oldVal) => {
    if (newVal > oldVal) {
      showStatus.value = true

      // Cancel any existing fade timer
      if (fadeTimer.value) {
        clearTimeout(fadeTimer.value)
        fadeTimer.value = null
      }

      // Set fade timer if not showing details
      if (!props.showAlways && !showStatusDetails.value) {
        fadeTimer.value = setTimeout(() => {
          if (!showStatusDetails.value) {
            showStatus.value = false
          }
        }, 5000)
      }
    }
  },
)

// Clean up timers when component is unmounted
onUnmounted(() => {
  if (fadeTimer.value) {
    clearTimeout(fadeTimer.value)
    fadeTimer.value = null
  }
})
</script>

<template>
  <div
    class="nc-realtime-status"
    :class="{
      active: isActive && isConnected,
      syncing: isSyncing,
      error: hasError,
      hidden: !showStatus,
    }"
    @click="toggleStatusDetails"
  >
    <div class="status-indicator">
      <div class="status-icon">
        <component :is="statusIcon" :size="16" class="icon" :class="{ spin: isSyncing }" />
      </div>
      <span class="status-text">{{ statusText }}</span>
    </div>

    <!-- Status Details Popup -->
    <div v-if="showStatusDetails" class="status-details">
      <div class="status-details-header">
        <h3>Realtime Sync Status</h3>
        <button class="close-btn" @click.stop="showStatusDetails = false">
          <GeneralIcon icon="close" size="12" />
        </button>
      </div>

      <div class="status-details-content">
        <div class="status-details-row">
          <span class="label">Status:</span>
          <span class="value" :class="statusClass">{{ statusText }}</span>
        </div>

        <div v-if="hasError" class="status-details-row error-details">
          <span class="label">Error:</span>
          <span class="value error">{{ realtimeStore.error?.message }}</span>
        </div>

        <div class="status-details-row">
          <span class="label">Connection:</span>
          <span
            class="value"
            :class="{
              success: $realtime?.status?.value === 'connected',
              error: $realtime?.status?.value === 'error',
            }"
          >
            {{ $realtime?.status?.value || 'Unknown' }}
          </span>
        </div>

        <div class="status-details-row">
          <span class="label">Current Base:</span>
          <span class="value">{{ activeProjectId }}</span>
        </div>

        <div class="status-section">
          <h4>Statistics</h4>
          <div class="status-details-row">
            <span class="label">Events Processed:</span>
            <span class="value">{{ realtimeStore.stats.eventsProcessed }}</span>
          </div>
          <div class="status-details-row">
            <span class="label">Errors:</span>
            <span class="value" :class="{ error: realtimeStore.stats.errors > 0 }">
              {{ realtimeStore.stats.errors }}
            </span>
          </div>
          <div class="status-details-row">
            <span class="label">Last Sync:</span>
            <span class="value">
              {{ realtimeStore.stats.lastSyncTime ? formatTime(realtimeStore.stats.lastSyncTime) : 'Never' }}
            </span>
          </div>
          <div class="status-details-row">
            <span class="label">Last Event:</span>
            <span class="value">
              {{ realtimeStore.stats.lastEventTime ? formatTime(realtimeStore.stats.lastEventTime) : 'Never' }}
            </span>
          </div>
        </div>

        <div class="status-actions">
          <NcButton type="secondary" size="small" :loading="isSyncing" :disabled="isSyncing" @click="syncMetadata">
            Force Sync
          </NcButton>
          <NcButton type="secondary" size="small" :loading="isSyncing" :disabled="isSyncing" @click="syncMissedEvents">
            Sync Missed
          </NcButton>
          <NcButton type="error" size="small" :disabled="isSyncing" @click="confirmReset"> Reset Data </NcButton>
        </div>

        <div class="status-section">
          <h4>Notifications</h4>
          <div class="status-details-row notification-setting">
            <NcCheckbox v-model="showErrorToasts" label="Show error notifications" />
          </div>
          <div class="status-details-row notification-setting">
            <NcCheckbox v-model="showEventToasts" label="Show event notifications" />
          </div>
          <div class="status-details-row notification-setting">
            <NcCheckbox v-model="autoSyncOnReconnect" label="Auto-sync on reconnect" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nc-realtime-status {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: var(--color-light);
  border: 1px solid var(--color-border);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  opacity: 1;
}

.nc-realtime-status.hidden {
  opacity: 0;
  pointer-events: none;
}

.nc-realtime-status.active {
  border-color: var(--color-success);
}

.nc-realtime-status.syncing {
  border-color: var(--color-info);
}

.nc-realtime-status.error {
  border-color: var(--color-error);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-icon .icon {
  color: var(--color-text-light);
}

.nc-realtime-status.active .status-icon .icon {
  color: var(--color-success);
}

.nc-realtime-status.syncing .status-icon .icon {
  color: var(--color-info);
}

.nc-realtime-status.error .status-icon .icon {
  color: var(--color-error);
}

.spin {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.status-text {
  font-weight: 500;
  color: var(--color-text);
}

/* Status Details Popup */
.status-details {
  position: absolute;
  top: calc(100% + 5px);
  right: 0;
  width: 300px;
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;
}

.status-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background-color: var(--color-light);
  border-bottom: 1px solid var(--color-border);
}

.status-details-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  color: var(--color-text-light);
}

.close-btn:hover {
  color: var(--color-text);
}

.status-details-content {
  padding: 10px 15px;
  max-height: 400px;
  overflow-y: auto;
}

.status-details-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.error-details {
  margin-bottom: 12px;
  padding: 8px;
  background-color: rgba(var(--color-error-rgb), 0.1);
  border-radius: 4px;
  flex-direction: column;
  align-items: flex-start;
}

.error-details .label {
  margin-bottom: 4px;
}

.error-details .value {
  word-break: break-word;
}

.status-details-row .label {
  color: var(--color-text-light);
  font-weight: 500;
}

.status-details-row .value {
  font-weight: 500;
}

.status-details-row .value.success {
  color: var(--color-success);
}

.status-details-row .value.error {
  color: var(--color-error);
}

.status-details-row .value.syncing {
  color: var(--color-info);
}

.status-section {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}

.status-section h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
}

.status-actions {
  display: flex;
  gap: 8px;
  margin: 15px 0;
}

.notification-setting {
  margin-bottom: 10px;
}
</style>
