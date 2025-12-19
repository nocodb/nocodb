<template>
  <div class="nc-column-edit-form-item">
    <a-divider>Last Modified Tracking Configuration</a-divider>
    
    <a-form-item label="Enable Tracking">
      <a-checkbox v-model:checked="config.enabled" @change="handleConfigChange">
        Track when other columns are modified
      </a-checkbox>
    </a-form-item>
    
    <div v-if="config.enabled" class="mt-2">
      <a-form-item v-if="props.value?.uidt === UITypes.LastModifiedTime" label="Update Type">
        <a-select v-model:value="config.updateType" placeholder="Select how this column should be updated" @change="handleConfigChange">
          <a-select-option value="timestamp">Current Timestamp</a-select-option>
          <a-select-option value="custom">Custom Value</a-select-option>
        </a-select>
      </a-form-item>
      
      <a-form-item v-if="props.value?.uidt === UITypes.LastModifiedBy" label="Update Type">
        <a-select v-model:value="config.updateType" placeholder="Select how this column should be updated" @change="handleConfigChange">
          <a-select-option value="user">Current User</a-select-option>
          <a-select-option value="custom">Custom Value</a-select-option>
        </a-select>
      </a-form-item>
      
      <a-form-item v-if="config.updateType === 'custom'" label="Custom Value">
        <a-input v-model:value="config.customValue" placeholder="Enter custom value to set when triggered" @change="handleConfigChange" />
      </a-form-item>
      
      <a-form-item label="Trigger Columns">
        <div class="border-1 border-gray-200 rounded-md">
          <div class="border-y-1 h-[310px] border-gray-200 py-1 nc-scrollbar-thin" style="scrollbar-gutter: stable">
            <div v-for="field of availableTriggerColumns" :key="field.id">
              <div
                :key="field.id"
                :data-testid="`nc-track-modifications-trigger-${field.title}`"
                class="px-1 py-0.75 mx-1 flex flex-row items-center rounded-md hover:bg-gray-100"
                @click.stop="toggleFieldSelection(field.id)"
              >
                <div class="flex flex-row items-center w-full cursor-pointer truncate ml-1 py-[2px] pr-2">
                  <component :is="getIcon(field)" class="!w-3.5 !h-3.5 !text-gray-500" />
                  <NcTooltip class="flex-1 pl-1 pr-2 truncate" show-on-truncate-only>
                    <template #title>
                      {{ field.title }}
                    </template>
                    <template #default>{{ field.title }}</template>
                  </NcTooltip>

                  <NcCheckbox v-model:checked="selectedFields[field.id]" size="default" />
                </div>

                <div class="flex-1" />
              </div>
            </div>
          </div>
        </div>
        <div class="text-xs text-gray-500 mt-1">
          This {{ props.value?.uidt === UITypes.LastModifiedTime ? 'timestamp' : 'user' }} column will be updated whenever any of the selected trigger columns change
        </div>
      </a-form-item>
      
      <div v-if="config.triggerColumns.length > 0" class="mt-2">
        <a-alert 
          message="Selected Trigger Columns" 
          type="info" 
          show-icon
          :description="`This ${props.value?.uidt === UITypes.LastModifiedTime ? 'timestamp' : 'user'} column will be updated when ${config.triggerColumns.length} selected column(s) change`"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch, h, resolveComponent } from 'vue'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import NcTooltip from '~/components/nc/Tooltip.vue'
import NcCheckbox from '~/components/nc/Checkbox.vue'

const props = defineProps<{ 
  value: any 
}>()

const emit = defineEmits(['update:value'])

const { getMeta } = useMetas()
const meta = await getMeta()

const config = ref({
  enabled: false,
  updateType: props.value?.uidt === UITypes.LastModifiedBy ? 'user' : 'timestamp',
  customValue: '',
  triggerColumns: []
})

const loading = ref(false)
const selectedFields = ref<Record<string, boolean>>({})

// Get available columns that can be used as triggers
const availableTriggerColumns = computed(() => {
  return meta.value?.columns
    ?.filter(col => 
      col.id !== props.value?.id && 
      !col.system && 
      col.uidt !== UITypes.Formula && 
      col.uidt !== UITypes.Lookup && 
      col.uidt !== UITypes.Rollup && 
      col.uidt !== UITypes.LastModifiedTime && 
      col.uidt !== UITypes.LastModifiedBy
    ) || []
})

