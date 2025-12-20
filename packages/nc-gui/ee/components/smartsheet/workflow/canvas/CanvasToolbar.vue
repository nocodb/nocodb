<script setup lang="ts">
import { useVueFlow } from '@vue-flow/core'
import { useWorkflowOrThrow } from '~/composables/useWorkflow'

const workflowStore = useWorkflowStore()

const { activeWorkflowHasDraftChanges } = storeToRefs(workflowStore)

const { executeWorkflow: _executeWorkflow } = workflowStore

const { nodes, workflow } = useWorkflowOrThrow()

const { zoomIn, zoomOut, setViewport, getViewport, panOnDrag, fitView } = useVueFlow()

const isLoading = ref(false)

const showDropdown = ref(false)

const zoomLevel = ref(100)

const menuRef = ref()

const panMode = ref<'pan' | 'select'>('select')

const executeWorkflow = async () => {
  if (!workflow.value?.id) return
  isLoading.value = true
  await _executeWorkflow(workflow.value?.id)
  isLoading.value = false
}

const hasManualTrigger = computed(() => {
  return nodes.value.some((node) => node.type === 'core.trigger.manual')
})

const updateZoomLevel = () => {
  const viewport = getViewport()
  zoomLevel.value = Math.round(viewport.zoom * 100)
}

const handleZoomIn = () => {
  zoomIn({ duration: 200 })
  updateZoomLevel()
}

const handleZoomOut = () => {
  zoomOut({ duration: 200 })
  updateZoomLevel()
}

const togglePanMode = (mode: 'pan' | 'select') => {
  panMode.value = mode
  panOnDrag.value = mode === 'pan'
}

const handleFitView = () => {
  fitView({
    padding: 0.2,
    duration: 200,
    minZoom: 0.1,
    maxZoom: 1,
  })
}

// Update zoom level when viewport changes
watch(
  () => getViewport().zoom,
  (zoom) => {
    zoomLevel.value = Math.round(zoom * 100)
  },
)

onMounted(() => {
  updateZoomLevel()
})

onClickOutside(menuRef, () => {
  showDropdown.value = false
})
</script>

<template>
  <div class="absolute w-[calc(100%-379px)] bottom-4 flex justify-center items-center right-0 left-0 z-10">
    <div
      class="flex items-center gap-2 bg-white dark:bg-nc-bg-gray-dark rounded-lg shadow-lg border border-nc-border-gray-medium px-3 py-2"
    >
      <NcDropdown v-model:visible="showDropdown">
        <NcButton type="text" size="small" class="!px-2">
          <span class="text-sm font-medium min-w-[45px] text-center">{{ zoomLevel }}%</span>
          <GeneralIcon icon="ncChevronDown" class="ml-1 text-nc-content-gray" />
        </NcButton>

        <template #overlay>
          <NcMenu ref="menuRef" variant="medium">
            <NcMenuItem @click="handleZoomIn">
              <div class="flex items-center gap-2 min-w-[80px]">
                <GeneralIcon icon="ncZoomIn" />
                Zoom in
              </div>
            </NcMenuItem>
            <NcMenuItem @click="handleZoomOut">
              <div class="flex items-center gap-2 min-w-[80px]">
                <GeneralIcon icon="ncZoomOut" />
                Zoom out
              </div>
            </NcMenuItem>
            <NcMenuItem>
              <div class="flex items-center gap-2 min-w-[80px]">
                <GeneralIcon icon="ncSearch" />
                Zoom to 50%
              </div>
            </NcMenuItem>

            <NcMenuItem>
              <div class="flex items-center gap-2 min-w-[80px]">
                <GeneralIcon icon="ncSearch" />
                Zoom to 100%
              </div>
            </NcMenuItem>
            <NcDivider />
            <NcMenuItem @click="handleFitView">
              <div class="flex items-center gap-2 min-w-[80px]">
                <GeneralIcon icon="ncMaximize" />
                Fit to view
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>

      <!-- Divider -->
      <div class="h-6 w-px bg-nc-border-gray-medium mx-1" />

      <!-- Pan Mode Toggle -->
      <NcTooltip>
        <template #title>Pan Mode</template>
        <NcButton type="text" size="small" :class="{ '!bg-nc-bg-gray-light': panMode === 'pan' }" @click="togglePanMode('pan')">
          <GeneralIcon icon="ncMove" class="text-gray-600 dark:text-gray-300" />
        </NcButton>
      </NcTooltip>

      <NcTooltip>
        <template #title>Selection Mode</template>
        <NcButton
          type="text"
          size="small"
          :class="{ '!bg-nc-bg-gray-light': panMode === 'select' }"
          @click="togglePanMode('select')"
        >
          <GeneralIcon icon="ncMousePointer" class="text-gray-600 dark:text-gray-300" />
        </NcButton>
      </NcTooltip>

      <div v-if="hasManualTrigger" class="h-6 w-px bg-nc-border-gray-medium mx-1" />
      <NcTooltip v-if="hasManualTrigger" :disabled="!activeWorkflowHasDraftChanges">
        <template #title>
          {{
            activeWorkflowHasDraftChanges
              ? 'Workflow has draft changes. Please publish the workflow before triggering.'
              : 'Trigger Workflow'
          }}
        </template>
        <NcButton
          :disabled="isLoading || activeWorkflowHasDraftChanges"
          :loading="isLoading"
          size="small"
          type="primary"
          @click="executeWorkflow"
        >
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncSend" />
            <span>{{ $t('labels.triggerWorkflow') }}</span>
          </div>
        </NcButton>
      </NcTooltip>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
