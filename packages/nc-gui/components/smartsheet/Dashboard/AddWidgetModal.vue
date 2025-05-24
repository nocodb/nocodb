<script setup lang="ts">
import { type DashboardType, type WidgetType, WidgetTypes } from 'nocodb-sdk'

interface Props {
  visible: boolean
  dashboard?: DashboardType
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'created', widget: WidgetType): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const widgetStore = useWidgetStore()

// Model
const vModel = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

// State
const selectedType = ref<WidgetTypes>()
const isCreating = ref(false)

// Widget form
const widgetForm = ref({
  title: '',
  description: '',
  position: {
    x: 0,
    y: 0,
    w: 4,
    h: 3,
  },
  config: {} as any,
})

// Available widget types
const availableWidgetTypes = [
  {
    type: WidgetTypes.CHART,
    title: 'Chart',
    description: 'Display data as charts and graphs',
    icon: 'ncBarChart2',
  },
  {
    type: WidgetTypes.TABLE,
    title: 'Table',
    description: 'Show data in tabular format',
    icon: 'layout',
  },
  {
    type: WidgetTypes.METRIC,
    title: 'Metric',
    description: 'Display key metrics and KPIs',
    icon: 'ncAnalytics',
  },
  {
    type: WidgetTypes.TEXT,
    title: 'Text',
    description: 'Add text, notes, or documentation',
    icon: 'ncText',
  },
  {
    type: WidgetTypes.IFRAME,
    title: 'Embed',
    description: 'Embed external content via iframe',
    icon: 'ncWeb',
  },
]

// Size options
const sizeOptions = [
  { label: '1 Column', value: 1 },
  { label: '2 Columns', value: 2 },
  { label: '3 Columns', value: 3 },
  { label: '4 Columns', value: 4 },
  { label: '6 Columns', value: 6 },
  { label: '12 Columns', value: 12 },
]

// Get configuration component for widget type
const getConfigComponent = (type: WidgetTypes) => {
  return null
}

// Validation rules
const validationRules = {
  title: [{ required: true, message: 'Please enter widget title' }],
}

// Reset form when modal opens/closes
watch(vModel, (visible) => {
  if (visible) {
    resetForm()
  }
})

// Reset form
const resetForm = () => {
  selectedType.value = undefined
  widgetForm.value = {
    title: '',
    description: '',
    position: {
      x: 0,
      y: 0,
      w: 4,
      h: 3,
    },
    config: {},
  }
}

// Initialize config based on selected type
watch(selectedType, (type) => {
  if (!type) return

  // Set default config based on widget type
  switch (type) {
    case WidgetTypes.TEXT:
      widgetForm.value.config = {
        content: '',
        format: 'plain',
      }
      break
    case WidgetTypes.IFRAME:
      widgetForm.value.config = {
        url: '',
        height: 400,
        allowFullscreen: false,
        sandbox: ['allow-scripts', 'allow-same-origin'],
      }
      break
    case WidgetTypes.METRIC:
      widgetForm.value.config = {
        metric: {
          aggregation: 'count',
        },
      }
      break
    case WidgetTypes.CHART:
      widgetForm.value.config = {
        chartType: 'bar',
      }
      break
    case WidgetTypes.TABLE:
      widgetForm.value.config = {
        showPagination: true,
        limit: 10,
      }
      break
  }
})

