<template>
  <div class="nc-last-modified-option">
    <div class="nc-form-item">
      <label class="nc-form-label">Enable Last Modified Tracking</label>
      <a-checkbox v-model:checked="config.enabled" @change="handleConfigChange">
        Track changes to this column
      </a-checkbox>
    </div>

    <div v-if="config.enabled" class="nc-form-item">
      <label class="nc-form-label">Update Type</label>
      <a-select v-model:value="config.updateType" @change="handleConfigChange">
        <a-select-option value="timestamp">Timestamp</a-select-option>
        <a-select-option value="user">User ID</a-select-option>
        <a-select-option value="custom">Custom Value</a-select-option>
      </a-select>
    </div>

    <div v-if="config.updateType === 'custom' && config.enabled" class="nc-form-item">
      <label class="nc-form-label">Custom Value</label>
      <a-input v-model:value="config.customValue" @change="handleConfigChange" placeholder="Enter custom value" />
    </div>

    <div v-if="config.enabled" class="nc-form-item">
      <label class="nc-form-label">Trigger Columns</label>
      <a-select
        v-model:value="config.triggerColumns"
        mode="multiple"
        placeholder="Select columns that trigger updates"
        @change="handleTriggerColumnsChange"
        :options="availableTriggerColumns"
        option-label-prop="label"
        option-value-prop="value"
      />
      <div class="nc-form-help">
        Select which columns should trigger updates to this Last Modified column
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { Column } from 'nocodb-sdk';

interface Props {
  value: any;
  columns: Column[];
}

interface Config {
  enabled: boolean;
  updateType: 'timestamp' | 'user' | 'custom';
  customValue: string;
  triggerColumns: string[];
}

const props = defineProps<Props>();
const emit = defineEmits(['update:value']);

const config = ref<Config>({
  enabled: false,
  updateType: 'timestamp',
  customValue: '',
  triggerColumns: []
});

// Available columns that can be used as triggers (exclude system, formula, lookup, rollup, and TrackModifications columns)
const availableTriggerColumns = computed(() => {
  return props.columns
    .filter(col => {
      // Exclude system columns
      if (col.system) return false;

      // Exclude virtual columns that shouldn't trigger updates
      if (col.uidt === 'Formula' || col.uidt === 'Lookup' || col.uidt === 'Rollup') return false;

      // Exclude the current column itself
      if (col.id === props.value?.id) return false;

      return true;
    })
    .map(col => ({
      label: col.title || col.column_name,
      value: col.id,
      disabled: false
    }));
});

const handleConfigChange = () => {
  updateColumnConfig();
};

const handleTriggerColumnsChange = (selectedColumns: string[]) => {
  config.value.triggerColumns = selectedColumns;
  updateColumnConfig();
};

const updateColumnConfig = () => {
  const updatedValue = {
    ...props.value,
    colOptions: {
      ...props.value.colOptions,
      enabled: config.value.enabled,
      updateType: config.value.updateType,
      customValue: config.value.customValue,
      triggerColumns: config.value.triggerColumns
    }
  };

  emit('update:value', updatedValue);
};

const loadConfig = () => {
  if (props.value?.colOptions) {
    try {
      const colOpts = typeof props.value.colOptions === 'string'
        ? JSON.parse(props.value.colOptions)
        : props.value.colOptions;

      config.value = {
        enabled: colOpts.enabled || false,
        updateType: colOpts.updateType || 'timestamp',
        customValue: colOpts.customValue || '',
        triggerColumns: colOpts.triggerColumns || []
      };
    } catch (e) {
      console.warn('Failed to parse colOptions for TrackModifications column:', e);
    }
  }
};

// Watch for changes in props.value and load config
watch(() => props.value, loadConfig, { immediate: true, deep: true });

// Watch for changes in columns to refresh available trigger columns
watch(() => props.columns, () => {
  // Filter out any trigger columns that no longer exist
  config.value.triggerColumns = config.value.triggerColumns.filter(colId =>
    props.columns.some(col => col.id === colId)
  );
}, { deep: true });
</script>

<style scoped>
.nc-last-modified-option {
  padding: 16px;
}

.nc-form-item {
  margin-bottom: 16px;
}

.nc-form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--nc-text-color);
}

.nc-form-help {
  margin-top: 4px;
  font-size: 12px;
  color: var(--nc-text-muted);
}

.nc-last-modified-option :deep(.ant-select) {
  width: 100%;
}

.nc-last-modified-option :deep(.ant-input) {
  width: 100%;
}

.nc-last-modified-option :deep(.ant-checkbox-wrapper) {
  font-weight: normal;
}
</style>

