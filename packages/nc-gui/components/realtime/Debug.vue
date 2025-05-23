<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import useRealtime from '~/composables/useRealtime'
import { useRealtimeStore } from '~/store/realtime'

// State
const workspaceId = ref('nc')
const baseId = ref('')
const status = ref<'idle' | 'checking' | 'connected' | 'subscribing' | 'bootstrapping' | 'syncing' | 'clearing'>('idle')
const eventLogs = ref<{ message: string; type: 'info' | 'success' | 'error' | 'warning'; timestamp: number }[]>([])
const autoRefreshStatus = ref(true)
const syncMetadata = ref<any>(null)
const dbStats = ref<any>(null)
const refreshInterval = ref<any>(null)
const sqlQuery = ref('SELECT * FROM sync_metadata')
const queryResult = ref<any>(null)
const executingQuery = ref(false)
const queryResultColumns = computed(() => {
  if (queryResult.value?.success && queryResult.value?.isSelect && queryResult.value?.results?.length > 0) {
    return Object.keys(queryResult.value.results[0])
  }
  return []
})

// Get services and stores
const { $realtime, $socket } = useNuxtApp()
const realtime = useRealtime()
const realtimeStore = useRealtimeStore()
const { metadataManager } = realtime

// Computed properties
const socketStatus = computed(() => $realtime?.status?.value || 'disconnected')
const socketId = computed(() => $socket?.value?.id || null)
const subscriptions = computed(() => $realtime?.subscriptions?.value || {})
const dbInitialized = computed(() => metadataManager !== undefined)
const lastSyncTime = computed(() => {
  const stats = metadataManager?.getStats()
  return stats?.lastSyncTime ? formatTimestamp(stats.lastSyncTime) : 'Never'
})

// Methods
const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
  eventLogs.value.unshift({ message, type, timestamp: Date.now() })
  // Keep only the last 100 logs
  if (eventLogs.value.length > 100) {
    eventLogs.value = eventLogs.value.slice(0, 100)
  }
}

