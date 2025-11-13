<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useWorkflowStoreOrThrow } from './useWorkflow'

const workflowStore = useWorkflowStoreOrThrow()
const { configDrawerOpen, selectedNodeId, closeConfigDrawer, updateNode, getBackendNodeDef } = workflowStore

// Reference to the drawer content for click outside detection
const drawerRef = ref<HTMLElement>()

// Get the selected node
const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null
  return workflowStore.nodes.value.find((n) => n.id === selectedNodeId.value)
})

// Get node type metadata from workflow store (UI metadata)
const nodeTypeMeta = computed(() => {
  if (!selectedNode.value || !selectedNode.value.type) return null
  return workflowStore.getNodeType(selectedNode.value.type)
})

// Get full backend node definition (includes form)
const backendNodeDef = computed(() => {
  if (!selectedNode.value || !selectedNode.value.type) return null
  return getBackendNodeDef(selectedNode.value.type)
})

// Form schema from backend node definition
const formSchema = computed(() => {
  return backendNodeDef.value?.form || []
})

// Form data - initialized from node.data
const formData = ref<Record<string, any>>({})

// Initialize form data when node changes
watch(
  selectedNode,
  (node) => {
    if (node) {
      formData.value = { ...node.data }
    } else {
      formData.value = {}
    }
  },
  { immediate: true },
)

// Node title editing
const isEditingTitle = ref(false)
const editedTitle = ref('')
const titleInputRef = ref<HTMLInputElement>()

// Get current node title
const nodeTitle = computed(() => {
  return selectedNode.value?.data?.title || 'Untitled'
})

// Start editing title
const startEditingTitle = () => {
  editedTitle.value = nodeTitle.value
  isEditingTitle.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

// Save edited title
const saveTitle = () => {
  let trimmedTitle = editedTitle.value.trim()

  // Enforce 100 character limit
  if (trimmedTitle.length > 100) {
    trimmedTitle = trimmedTitle.substring(0, 100)
  }

  if (trimmedTitle && selectedNodeId.value && trimmedTitle !== nodeTitle.value) {
    // Check if title is unique (excluding current node)
    const isDuplicate = workflowStore.nodes.value.some((n) => n.id !== selectedNodeId.value && n.data?.title === trimmedTitle)

    if (isDuplicate) {
      message.warning('A node with this name already exists. Please choose a unique name.')
      return
    }

    updateNode(selectedNodeId.value, {
      data: {
        ...selectedNode.value?.data,
        title: trimmedTitle,
      },
    })
  }
  isEditingTitle.value = false
}

// Cancel editing
const cancelEditingTitle = () => {
  isEditingTitle.value = false
  editedTitle.value = ''
}

// Handle key events while editing
const handleTitleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveTitle()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEditingTitle()
  }
}

// Provide form builder helper
const { formState } = useProvideFormBuilderHelper({
  formSchema,
  initialState: formData,
  onChange: () => {
    // Auto-save on change
    if (!selectedNodeId.value) return
    updateNode(selectedNodeId.value, {
      data: formState.value,
    })
  },
})

// Debug: log form schema and state
watch(
  [formSchema, nodeTypeMeta, backendNodeDef],
  () => {
    console.log('[NodeConfigDrawer] selectedNode:', selectedNode.value)
    console.log('[NodeConfigDrawer] backendNodeDef:', backendNodeDef.value)
    console.log('[NodeConfigDrawer] formSchema:', formSchema.value)
    console.log('[NodeConfigDrawer] nodeTypeMeta:', nodeTypeMeta.value)
    console.log('[NodeConfigDrawer] formData:', formData.value)
  },
  { immediate: true },
)

