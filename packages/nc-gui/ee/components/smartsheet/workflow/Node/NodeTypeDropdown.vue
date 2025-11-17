<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'

export interface NodeTypeOption {
  id: string
  title: string // Display name for the node type
  icon: keyof typeof iconMap
  description?: string
}

interface Props {
  options: NodeTypeOption[]
  selectedId?: string
  placeholder?: string
  title?: string
  overlayClassName?: string
  showDelete?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select an option',
  title: 'Choose an option',
  overlayClassName: 'nc-dropdown-node-type-selection',
  showDelete: false,
})

const emit = defineEmits<{
  select: [option: NodeTypeOption]
  delete: []
}>()

const showDropdown = ref(false)
const showMenuDropdown = ref(false)
const searchQuery = ref('')
const dropdownRef = ref<HTMLElement | null>(null)
const menuDropdownRef = ref<HTMLElement | null>(null)

const selectedOption = computed(() => {
  if (props.selectedId) {
    return props.options.find((opt) => opt.id === props.selectedId)
  }
  return null
})

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  return props.options.filter((option) => option.title.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

const selectOption = (option: NodeTypeOption) => {
  emit('select', option)
  showDropdown.value = false
  searchQuery.value = ''
}

const openChangeDropdown = () => {
  showMenuDropdown.value = false
  showDropdown.value = true
}

// Close dropdown on click outside (but ignore clicks inside dropdown overlay)
onClickOutside(
  dropdownRef,
  (event) => {
    // Check if click is inside any dropdown overlay
    const target = event.target as HTMLElement
    const isInsideOverlay = target.closest('.node-type-dropdown-overlay') || target.closest('.ant-dropdown')

    if (!isInsideOverlay && showDropdown.value) {
      showDropdown.value = false
    }
  },
  { ignore: ['.node-type-dropdown-overlay', '.ant-dropdown'] },
)

// Close menu dropdown on click outside (but ignore clicks inside menu overlay)
onClickOutside(
  menuDropdownRef,
  (event) => {
    const target = event.target as HTMLElement
    const isInsideOverlay = target.closest('.ant-dropdown')

    if (!isInsideOverlay && showMenuDropdown.value) {
      showMenuDropdown.value = false
    }
  },
  { ignore: ['.ant-dropdown'] },
)
</script>

<template>
  <div class="node-type-dropdown-wrapper">
    <!-- 3-dot menu for selected option -->
    <NcDropdown
      v-if="selectedOption"
      ref="menuDropdownRef"
      v-model:visible="showMenuDropdown"
      :trigger="['click']"
      class="node-type-menu-dropdown"
    >
      <NcButton type="text" size="small" class="node-type-menu-btn" @click.stop>
        <GeneralIcon icon="threeDotVertical" class="text-gray-600" />
      </NcButton>

      <template #overlay>
        <NcMenu>
          <NcMenuItem @click="openChangeDropdown">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="edit" />
              <span>Change</span>
            </div>
          </NcMenuItem>
          <NcMenuItem v-if="showDelete" class="!text-red-500" @click="emit('delete')">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="delete" />
              <span>Delete</span>
            </div>
          </NcMenuItem>
        </NcMenu>
      </template>
    </NcDropdown>

    <!-- Type selection dropdown -->
    <NcDropdown
      ref="dropdownRef"
      v-model:visible="showDropdown"
      :trigger="[]"
      :overlay-class-name="overlayClassName"
      placement="bottom"
    >
      <slot :selected-option="selectedOption" :show-dropdown="showDropdown" :open-dropdown="() => (showDropdown = true)">
        <div
          class="node-type-selector"
          :class="{
            'node-type-selector-empty': !selectedOption,
          }"
          @click="!selectedOption && (showDropdown = true)"
        >
          <div v-if="!selectedOption" class="node-type-placeholder">
            <div class="node-type-placeholder-icon">
              <GeneralIcon icon="plus" class="text-neutral-400" />
            </div>
            <span class="node-type-placeholder-text">{{ placeholder }}</span>
          </div>
          <div v-else class="node-type-selected">
            <div class="node-type-selected-icon">
              <GeneralIcon :icon="selectedOption.icon" />
            </div>
            <span class="node-type-selected-text">{{ selectedOption.title }}</span>
          </div>
        </div>
      </slot>

      <template #overlay>
        <div class="node-type-dropdown-overlay">
          <div class="node-type-dropdown-header">
            <h3 class="node-type-dropdown-title">{{ title }}</h3>
          </div>

          <div class="node-type-dropdown-body">
            <!-- Search Input -->
            <div class="node-type-search">
              <GeneralIcon icon="search" class="node-type-search-icon" />
              <a-input v-model:value="searchQuery" placeholder="Search..." class="node-type-search-input" @click.stop />
            </div>

            <div v-if="filteredOptions.length" class="node-type-section">
              <NcMenu>
                <NcMenuItem
                  v-for="option in filteredOptions"
                  :key="option.id"
                  class="node-type-menu-item"
                  @click="selectOption(option)"
                >
                  <div class="node-type-item-content">
                    <div class="node-type-item-icon">
                      <GeneralIcon :icon="option.icon" />
                    </div>
                    <div class="node-type-item-text">
                      <span class="node-type-item-label">{{ option.title }}</span>
                      <span v-if="option.description" class="node-type-item-description">{{ option.description }}</span>
                    </div>
                  </div>
                </NcMenuItem>
              </NcMenu>
            </div>

            <div v-if="!filteredOptions.length" class="node-type-empty">
              <span>No options found</span>
            </div>
          </div>
        </div>
      </template>
    </NcDropdown>
  </div>