const formatTimestamp = (timestamp: number | string | null) => {
  if (!timestamp) return 'Never'

  let date: Date
  if (typeof timestamp === 'number') {
    date = new Date(timestamp)
  } else {
    date = new Date(timestamp)
  }

  return date.toLocaleString()
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

const getLogClass = (log: { type: string }) => {
  switch (log.type) {
    case 'success':
      return 'text-green-600'
    case 'error':
      return 'text-red-600'
    case 'warning':
      return 'text-yellow-600'
    default:
      return 'text-gray-800'
  }
}

const checkConnection = async () => {
  try {
    status.value = 'checking'
    addLog('Checking connection status...', 'info')

    // Wait a bit to simulate work
    await new Promise((resolve) => setTimeout(resolve, 500))

    if (socketStatus.value === 'connected') {
      addLog(`Connection active with socket ID: ${socketId.value}`, 'success')
      status.value = 'connected'
    } else {
      addLog(`Socket not connected. Current status: ${socketStatus.value}`, 'warning')

      // Try to connect
      addLog('Attempting to initialize connection...', 'info')
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Check again
      if (socketStatus.value === 'connected') {
        addLog(`Connection established with socket ID: ${socketId.value}`, 'success')
        status.value = 'connected'
      } else {
        addLog(`Failed to establish connection. Status: ${socketStatus.value}`, 'error')
        status.value = 'idle'
      }
    }
  } catch (error) {
    addLog(`Error checking connection: ${error.message}`, 'error')
    status.value = 'idle'
  }
}

const testSubscribe = async () => {
  if (!baseId.value) {
    addLog('Please enter a base ID', 'warning')
    return
  }

  try {
    status.value = 'subscribing'
    addLog(`Subscribing to ${workspaceId.value}:${baseId.value}...`, 'info')

    await $realtime.subscribe(workspaceId.value, baseId.value)

    addLog(`Successfully subscribed to ${workspaceId.value}:${baseId.value}`, 'success')
  } catch (error) {
    addLog(`Subscription failed: ${error.message}`, 'error')
  } finally {
    status.value = 'connected'
  }
}

const testBootstrap = async () => {
  if (!baseId.value) {
    addLog('Please enter a base ID', 'warning')
    return
  }

  try {
    status.value = 'bootstrapping'
    addLog(`Bootstrapping data for ${workspaceId.value}:${baseId.value}...`, 'info')

    const startTime = Date.now()
    await metadataManager.bootstrap(workspaceId.value, baseId.value)
    const endTime = Date.now()

    addLog(`Bootstrap completed in ${endTime - startTime}ms`, 'success')
    refreshSyncMetadata()
    refreshDbStats()
  } catch (error) {
    addLog(`Bootstrap failed: ${error.message}`, 'error')
  } finally {
    status.value = 'connected'
  }
}

const testSyncEvents = async () => {
  if (!baseId.value) {
    addLog('Please enter a base ID', 'warning')
    return
  }

  try {
    status.value = 'syncing'
    addLog(`Syncing events for ${workspaceId.value}:${baseId.value}...`, 'info')

    // Use the test function to directly call the API
    const result = await realtime.testSyncEvents(baseId.value)

    if (result.success) {
      addLog(`Sync API test successful. Received ${result.count} events.`, 'success')

      // Now try the actual sync
      addLog('Attempting to sync missed events...', 'info')
      const count = await realtime.syncMissedEvents(baseId.value, workspaceId.value)
      addLog(`Synced ${count} events successfully`, 'success')

      refreshSyncMetadata()
      refreshDbStats()
    } else {
      addLog(`Sync API test failed: ${result.error}`, 'error')
    }
  } catch (error) {
    addLog(`Sync failed: ${error.message}`, 'error')
  } finally {
    status.value = 'connected'
  }
}

const clearLocalData = async () => {
  if (!baseId.value) {
    addLog('Please enter a base ID', 'warning')
    return
  }

  try {
    status.value = 'clearing'
    addLog(`Clearing local data for ${baseId.value}...`, 'info')

    await metadataManager.clearBaseData(baseId.value)

    addLog(`Successfully cleared local data for ${baseId.value}`, 'success')
    refreshSyncMetadata()
    refreshDbStats()
  } catch (error) {
    addLog(`Failed to clear data: ${error.message}`, 'error')
  } finally {
    status.value = 'connected'
  }
}

const refreshSyncMetadata = async () => {
  try {
    if (!baseId.value) return

    const dbInstance = metadataManager.getKnex()
    syncMetadata.value = await dbInstance('sync_metadata')
      .where({ workspace_id: workspaceId.value, base_id: baseId.value })
      .first()
  } catch (error) {
    console.error('Failed to refresh sync metadata:', error)
  }
}

const refreshDbStats = () => {
  try {
    dbStats.value = metadataManager.getStats()
  } catch (error) {
    console.error('Failed to refresh DB stats:', error)
  }
}

const runSqlQuery = async () => {
  if (!sqlQuery.value) {
    addLog('Please enter a SQL query', 'warning')
    return
  }

  try {
    executingQuery.value = true
    addLog(`Executing SQL query: ${sqlQuery.value}`, 'info')

    // Execute the query
    const result = await realtime.executeQuery(sqlQuery.value)
    queryResult.value = result

    if (result.success) {
      addLog(`Query executed successfully. ${result.isSelect ? `${result.rowCount} rows returned` : result.message}`, 'success')
    } else {
      addLog(`Query failed: ${result.error}`, 'error')
    }
  } catch (error) {
    addLog(`Query execution error: ${error.message}`, 'error')
    queryResult.value = {
      success: false,
      error: error.message,
    }
  } finally {
    executingQuery.value = false
  }
}

const formatCellValue = (value: any) => {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch (e) {
      return String(value)
    }
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  return String(value)
}

const setupAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }

  refreshInterval.value = setInterval(() => {
    if (autoRefreshStatus.value && baseId.value) {
      refreshSyncMetadata()
      refreshDbStats()
    }
  }, 3000)
}

// Lifecycle hooks
onMounted(() => {
  addLog('Realtime debug console initialized', 'info')
  setupAutoRefresh()

  // Get current active project ID
  const { activeProjectId } = storeToRefs(useBases())
  if (activeProjectId.value) {
    baseId.value = activeProjectId.value
    addLog(`Using current active project: ${baseId.value}`, 'info')
  }
})