// Handle click outside to close drawer
onClickOutside(
  drawerRef,
  (event) => {
    // Don't close if we're editing the title
    if (isEditingTitle.value) return

    // Check if click is on a dropdown, modal, or other overlay element
    const target = event.target as HTMLElement
    const isClickOnDropdown =
      target.closest('.ant-select-dropdown') ||
      target.closest('.ant-picker-dropdown') ||
      target.closest('.ant-modal') ||
      target.closest('.nc-dropdown')

    if (!isClickOnDropdown && configDrawerOpen.value) {
      closeConfigDrawer()
    }
  },
  {
    ignore: [
      '.ant-select-dropdown',
      '.ant-picker-dropdown',
      '.ant-modal',
      '.nc-dropdown',
      '.nc-workflow-config-header',
      '.nc-workflow-config-content',
      '.nc-workflow-header-title-display',
      '.nc-workflow-header-title-input',
    ],
  },
)
</script>

<template>
  <!-- Backdrop overlay -->
  <Transition name="backdrop">
    <div v-if="configDrawerOpen" class="nc-workflow-config-backdrop" @click="closeConfigDrawer"></div>
  </Transition>

  <!-- Drawer panel -->
  <Transition name="drawer">
    <div v-if="configDrawerOpen" ref="drawerRef" class="nc-workflow-config-drawer">
      <!-- Header -->
      <div class="nc-workflow-config-header">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <GeneralIcon v-if="nodeTypeMeta?.icon" :icon="nodeTypeMeta.icon" class="text-xl flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <!-- Show node title at the top -->
            <div v-if="isEditingTitle" class="nc-workflow-header-title-editing">
              <input
                ref="titleInputRef"
                v-model="editedTitle"
                type="text"
                class="nc-workflow-header-title-input"
                placeholder="Enter node name"
                maxlength="100"
                @blur="saveTitle"
                @keydown="handleTitleKeydown"
              />
            </div>
            <div v-else class="nc-workflow-header-title-display" @click="startEditingTitle">
              <span class="font-semibold text-base truncate">{{ nodeTitle }}</span>
              <NcButton type="text" size="xs" class="nc-workflow-header-edit-btn" @click.stop="startEditingTitle">
                <GeneralIcon icon="edit" class="text-gray-400 hover:text-gray-600" />
              </NcButton>
            </div>

            <div v-if="nodeTypeMeta?.description && !isEditingTitle" class="text-xs text-gray-400 truncate">
              {{ nodeTypeMeta.description }}
            </div>
          </div>
        </div>
        <NcButton type="text" size="xs" class="!px-1 flex-shrink-0" @click="closeConfigDrawer">
          <GeneralIcon icon="close" class="text-gray-500" />
        </NcButton>
      </div>

      <!-- Content -->
      <div class="nc-workflow-config-content">
        <NcFormBuilder v-if="formSchema.length > 0" />
        <div v-else class="text-sm text-gray-500 text-center py-8">No configuration options available</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
/* Backdrop overlay */
.nc-workflow-config-backdrop {
  @apply fixed inset-0 bg-black bg-opacity-30 z-40;
}

/* Drawer panel */
.nc-workflow-config-drawer {
  @apply fixed top-0 right-0 h-full w-[480px] bg-white shadow-xl z-50;
  @apply flex flex-col;
}

/* Header */
.nc-workflow-config-header {
  @apply flex items-center gap-3 px-4 py-3 border-b border-gray-200;
  @apply flex-shrink-0;
}

/* Header title editing styles */
.nc-workflow-header-title-editing {
  width: 100%;
}

.nc-workflow-header-title-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  background: white;
  border: 2px solid #3b82f6;
  border-radius: 4px;
  outline: none;
  transition: border-color 0.2s ease;
}

.nc-workflow-header-title-input:focus {
  border-color: #2563eb;
}

.nc-workflow-header-title-display {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: text;
  padding: 2px 0;
}

.nc-workflow-header-edit-btn {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s ease;
  margin-left: auto;
}

.nc-workflow-header-title-display:hover .nc-workflow-header-edit-btn {
  opacity: 1;
}

/* Remove old node title section styles - no longer needed */

/* Content area */
.nc-workflow-config-content {
  @apply flex-1 overflow-y-auto p-4;
}

/* Backdrop transition */
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.3s ease;
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* Drawer slide transition */
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}
</style>
