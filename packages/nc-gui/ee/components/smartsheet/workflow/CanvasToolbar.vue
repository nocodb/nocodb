<script setup lang="ts">
import { useVueFlow } from '@vue-flow/core'
import { GeneralNodeID } from 'nocodb-sdk'
import { useWorkflowOrThrow } from '~/composables/useWorkflow'

const workflowStore = useWorkflowStore()

const { activeWorkflowHasDraftChanges } = storeToRefs(workflowStore)

const { executeWorkflow: _executeWorkflow } = workflowStore

const { nodes, workflow, addNode } = useWorkflowOrThrow()

const { zoomIn, zoomOut, getViewport, setViewport, panOnDrag, fitView, project } = useVueFlow()

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

const handleZoomReset = () => {
  const viewport = getViewport()
  setViewport({ ...viewport, zoom: 1 }, { duration: 200 })
  zoomLevel.value = 100
}

const handleZoomTo = (percentage: number) => {
  const viewport = getViewport()
  setViewport({ ...viewport, zoom: percentage / 100 }, { duration: 200 })
  zoomLevel.value = percentage
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

const addNote = () => {
  const centerX = window.innerWidth / 2
  const centerY = window.innerHeight / 2

  const position = project({ x: centerX, y: centerY })

  const newNote = {
    id: `note-${Date.now()}`,
    type: GeneralNodeID.NOTE,
    position: { x: position.x - 150, y: position.y - 100 },
    draggable: true,
    data: {
      content: '',
      color: '#fee2e2',
    },
    style: {
      width: '300px',
      height: '200px',
    },
  }

  addNode(newNote)
}

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

useEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
    if (e.key === '=' || e.key === '+') {
      e.preventDefault()
      handleZoomIn()
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      handleZoomOut()
    } else if (e.key === '0') {
      e.preventDefault()
      handleZoomReset()
    }
  }
})
</script>

<template>
  <div class="absolute w-[calc(100%-379px)] bottom-4 flex justify-center items-center right-0 left-0 z-10">
    <div class="flex items-center gap-2 bg-nc-base-white shadow-default rounded-lg border border-nc-border-gray-medium px-3 py-2">
      <NcDropdown v-model:visible="showDropdown">
        <NcButton type="text" size="small" class="!px-2">
          <span class="text-sm font-medium min-w-[45px] text-center">{{ zoomLevel }}%</span>
          <GeneralIcon icon="ncChevronDown" class="ml-1 text-nc-content-gray" />
        </NcButton>

        <template #overlay>
          <NcMenu ref="menuRef" variant="medium">
            <NcMenuItem inner-class="w-full" @click="handleZoomIn">
              <div class="flex items-center gap-2 min-w-[80px]">
                <GeneralIcon icon="ncZoomIn" />
                Zoom in
              </div>
              <div class="flex-1" />

              <span class="text-small !leading-5 px-1 rounded-md border-1 bg-nc-bg-gray-medium border-nc-border-gray-medium">
                {{ renderCmdOrCtrlKey() }} +
              </span>
            </NcMenuItem>
            <NcMenuItem inner-class="w-full" @click="handleZoomOut">
              <div class="flex items-center gap-2 min-w-[80px]">
                <GeneralIcon icon="ncZoomOut" />
                Zoom out
              </div>
              <div class="flex-1" />

              <span class="text-small !leading-5 px-1 rounded-md border-1 bg-nc-bg-gray-medium border-nc-border-gray-medium">
                {{ renderCmdOrCtrlKey() }} -
              </span>
            </NcMenuItem>
            <NcMenuItem @click="handleZoomTo(50)">
              <div class="flex items-center gap-2 min-w-[80px]">
                <GeneralIcon icon="ncSearch" />
                Zoom to 50%
              </div>
            </NcMenuItem>

            <NcMenuItem inner-class="w-full" @click="handleZoomReset">
              <div class="flex items-center gap-2 min-w-[80px]">
                <GeneralIcon icon="ncSearch" />
                Zoom to 100%
              </div>
              <div class="flex-1" />
              <span class="text-small !leading-5 px-1 rounded-md border-1 bg-nc-bg-gray-medium border-nc-border-gray-medium">
                {{ renderCmdOrCtrlKey() }} 0
              </span>
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
      <div class="h-6 w-px bg-nc-border-gray-medium mx-1" />
      <NcTooltip>
        <template #title>Pan Mode</template>
        <NcButton type="text" size="small" :class="{ '!bg-nc-bg-gray-light': panMode === 'pan' }" @click="togglePanMode('pan')">
          <GeneralIcon icon="ncMove" class="text-nc-content-gray" />
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
          <GeneralIcon icon="ncMousePointer" class="text-nc-content-gray" />
        </NcButton>
      </NcTooltip>

      <div class="h-6 w-px bg-nc-border-gray-medium mx-1" />
      <NcTooltip>
        <template #title>Add Note</template>
        <NcButton type="text" size="small" @click="addNote">
          <GeneralIcon icon="ncFile" class="text-nc-content-gray" />
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
