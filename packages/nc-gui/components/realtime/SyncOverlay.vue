<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRealtimeStore } from '~/store/realtime'
import useRealtime, { RealtimeSyncStatus } from '~/composables/useRealtime'

const props = defineProps({
  // Whether to show the overlay when syncing
  showWhenSyncing: {
    type: Boolean,
    default: true,
  },
  // Whether to show the overlay when there's an error
  showWhenError: {
    type: Boolean,
    default: true,
  },
  // Whether to auto-close after successful sync
  autoClose: {
    type: Boolean,
    default: true,
  },
  // How long to show success state before closing (ms)
  successDuration: {
    type: Number,
    default: 1500,
  },
  // Minimum time to show the syncing state (ms)
  minSyncDuration: {
    type: Number,
    default: 500,
  },
  // Whether to show a fake progress bar
  showProgress: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['close', 'retry'])

const realtimeStore = useRealtimeStore()
const { syncMetadata } = useRealtime()

// UI state
const forceShow = ref(false)
const showSuccess = ref(false)
const progress = ref(0)
const progressInterval = ref<ReturnType<typeof setInterval> | null>(null)
const minSyncTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const successTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const canClose = ref(true)

// Computed properties for state
const isSyncing = computed(() => realtimeStore.isSyncing)
const hasError = computed(() => realtimeStore.hasError)
const isConnected = computed(() => realtimeStore.isConnected)

// Whether to show the overlay
const isVisible = computed(() => {
  return (
    forceShow.value || (props.showWhenSyncing && isSyncing.value) || (props.showWhenError && hasError.value) || showSuccess.value
  )
})

// Progress text
const progressText = computed(() => {
  return `${Math.round(progress.value)}%`
})

// Start fake progress animation
const startProgress = () => {
  progress.value = 0

  if (progressInterval.value) {
    clearInterval(progressInterval.value)
  }

  progressInterval.value = setInterval(() => {
    // Increase progress by random amount, slow down as we approach 90%
    const increment = progress.value < 50 ? Math.random() * 5 : progress.value < 80 ? Math.random() * 3 : Math.random() * 1

    progress.value = Math.min(progress.value + increment, 90)
  }, 300)
}

// Complete progress animation
const completeProgress = () => {
  if (progressInterval.value) {
    clearInterval(progressInterval.value)
    progressInterval.value = null
  }

  progress.value = 100
}

// Reset progress
const resetProgress = () => {
  if (progressInterval.value) {
    clearInterval(progressInterval.value)
    progressInterval.value = null
  }

  progress.value = 0
}

// Handle retry button click
const retry = () => {
  emit('retry')
  syncMetadata()
}

// Handle overlay click
const onOverlayClick = () => {
  if (props.autoClose && canClose.value && !isSyncing.value) {
    dismissError()
  }
}

// Dismiss error and close overlay
const dismissError = () => {
  if (!canClose.value) return

  forceShow.value = false
  showSuccess.value = false
  emit('close')
}

// Show success state briefly before closing
const showSuccessState = () => {
  completeProgress()
  showSuccess.value = true

  if (successTimer.value) {
    clearTimeout(successTimer.value)
  }

  if (props.autoClose) {
    successTimer.value = setTimeout(() => {
      showSuccess.value = false
      forceShow.value = false
      emit('close')
    }, props.successDuration)
  }
}

// Clean up all timers
const cleanupTimers = () => {
  if (progressInterval.value) {
    clearInterval(progressInterval.value)
    progressInterval.value = null
  }

  if (minSyncTimer.value) {
    clearTimeout(minSyncTimer.value)
    minSyncTimer.value = null
  }

  if (successTimer.value) {
    clearTimeout(successTimer.value)
    successTimer.value = null
  }
}

// Watch for syncing state change
watch(isSyncing, (newVal, oldVal) => {
  if (newVal && !oldVal) {
    // Started syncing
    startProgress()
    canClose.value = false

    // Set minimum sync duration timer
    if (minSyncTimer.value) {
      clearTimeout(minSyncTimer.value)
    }

    minSyncTimer.value = setTimeout(() => {
      canClose.value = true
    }, props.minSyncDuration)
  } else if (!newVal && oldVal) {
    // Finished syncing
    if (hasError.value) {
      resetProgress()
    } else {
      showSuccessState()
    }
  }
})

// Clean up when component is unmounted
onBeforeUnmount(() => {
  cleanupTimers()
})
</script>

<template>
  <div
    class="nc-realtime-sync-overlay"
    :class="{
      'visible': isVisible,
      'error': hasError,
      'syncing': isSyncing,
      'auto-close': autoClose,
    }"
    @click="onOverlayClick"
  >
    <div class="overlay-content" @click.stop>
      <!-- Syncing State -->
      <div v-if="isSyncing" class="sync-status">
        <div class="sync-icon">
          <GeneralIconRefresh size="32" class="spin" />
        </div>
        <h2>Synchronizing Metadata</h2>
        <p>Please wait while we synchronize your metadata...</p>

        <div v-if="showProgress" class="sync-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
          </div>
          <div class="progress-text">{{ progressText }}</div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="hasError" class="sync-status error">
        <div class="sync-icon">
          <GeneralIconWarning size="32" />
        </div>
        <h2>Synchronization Error</h2>
        <p>{{ realtimeStore.error?.message || 'Failed to synchronize metadata' }}</p>

        <div class="error-actions">
          <NcButton type="secondary" @click="retry"> Retry </NcButton>

          <NcButton type="primary" @click="dismissError"> Dismiss </NcButton>
        </div>
      </div>

      <!-- Success State (shown briefly) -->
      <div v-else-if="showSuccess" class="sync-status success">
        <div class="sync-icon">
          <GeneralIconCheckCircle size="32" />
        </div>
        <h2>Synchronization Complete</h2>
        <p>Your metadata has been successfully synchronized.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nc-realtime-sync-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.nc-realtime-sync-overlay.visible {
  opacity: 1;
  visibility: visible;
}

.nc-realtime-sync-overlay.auto-close {
  cursor: pointer;
}

.overlay-content {
  background-color: var(--color-background);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 400px;
  width: 100%;
  padding: 30px;
  cursor: default;
}

.sync-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.sync-icon {
  margin-bottom: 20px;
  color: var(--color-info);
}

.sync-status.error .sync-icon {
  color: var(--color-error);
}

.sync-status.success .sync-icon {
  color: var(--color-success);
}

.sync-status h2 {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 600;
}

.sync-status p {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--color-text-light);
  line-height: 1.5;
}

.sync-progress {
  width: 100%;
  margin-top: 20px;
}

.progress-bar {
  height: 8px;
  background-color: var(--color-border);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background-color: var(--color-info);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--color-text-light);
  text-align: right;
}

.error-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
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
</style>