// Handle configuration changes
const handleConfigChange = () => {
  updateColumnConfig()
}

// Handle trigger columns changes
const handleTriggerColumnsChange = async (selectedColumns: string[]) => {
  config.value.triggerColumns = selectedColumns
  await updateColumnConfig()
}

// Toggle field selection
const toggleFieldSelection = (fieldId: string) => {
  selectedFields.value[fieldId] = !selectedFields.value[fieldId]
  updateSelectedFields()
}

// Update selected fields based on selectedFields state
const updateSelectedFields = () => {
  config.value.triggerColumns = Object.keys(selectedFields.value).filter(id => selectedFields.value[id])
  updateColumnConfig()
}

// Get icon for column type
const getIcon = (field: any) => {
  // Use the same icon system as other components
  return h(isVirtualCol(field) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: field,
  })
}

// Update the column's colOptions
const updateColumnConfig = () => {
  if (!props.value?.colOptions) {
    props.value.colOptions = {}
  }
  
  props.value.colOptions = {
    ...props.value.colOptions,
    enabled: config.value.enabled,
    updateType: config.value.updateType,
    customValue: config.value.customValue,
    triggerColumns: config.value.triggerColumns
  }
  
  emit('update:value', props.value)
}

// Load existing configuration
const loadConfig = async () => {
  if (props.value?.colOptions) {
    config.value = {
      enabled: props.value.colOptions.enabled || false,
      updateType: props.value.colOptions.updateType || (props.value.uidt === UITypes.LastModifiedBy ? 'user' : 'timestamp'),
      customValue: props.value.colOptions.customValue || '',
      triggerColumns: props.value.colOptions.triggerColumns || []
    }
    
    // Initialize selectedFields based on triggerColumns
    selectedFields.value = {}
    if (config.value.triggerColumns) {
      config.value.triggerColumns.forEach(id => {
        selectedFields.value[id] = true
      })
    }
  }
}

// Load configuration on mount and when props change
onMounted(() => {
  loadConfig()
})

watch(() => props.value, () => {
  loadConfig()
}, { deep: true })

// Watch for changes in selectedFields to sync with config.triggerColumns
watch(selectedFields, () => {
  updateSelectedFields()
}, { deep: true })

// Watch for changes in column type to update default updateType
watch(() => props.value?.uidt, (newUidt) => {
  if (newUidt === UITypes.LastModifiedBy && config.value.updateType === 'timestamp') {
    config.value.updateType = 'user'
  } else if (newUidt === UITypes.LastModifiedTime && config.value.updateType === 'user') {
    config.value.updateType = 'timestamp'
  }
}, { immediate: true })
</script>

<style scoped>
.nc-column-edit-form-item {
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fafafa;
}

.mt-2 {
  margin-top: 8px;
}

.text-xs {
  font-size: 12px;
}

.text-gray-500 {
  color: #6b7280;
}

.border-1 {
  border-width: 1px;
}

.border-y-1 {
  border-top-width: 1px;
  border-bottom-width: 1px;
}

.border-gray-200 {
  border-color: #e5e7eb;
}

.rounded-md {
  border-radius: 6px;
}

.h-\[310px\] {
  height: 310px;
}

.py-1 {
  padding-top: 4px;
  padding-bottom: 4px;
}

.px-1 {
  padding-left: 4px;
  padding-right: 4px;
}

.py-0\.75 {
  padding-top: 3px;
  padding-bottom: 3px;
}

.mx-1 {
  margin-left: 4px;
  margin-right: 4px;
}

.flex {
  display: flex;
}

.flex-row {
  flex-direction: row;
}

.items-center {
  align-items: center;
}

.w-full {
  width: 100%;
}

.cursor-pointer {
  cursor: pointer;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ml-1 {
  margin-left: 4px;
}

.pr-2 {
  padding-right: 8px;
}

.hover\:bg-gray-100:hover {
  background-color: #f3f4f6;
}

.flex-1 {
  flex: 1 1 0%;
}
</style>
