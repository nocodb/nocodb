<script lang="ts" setup>
import { computed, h, onMounted, ref, resolveComponent, watch } from 'vue'
import {UITypes, isVirtualCol} from 'nocodb-sdk'
import NcTooltip from '~/components/nc/Tooltip.vue'
import NcCheckbox from '~/components/nc/Checkbox.vue'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const meta = inject(MetaInj, ref())

const config = ref({
  triggerColumns: [],
})

const selectedFields = ref<Record<string, boolean>>({})

// Get available columns that can be used as triggers for LastModified tracking
const availableTriggerColumns = computed(() => {
  return (
    meta.value?.columns?.filter(
      (col) =>
        col.id !== props.value?.id &&
        !col.system &&
        col.uidt !== UITypes.Formula &&
        col.uidt !== UITypes.Lookup &&
        col.uidt !== UITypes.Rollup &&
        col.uidt !== UITypes.LastModifiedTime &&
        col.uidt !== UITypes.LastModifiedBy,
    ) || []
  )
})

// Toggle field selection for LastModified tracking triggers
const toggleFieldSelection = (fieldId: string) => {
  selectedFields.value[fieldId] = !selectedFields.value[fieldId]
  updateSelectedFields()
}

// Update selected fields based on selectedFields state and sync with config
const updateSelectedFields = () => {
  config.value.triggerColumns = Object.keys(selectedFields.value).filter((id) => selectedFields.value[id])
  updateColumnConfig()
}

// Get icon for column type
const getIcon = (field: any) => {
  // Use the same icon system as other components
  return h(
    isVirtualCol(field) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'),
    {
      columnMeta: field,
    },
  )
}

// Update the column's colOptions with the current LastModified tracking configuration
const updateColumnConfig = () => {
  if (!props.value?.colOptions) {
    props.value.colOptions = {}
  }

  props.value.colOptions = {
    ...props.value.colOptions,
    triggerColumns: config.value.triggerColumns,
  }

  emit('update:value', props.value)
}

// Load existing configuration from the column's colOptions
const loadConfig = async () => {
  if (props.value?.colOptions) {
    config.value = {
      triggerColumns: props.value.colOptions.triggerColumns || [],
    }

    // Initialize selectedFields based on triggerColumns
    selectedFields.value = {}
    if (config.value.triggerColumns) {
      config.value.triggerColumns.forEach((id) => {
        selectedFields.value[id] = true
      })
    }
  } else {
    // Initialize with defaults if no colOptions exist
    config.value = {
      triggerColumns: [],
    }
  }
}

// Load configuration on mount and when props change
onMounted(() => {
  loadConfig()
})

watch(
  () => props.value,
  () => {
    loadConfig()
  },
  { deep: true },
)

// Watch for changes in selectedFields to sync with config.triggerColumns
watch(
  selectedFields,
  () => {
    updateSelectedFields()
  },
  { deep: true },
)
</script>

<template>
  <div class="p-4 border border-gray-200 rounded-lg bg-gray-50">
    <a-divider>Select Columns to Track</a-divider>

    <a-form-item label="Columns to Track">
      <div class="text-xs text-gray-500 mb-2">
        Select which columns should trigger updates to this
        {{ props.value?.uidt === UITypes.LastModifiedTime ? 'timestamp' : 'user' }} field
      </div>
      <div class="border border-gray-200 rounded-md">
        <div class="border-y border-gray-200 h-[310px] py-1 nc-scrollbar-thin" style="scrollbar-gutter: stable">
          <div v-for="field of availableTriggerColumns" :key="field.id">
            <div
              :key="field.id"
              :data-testid="`nc-last-modified-trigger-${field.title}`"
              class="px-1 py-1 mx-1 flex items-center rounded-md hover:bg-gray-100 cursor-pointer"
              @click.stop="toggleFieldSelection(field.id)"
            >
              <div class="flex items-center w-full truncate ml-1 py-0.5 pr-2">
                <component :is="getIcon(field)" class="w-3.5 h-3.5 text-gray-500" />
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
        This {{ props.value?.uidt === UITypes.LastModifiedTime ? 'timestamp' : 'user' }} field will be updated whenever any of the
        selected columns change
      </div>
    </a-form-item>

    <div v-if="Object.keys(selectedFields).filter((id) => selectedFields[id]).length > 0" class="mt-2">
      <a-alert
        message="Selected Columns to Track"
        type="info"
        show-icon
        :description="`${Object.keys(selectedFields).filter((id) => selectedFields[id]).length} column(s) selected for tracking`"
      />
    </div>
  </div>
</template>
