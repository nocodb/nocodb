<script setup lang="ts">
import { type ViewType, ViewTypes } from 'nocodb-sdk'
import GroupedSettings from '../GroupedSettings.vue'

const emit = defineEmits<{
  'update:source': [source: any]
}>()

const widgetStore = useWidgetStore()

const { updateWidget } = widgetStore

const { selectedWidget } = storeToRefs(widgetStore)

const { getMeta } = useMetas()

const isConditionDropdownOpen = ref(false)

const selectedDataSourceType = ref(selectedWidget.value?.config?.dataSource || 'model')
const selectedModelId = ref(selectedWidget.value?.fk_model_id || null)
const selectedViewId = ref(selectedWidget.value?.fk_view_id || null)

const meta = ref()

watch(selectedModelId, async () => {
  if (!selectedModelId.value) {
    return
  }
  meta.value = await getMeta(selectedModelId.value)
})

provide(MetaInj, meta)

const filters = ref(selectedWidget.value?.config?.filters || [])

const updateDataSource = () => {
  const dataSource = { type: selectedDataSourceType.value }
  if (selectedDataSourceType.value === 'model') {
    dataSource.fk_model_id = selectedModelId.value || null
  } else if (selectedDataSourceType.value === 'view') {
    dataSource.fk_model_id = selectedModelId.value || null
    dataSource.fk_view_id = selectedViewId.value || null
  } else if (selectedDataSourceType.value === 'filter') {
    dataSource.fk_model_id = selectedModelId.value || null
  }

  emit('update:source', dataSource)
}

const onDataSourceTypeChange = (newValue) => {
  if (newValue !== 'view') {
    selectedViewId.value = null
  }
  updateDataSource()
}

const onDataChange = (type: 'model' | 'view') => {
  if (type === 'model') {
    selectedViewId.value = null
  }
  updateDataSource()
}

const filterView = (view: ViewType) => {
  return view.type !== ViewTypes.FORM
}

const useDebouncedGetWidget = useDebounceFn(async () => {
  if (!selectedWidget.value?.id) {
    return
  }
  await updateWidget(
    undefined,
    selectedWidget.value?.id,
    {
      filters: filters.value,
    },
    {
      skipNetworkCall: true,
    },
  )
}, 500)

watch(
  filters,
  async () => {
    await useDebouncedGetWidget()
  },
  { deep: true },
)

onMounted(async () => {
  meta.value = await getMeta(selectedModelId.value)
  filters.value = selectedWidget.value?.filters || []
})
</script>

<template>
  <GroupedSettings title="Source">
    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Table</label>
      <NcListTableSelector
        v-model:value="selectedModelId"
        disable-label
        placeholder="Select source "
        @update:value="onDataChange('model')"
      />
    </div>

    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Records</label>
      <a-radio-group
        v-model:value="selectedDataSourceType"
        class="record-filter-type w-full"
        @update:value="onDataSourceTypeChange"
      >
        <a-radio value="model">All Records</a-radio>
        <a-radio value="view">Records from a view</a-radio>
        <a-radio value="filter">Specific records</a-radio>
      </a-radio-group>
    </div>

    <div v-if="selectedDataSourceType === 'view'" class="flex flex-col gap-2 flex-1 min-w-0">
      <label>View</label>
      <NcListViewSelector
        v-model:value="selectedViewId"
        disable-label
        :disabled="!selectedModelId"
        :table-id="selectedModelId!"
        label-default-view-as-default
        :filter-view="filterView"
        @update:value="onDataChange('view')"
      />
    </div>

    <div v-if="selectedDataSourceType === 'filter'" class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Conditions</label>
      <NcDropdown
        v-model:visible="isConditionDropdownOpen"
        placement="bottomLeft"
        overlay-class-name="nc-datasource-conditions-dropdown"
      >
        <div
          class="h-9 border-1 rounded-lg py-1 px-3 flex items-center justify-between gap-2 !min-w-[170px] transition-all cursor-pointer select-none text-sm"
          :class="{
            '!border-brand-500 shadow-selected': isConditionDropdownOpen,
            'border-gray-200': !isConditionDropdownOpen,
            'bg-[#F0F3FF]': filters.length,
          }"
        >
          <div
            class="nc-datasource-conditions-count flex-1"
            :class="{
              'text-brand-500 ': filters.length,
            }"
          >
            {{ filters.length ? `${filters.length} condition${filters.length !== 1 ? 's' : ''}` : 'No conditions' }}
          </div>

          <GeneralIcon
            icon="settings"
            class="flex-none w-4 h-4"
            :class="{
              'text-brand-500 ': filters.length,
            }"
          />
        </div>

        <template #overlay>
          <div
            class="nc-datasource-conditions-dropdown-container"
            :class="{
              'py-2': !filters.length,
            }"
          >
            <SmartsheetToolbarColumnFilter
              v-if="meta"
              v-model="filters"
              class="w-full"
              :widget-id="selectedWidget!.id"
              :widget="true"
              auto-save
              data-testid="nc-filter-menu"
              :show-loading="false"
              @update:filters-length="isConditionDropdownOpen = $event > 0"
            />
          </div>
        </template>
      </NcDropdown>
    </div>
  </GroupedSettings>
</template>

<style scoped lang="scss">
.record-filter-type {
  :deep(.ant-radio-input:focus + .ant-radio-inner) {
    box-shadow: none !important;
  }
  :deep(.ant-radio-wrapper) {
    > span {
      @apply text-nc-content-gray leading-5;
    }
    @apply flex py-2 m-0;
    .ant-radio-checked .ant-radio-inner {
      @apply !bg-nc-fill-primary !border-nc-fill-primary;
      &::after {
        @apply bg-nc-bg-default;
        width: 12px;
        height: 12px;
        margin-top: -6px;
        margin-left: -6px;
      }
    }
    &:first-child {
      @apply rounded-tl-lg rounded-tr-lg;
    }
    &:last-child {
      @apply border-t-0 rounded-bl-lg rounded-br-lg;
    }
  }
}
</style>