</template>

<style scoped lang="scss">
.node-type-dropdown-wrapper {
  position: relative;
  width: 100%;
}

.node-type-menu-dropdown {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  z-index: 10;
}

.node-type-menu-btn {
  width: 32px;
  height: 32px;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
}

.node-type-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  width: 100%;
  cursor: pointer;
}

.node-type-placeholder {
  display: flex;
  align-items: center;
  gap: 12px;
}

.node-type-placeholder-icon {
  width: 48px;
  height: 48px;
  background: #f3f4f6;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.node-type-placeholder-text {
  font-size: 18px;
  font-weight: 500;
  color: #3b82f6;
}

.node-type-selected {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.node-type-selected-icon {
  width: 40px;
  height: 40px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
}

.node-type-selected-text {
  flex: 1;
  font-size: 16px;
  font-weight: 500;
  color: #1f2937;
}

.node-type-search {
  position: relative;
  margin-bottom: 24px;
}

.node-type-search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  pointer-events: none;
  z-index: 1;
}

.node-type-search-input {
  width: 100%;
  padding: 12px 16px 12px 48px;
  border: 2px solid #3b82f6;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.node-type-search-input:focus {
  border-color: #2563eb;
}

.node-type-section {
  margin-bottom: 24px;
}

.node-type-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: #9ca3af;
  font-size: 14px;
}

.node-type-dropdown-overlay {
  min-width: 400px;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.node-type-dropdown-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.node-type-dropdown-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.node-type-dropdown-body {
  padding: 20px 24px;
  max-height: 400px;
  overflow-y: auto;
}

.node-type-menu-item {
  padding: 0 !important;
}

.node-type-item-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  width: 100%;
}

.node-type-item-icon {
  width: 32px;
  height: 32px;
  background: #f3f4f6;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
  flex-shrink: 0;
}

.node-type-item-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.node-type-item-label {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.node-type-item-description {
  font-size: 12px;
  color: #6b7280;
}
</style>

<style lang="scss">
:deep(.nc-dropdown-node-type-selection) {
  .ant-dropdown-menu {
    padding: 0;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
}
</style>