// Handle widget creation
const handleCreate = async () => {
  if (!selectedType.value || !props.dashboard?.id) return

  try {
    isCreating.value = true

    const widgetData: Partial<WidgetType> = {
      title: widgetForm.value.title,
      description: widgetForm.value.description,
      type: selectedType.value,
      config: widgetForm.value.config,
      position: widgetForm.value.position,
      fk_dashboard_id: props.dashboard.id,
    }

    const created = await widgetStore.createWidget(props.dashboard.id, widgetData)

    if (created) {
      emit('created', created)
      vModel.value = false
      message.success('Widget created successfully')
    }
  } catch (error) {
    console.error('Error creating widget:', error)
    message.error('Failed to create widget')
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <NcModal v-model:visible="vModel" :title="$t('dashboard.addWidget')" size="medium" :show-separator="false">
    <div class="add-widget-modal">
      <!-- Widget Type Selection -->
      <div class="widget-types-grid">
        <div
          v-for="widgetType in availableWidgetTypes"
          :key="widgetType.type"
          class="widget-type-card"
          :class="{ selected: selectedType === widgetType.type }"
          @click="selectedType = widgetType.type"
        >
          <div class="widget-type-icon">
            <GeneralIcon :icon="widgetType.icon" class="w-8 h-8" />
          </div>
          <div class="widget-type-info">
            <h3 class="widget-type-title">{{ widgetType.title }}</h3>
            <p class="widget-type-description">{{ widgetType.description }}</p>
          </div>
        </div>
      </div>

      <!-- Widget Configuration Form -->
      <div v-if="selectedType" class="widget-config-form">
        <h3 class="config-title">Configure Widget</h3>

        <a-form ref="formRef" :model="widgetForm" :rules="validationRules" layout="vertical" @finish="onSubmit">
          <!-- Basic Widget Info -->
          <a-form-item
            name="title"
            :label="$t('labels.title')"
            :rules="[{ required: true, message: 'Please enter widget title' }]"
          >
            <a-input v-model:value="widgetForm.title" :placeholder="$t('labels.title')" />
          </a-form-item>

          <a-form-item name="description" :label="$t('labels.description')">
            <a-textarea v-model:value="widgetForm.description" :placeholder="$t('labels.description')" :rows="2" />
          </a-form-item>

          <!-- Widget Size -->
          <div class="grid grid-cols-2 gap-4">
            <a-form-item name="width" label="Width">
              <a-select v-model:value="widgetForm.position.w" :options="sizeOptions" />
            </a-form-item>
            <a-form-item name="height" label="Height">
              <a-select v-model:value="widgetForm.position.h" :options="sizeOptions" />
            </a-form-item>
          </div>

          <!-- Type-specific Configuration -->
          <component :is="getConfigComponent(selectedType)" v-if="selectedType !== 'text'" v-model="widgetForm.config" />

          <!-- Text Widget Content -->
          <a-form-item v-if="selectedType === 'text'" name="content" label="Content">
            <a-textarea v-model:value="widgetForm.config.content" placeholder="Enter content..." :rows="4" />
            <div class="mt-2">
              <a-radio-group v-model:value="widgetForm.config.format" size="small">
                <a-radio-button value="plain">Plain Text</a-radio-button>
                <a-radio-button value="markdown">Markdown</a-radio-button>
                <a-radio-button value="html">HTML</a-radio-button>
              </a-radio-group>
            </div>
          </a-form-item>
        </a-form>
      </div>
    </div>

    <div class="flex justify-end gap-2">
      <NcButton type="secondary" @click="vModel = false">Cancel</NcButton>
      <NcButton type="primary" :disabled="!selectedType || !widgetForm.title" :loading="isCreating" @click="handleCreate">
        Create Widget
      </NcButton>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.add-widget-modal {
  @apply space-y-6;
}

.widget-types-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.widget-type-card {
  @apply flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer transition-all;

  &:hover {
    @apply border-blue-300 bg-blue-50;
  }

  &.selected {
    @apply border-blue-500 bg-blue-50 ring-2 ring-blue-200;
  }
}

.widget-type-icon {
  @apply mr-4 text-gray-600;
}

.widget-type-info {
  @apply flex-1;
}

.widget-type-title {
  @apply text-sm font-medium text-gray-900 mb-1;
}

.widget-type-description {
  @apply text-xs text-gray-600;
}

.widget-config-form {
  @apply space-y-4;
}

.config-title {
  @apply text-lg font-medium text-gray-900 mb-4;
}
</style>