onBeforeUnmount(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<template>
  <div class="realtime-debug-page overflow-autow h-[90dvh] p-5">
    <h1 class="text-2xl font-bold mb-5">Realtime Debug Console</h1>

    <div class="mb-8 space-y-4 p-4 border rounded bg-white">
      <h2 class="text-xl font-semibold">Configuration</h2>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Workspace ID</label>
          <a-input v-model:value="workspaceId" placeholder="Default: nc" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Base ID</label>
          <a-input v-model:value="baseId" placeholder="Enter base ID" />
        </div>
      </div>

      <div class="flex space-x-2 mt-4">
        <a-button type="primary" :loading="status === 'checking'" @click="checkConnection"> Check Connection </a-button>
        <a-button :disabled="!baseId || status !== 'connected'" :loading="status === 'subscribing'" @click="testSubscribe">
          Test Subscribe
        </a-button>
        <a-button :disabled="!baseId || status !== 'connected'" :loading="status === 'bootstrapping'" @click="testBootstrap">
          Bootstrap Data
        </a-button>
        <a-button :disabled="!baseId || status !== 'connected'" :loading="status === 'syncing'" @click="testSyncEvents">
          Sync Events
        </a-button>
        <a-button danger :disabled="!baseId || status === 'clearing'" @click="clearLocalData"> Clear Local Data </a-button>
      </div>

      <div class="mt-4">
        <a-checkbox v-model:checked="autoRefreshStatus">Auto-refresh status (every 3s)</a-checkbox>
      </div>
    </div>

    <div class="mb-8 p-4 border rounded bg-white">
      <h2 class="text-xl font-semibold mb-2">Current Status</h2>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-sm font-medium mb-1">Socket Status</div>
          <div class="flex items-center">
            <div
              class="w-3 h-3 rounded-full mr-2"
              :class="{
                'bg-green-500': socketStatus === 'connected',
                'bg-yellow-500': socketStatus === 'connecting',
                'bg-red-500': socketStatus === 'disconnected' || socketStatus === 'error',
              }"
            ></div>
            <span class="capitalize">{{ socketStatus }}</span>
          </div>
        </div>

        <div>
          <div class="text-sm font-medium mb-1">Database Status</div>
          <div class="flex items-center">
            <div
              class="w-3 h-3 rounded-full mr-2"
              :class="{
                'bg-green-500': dbInitialized,
                'bg-red-500': !dbInitialized,
              }"
            ></div>
            <span>{{ dbInitialized ? 'Initialized' : 'Not Initialized' }}</span>
          </div>
        </div>

        <div>
          <div class="text-sm font-medium mb-1">Socket ID</div>
          <div>{{ socketId || 'Not connected' }}</div>
        </div>

        <div>
          <div class="text-sm font-medium mb-1">Last Sync</div>
          <div>{{ lastSyncTime || 'Never' }}</div>
        </div>

        <div class="col-span-2">
          <div class="text-sm font-medium mb-1">Active Subscriptions</div>
          <div class="text-sm max-h-40 overflow-y-auto">
            <div v-if="Object.keys(subscriptions).length === 0" class="text-gray-500">No active subscriptions</div>
            <div v-else>
              <div v-for="(sub, key) in subscriptions" :key="key" class="mb-1 p-1 border-b">
                <div class="flex items-center">
                  <div class="w-2 h-2 rounded-full mr-2" :class="{ 'bg-green-500': sub.active, 'bg-red-500': !sub.active }"></div>
                  <span class="font-medium">{{ key }}</span>
                </div>
                <div v-if="sub.lastError" class="text-red-500 text-xs">Error: {{ sub.lastError }}</div>
                <div class="text-xs">Retries: {{ sub.retryCount }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="p-4 border rounded bg-white">
        <h2 class="text-xl font-semibold mb-2">Local Database Stats</h2>
        <div v-if="dbStats">
          <div class="grid grid-cols-2 gap-2 mb-4">
            <div>
              <div class="text-sm font-medium">Bootstrap Count</div>
              <div>{{ dbStats.bootstrapCount }}</div>
            </div>
            <div>
              <div class="text-sm font-medium">Last Bootstrap</div>
              <div>{{ formatTimestamp(dbStats.lastBootstrapTime) }}</div>
            </div>
            <div>
              <div class="text-sm font-medium">Events Processed</div>
              <div>{{ dbStats.eventCount.total }}</div>
            </div>
            <div>
              <div class="text-sm font-medium">Error Count</div>
              <div>{{ dbStats.errors.bootstrapErrors + dbStats.errors.eventErrors + dbStats.errors.syncErrors }}</div>
            </div>
          </div>

          <div class="mb-4">
            <div class="text-sm font-medium mb-1">Events by Type</div>
            <div class="grid grid-cols-3 gap-2">
              <div>Insert: {{ dbStats.eventCount.insert }}</div>
              <div>Update: {{ dbStats.eventCount.update }}</div>
              <div>Delete: {{ dbStats.eventCount.delete }}</div>
            </div>
          </div>

          <div v-if="dbStats.errors.lastError" class="text-red-500 text-sm">
            <div class="font-medium">Last Error</div>
            <div>{{ dbStats.errors.lastError }}</div>
          </div>
        </div>
        <div v-else class="text-gray-500">No stats available</div>

        <div class="mt-4">
          <a-button size="small" @click="refreshDbStats">Refresh Stats</a-button>
        </div>
      </div>

      <div class="p-4 border rounded bg-white">
        <h2 class="text-xl font-semibold mb-2">Sync Metadata</h2>
        <div v-if="syncMetadata">
          <div class="space-y-2">
            <div>
              <div class="text-sm font-medium">Base ID</div>
              <div>{{ syncMetadata.base_id }}</div>
            </div>
            <div>
              <div class="text-sm font-medium">Last Event ID</div>
              <div>{{ syncMetadata.last_event_id || 'None' }}</div>
            </div>
            <div>
              <div class="text-sm font-medium">Last Sync</div>
              <div>{{ formatTimestamp(syncMetadata.last_sync_timestamp) }}</div>
            </div>
          </div>
        </div>
        <div v-else class="text-gray-500">No sync metadata available</div>

        <div class="mt-4">
          <a-button size="small" @click="refreshSyncMetadata">Refresh Metadata</a-button>
        </div>
      </div>
    </div>

    <div class="mt-4 p-4 border rounded bg-white">
      <h2 class="text-xl font-semibold mb-2">SQL Query</h2>
      <div class="mb-4">
        <a-textarea
          v-model:value="sqlQuery"
          placeholder="Enter SQL query (e.g., SELECT * FROM nc_bases_v2)"
          :rows="3"
          class="mb-2"
        />
        <div class="flex justify-between">
          <a-button type="primary" :loading="executingQuery" @click="runSqlQuery"> Execute Query </a-button>
          <div class="space-x-2">
            <a-button size="small" @click="sqlQuery = 'SELECT * FROM sync_metadata'"> Sync Metadata </a-button>
            <a-button size="small" @click="sqlQuery = 'SELECT * FROM nc_bases_v2'"> Bases </a-button>
            <a-button size="small" @click="sqlQuery = 'SELECT name FROM sqlite_master WHERE type=\'table\''">
              List Tables
            </a-button>
          </div>
        </div>
      </div>

      <div v-if="queryResult" class="border rounded overflow-hidden mb-4">
        <div class="p-2 bg-gray-50 border-b flex justify-between items-center">
          <span class="font-medium">Query Results</span>
          <span v-if="queryResult.success" class="text-xs text-green-600">
            {{ queryResult.isSelect ? `${queryResult.rowCount} rows` : queryResult.message }}
          </span>
          <span v-else class="text-xs text-red-600">Error</span>
        </div>

        <div v-if="queryResult.success && queryResult.isSelect" class="p-1 overflow-auto" style="max-height: 300px">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-gray-100">
                <th v-for="column in queryResultColumns" :key="column" class="px-2 py-1 text-left font-medium">
                  {{ column }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in queryResult.results" :key="index" class="border-b">
                <td v-for="column in queryResultColumns" :key="column" class="px-2 py-1">
                  {{ formatCellValue(row[column]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="queryResult.success && !queryResult.isSelect" class="p-3">
          <div class="text-green-600">{{ queryResult.message }}</div>
        </div>

        <div v-else class="p-3 text-red-600">
          {{ queryResult.error }}
        </div>
      </div>
    </div>

    <div class="mt-4 p-4 border rounded bg-white">
      <h2 class="text-xl font-semibold mb-2">Event Log</h2>
      <div class="h-64 overflow-y-auto border rounded p-2 font-mono text-sm bg-gray-50">
        <div v-for="(log, index) in eventLogs" :key="index" class="mb-1" :class="getLogClass(log)">
          <span class="text-gray-500 mr-2">{{ formatTime(log.timestamp) }}</span>
          <span>{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
