<template>
  <div class="nc-column-edit-form-item">
    <a-divider>Modification Tracking Configuration</a-divider>
    
    <a-form-item label="Enable Tracking">
      <a-checkbox 
        v-model:checked="config.enabled"
        @change="handleConfigChange"
      >
        Track modifications based on other columns
      </a-checkbox>
    </a-form-item>
    
    <div v-if="config.enabled" class="mt-2">
      <a-form-item label="Trigger Columns">
        <a-select
          v-model:value="config.triggerColumns"
          mode="multiple"
          placeholder="Select columns that trigger updates to this column"
          :options="availableTriggerColumns"
          @change="handleConfigChange"
        />
        <div class="text-xs text-gray-500 mt-1">
          This column will be updated whenever any of the selected trigger columns change
        </div>
      </a-form-item>
      
      <a-form-item label="Update Type">
        <a-select
          v-model:value="config.updateType"
          placeholder="Select how this column should be updated"
          @change="handleConfigChange"
        >
          <a-select-option value="timestamp">Current Timestamp</a-select-option>
          <a-select-option value="user">Current User</a-select-option>
          <a-select-option value="custom">Custom Value</a-select-option>
        </a-select>
      </a-form-item>
      
      <a-form-item v-if="config.updateType === 'custom'" label="Custom Value">
        <a-input
          v-model:value="config.customValue"
          placeholder="Enter custom value to set when triggered"
          @change="handleConfigChange"
        />
      </a-form-item>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { getMeta } = useMetas()

const { t } = useI18n()

const meta = await getMeta()

const config = ref({
  enabled: false,
  triggerColumns: [],
  updateType: 'timestamp',
  customValue: ''
})

const availableTriggerColumns = computed(() => {
  return meta.value?.columns
    ?.filter(col => 
      col.id !== props.value?.id && 
      !col.system &&
      col.uidt !== UITypes.Formula &&
      col.uidt !== UITypes.Lookup &&
      col.uidt !== UITypes.Rollup &&
      col.uidt !== 'TrackModifications'
    )
    .map(col => ({
      label: col.title,
      value: col.id
    })) || []
})

const handleConfigChange = () => {
  // Update the column's colOptions
  if (!props.value.colOptions) {
    props.value.colOptions = {}
  }
  
  props.value.colOptions = {
    ...props.value.colOptions,
    enabled: config.value.enabled,
    triggerColumns: config.value.triggerColumns,
    updateType: config.value.updateType,
    customValue: config.value.customValue
  }
  
  emit('update:value', props.value)
}

const loadConfig = () => {
  if (props.value?.colOptions) {
    config.value = {
      enabled: props.value.colOptions.enabled || false,
      triggerColumns: props.value.colOptions.triggerColumns || [],
      updateType: props.value.colOptions.updateType || 'timestamp',
      customValue: props.value.colOptions.customValue || ''
    }
  }
}

onMounted(() => {
  loadConfig()
})

watch(() => props.value, () => {
  loadConfig()
}, { deep: true })
</script>

<style scoped>
.nc-column-edit-form-item {
  margin-bottom: 16px;
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
</style>
