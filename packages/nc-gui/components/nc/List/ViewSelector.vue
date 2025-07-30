<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'

interface Props {
  tableId?: string
  viewId?: string
  value?: string
  showViewSelector?: boolean
  forceLayout?: 'vertical' | 'horizontal'
  filterView?: (view: ViewType) => boolean
  ignoreLoading?: boolean
  forceFetchViews?: boolean
  labelDefaultViewAsDefault?: boolean
  disableLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showViewSelector: true,
  ignoreLoading: false,
  forceFetchViews: false,
  labelDefaultViewAsDefault: false,
  disableLabel: false,
})

const emit = defineEmits<{
  'update:value': [value: string | undefined]
}>()

const { t } = useI18n()

const viewsStore = useViewsStore()
const { viewsByTable } = storeToRefs(viewsStore)

const modelValue = useVModel(props, 'value', emit)

const isOpenViewSelectDropdown = ref(false)

const handleValueUpdate = (value: any) => {
  const stringValue = String(value)
  modelValue.value = stringValue
  emit('update:value', stringValue)
}

const viewList = computedAsync(async () => {
  if (!props.tableId) return []

  try {
    await viewsStore.loadViews({ 
      tableId: props.tableId, 
      ignoreLoading: props.ignoreLoading, 
      force: props.forceFetchViews 
    })
  } catch (e) {
    console.error(e)
    return []
  }

  let viewsList: ViewType[] = viewsByTable.value.get(props.tableId) || []
  
  if (props.labelDefaultViewAsDefault) {
    viewsList = viewsList.map((v) => ({ ...v, title: v.is_default ? 'Default View' : v.title }))
  }
  
  if (props.filterView) {
    viewsList = viewsList.filter(props.filterView)
  }
  return viewsList.map((view) => {
    const ncItemTooltip = ''

    return {
      label: view.title || view.id,
      value: view.id,
      ncItemDisabled: false,
      ncItemTooltip,
      ...view,
    }
  })
})

const selectedView = computed(() => {
  if (!viewList.value || viewList.value.length === 0) return undefined

  return viewList.value.find((view) => view.value === modelValue.value) || viewList.value[0]
})

watch(viewList, (newViewList) => {
  if (!modelValue.value && newViewList && newViewList.length > 0) {
    const newViewId = props.viewId || newViewList[0]?.value

    const viewObj = newViewList.find((view) => view.value === newViewId)

    // Change view id only if it is default view selected initially and its not enabled
    if (viewObj && viewObj.ncItemDisabled && viewObj.value === newViewList[0]?.value) {
      modelValue.value = newViewList.find((view) => !view.ncItemDisabled)?.value || newViewList[0]?.value
    } else {
      modelValue.value = newViewId
    }
  }
}, { immediate: true })

defineExpose({
  modelValue,
  selectedView,
  isOpenViewSelectDropdown,
  viewList,
})
</script>

<template>
  <a-form-item
    v-if="selectedView"
    name="viewId"
    class="!mb-0 nc-view-selector"
    :class="`nc-force-layout-${forceLayout}`"
    :validate-status="selectedView?.ncItemDisabled ? 'error' : ''"
    :help="selectedView?.ncItemDisabled ? [selectedView.ncItemTooltip] : []"
    @click.stop
    @dblclick.stop
  >
    <template v-if="!disableLabel" #label>
      <div>{{ t('general.view') }}</div>
    </template>
    <NcListDropdown
      v-model:is-open="isOpenViewSelectDropdown"
      :disabled="!showViewSelector"
      :default-slot-wrapper-class="
        !showViewSelector
          ? 'text-nc-content-gray-muted cursor-not-allowed bg-nc-bg-gray-light children:opacity-60'
          : 'text-nc-content-gray'
      "
      :has-error="!!selectedView?.ncItemDisabled"
    >
      <div class="flex-1 flex items-center gap-2 min-w-0">
        <div class="min-w-5 flex items-center justify-center">
          <NIconView :view="selectedView" class="text-gray-500" />
        </div>
        <span class="text-sm flex-1 truncate">{{ selectedView?.label || t('general.view') }}</span>

        <GeneralIcon
          icon="ncChevronDown"
          class="flex-none h-4 w-4 transition-transform opacity-70"
          :class="{ 'transform rotate-180': isOpenViewSelectDropdown }"
        />
      </div>
      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isOpenViewSelectDropdown"
          :value="modelValue || selectedView?.value || ''"
          :list="viewList"
          variant="medium"
          class="!w-auto !max-w-xs"
          wrapper-class-name="!h-auto"
          @update:value="handleValueUpdate"
          @escape="onEsc"
        >
          <template #item="{ item }">
            <div class="w-full flex items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <NIconView :view="item" class="text-gray-500" />
              </div>
              <NcTooltip class="flex-1 overflow-hidden whitespace-nowrap text-ellipsis" show-on-truncate-only>
                <template #title>{{ item.label }}</template>
                <span>{{ item.label }}</span>
              </NcTooltip>
              <component
                :is="iconMap.check"
                v-if="modelValue === item.value"
                id="nc-selected-item-icon"
                class="flex-none text-primary w-4 h-4"
              />
            </div>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </a-form-item>
</template>

<style lang="scss">
.nc-view-selector.ant-form-item {
  &.nc-force-layout-vertical {
    @apply !flex-col;

    & > .ant-form-item-label {
      @apply pb-2 text-left;

      &::after {
        @apply hidden;
      }

      & > label {
        @apply !h-auto;
        &::after {
          @apply !hidden;
        }
      }
    }
  }

  &.nc-force-layout-horizontal {
    @apply !flex-row !items-center;

    & > .ant-form-item-label {
      @apply pb-0 items-center;

      &::after {
        @apply content-[':'] !mr-2 !ml-0.5 relative top-[0.5px];
      }
    }
  }
}
</style>
