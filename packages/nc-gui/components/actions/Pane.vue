<script setup lang="ts">
import { Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const { isPanelExpanded, actionPanelSize, toggleActionPanel, executions } = useActionPane()

const isReady = ref(false)

const actionHeaderRef = ref<HTMLDivElement>()

const panelSize = computed(() => {
  if (isPanelExpanded.value) {
    return actionPanelSize.value
  }
  return 0
})

defineExpose({
  onReady: () => {
    isReady.value = true
  },
  isReady,
})

watch(isPanelExpanded, (newValue) => {
  if (newValue && !isReady.value) {
    setTimeout(() => {
      isReady.value = true
    }, 300)
  }
})
</script>

<template>
  <Pane
    v-show="isPanelExpanded || isReady"
    :size="panelSize"
    max-size="60%"
    class="nc-action-pane"
    :style="
      !isReady
        ? {
            maxWidth: `${actionPanelSize}%`,
          }
        : {}
    "
  >
    <Transition name="layout" :duration="150">
      <div v-show="isPanelExpanded" class="flex flex-col h-full">
        <div
          ref="actionHeaderRef"
          class="h-[var(--toolbar-height)] flex items-center gap-3 px-4 py-2 border-b-1 border-gray-200 bg-white"
        >
          <div class="flex items-center gap-2">
            <NcButton size="small" type="text" @click="toggleActionPanel">
              <GeneralIcon icon="play" class="flex-none !text-gray-700" />
            </NcButton>
            <span class="text-sm font-medium text-gray-700">{{ $t('general.actions') }}</span>
          </div>
        </div>
        
        <div class="flex-1 flex flex-col p-4 overflow-y-auto">
          <div v-if="executions.length > 0" class="space-y-4 min-h-0">
            <div v-for="execution in executions" :key="execution.executionId" class="border-1 border-nc-border-gray-light rounded-lg bg-white p-4">
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 mt-0.5">
                  <div 
                    class="w-6 h-6 rounded-full flex items-center justify-center"
                    :class="{
                      'bg-blue-100': execution.status === 'running',
                      'bg-green-100': execution.status === 'completed',
                      'bg-red-100': execution.status === 'error'
                    }"
                  >
                    <GeneralLoader v-if="execution.status === 'running'" />
                    <GeneralIcon 
                      v-else
                      :icon="execution.status === 'completed' ? 'check' : 'alertTriangle'"
                      class="w-3 h-3"
                      :class="{
                        'text-green-600': execution.status === 'completed',
                        'text-red-600': execution.status === 'error'
                      }"
                    />
                  </div>
                </div>
                <div class="flex-1 items-center min-w-0">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="text-sm font-semibold text-nc-content-gray-emphasis truncate">{{ execution.displayValue }}</div>
                    <span 
                      class="px-2 py-1 text-xs rounded-full"
                      :class="{
                        'bg-blue-100 text-blue-800': execution.status === 'running',
                        'bg-green-100 text-green-800': execution.status === 'completed',
                        'bg-red-100 text-red-800': execution.status === 'error'
                      }"
                    >
                      {{ execution.status === 'running' ? 'Running' : execution.status === 'completed' ? 'Completed' : 'Error' }}
                    </span>
                  </div>
                  <div v-if="execution.playground.length > 0" class="mt-3">
                    <SmartsheetAutomationScriptsPlayground 
                      :playground="execution.playground" 
                      :is-running="execution.status === 'running'"
                      :is-finished="execution.status === 'completed' || execution.status === 'finished'"
                      :show-run-button="false"
                      :compact="true"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="text-center text-gray-500 mt-8">
            <div class="mb-4">
              <GeneralIcon icon="play" class="w-12 h-12 mx-auto text-gray-300" />
            </div>
            <div class="text-base font-medium mb-2">Script Actions</div>
            <div class="text-sm text-gray-400">
              Execute scripts and view their progress in real-time
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Pane>
</template>

<style lang="scss" scoped>
.nc-action-pane {
  @apply flex flex-col bg-gray-50 rounded-l-xl border-1 border-gray-200 z-30 -mt-1px;

  box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.16), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
}
</style>
