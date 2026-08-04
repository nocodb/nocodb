<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'

interface Props {
  tableId?: string
  baseId?: string
  viewId?: string
  value?: string
  forceLayout?: 'vertical' | 'horizontal'
  filterView?: (view: ViewType) => boolean
  itemFlags?: (view: ViewType) => { disabled?: boolean; tooltip?: string }
  ignoreLoading?: boolean
  forceFetchViews?: boolean
  disableLabel?: boolean
  autoSelect?: boolean
  disabled?: boolean
  allowClear?: boolean
  /** Pre-fetched views — skips the store fetch entirely. For tables the
   *  current user can't list via their own ACL / aren't in the tables store
   *  (e.g. a sync's source base read through a share-view-authorized call). */
  views?: ViewType[]
}

const props = withDefaults(defineProps<Props>(), {
  ignoreLoading: false,
  forceFetchViews: false,
  disableLabel: false,
  autoSelect: false,
  disabled: false,
  allowClear: false,
})

const emit = defineEmits<{
  'update:value': [value: string | undefined]
}>()

const { t } = useI18n()

const viewsStore = useViewsStore()
const { viewsByTable } = storeToRefs(viewsStore)
const { activeProjectId } = storeToRefs(useBases())

const modelValue = useVModel(props, 'value', emit)

const isOpenViewSelectDropdown = ref(false)

const handleValueUpdate = (value: any) => {
  if (value === null || value === undefined || value === '') {
    modelValue.value = undefined
    return
  }
  modelValue.value = String(value)
}

const viewList = computedAsync(async () => {
  let viewsList: ViewType[]

  if (props.views) {
    viewsList = props.views
  } else {
    if (!props.tableId) return []

    try {
      const effectiveBaseId = props.baseId || activeProjectId.value
      if (!effectiveBaseId) {
        console.error('[ViewSelector] baseId is required but was not provided')
        return []
      }

      await viewsStore.loadViews({
        tableId: props.tableId,
        baseId: effectiveBaseId,
        ignoreLoading: props.ignoreLoading,
        force: props.forceFetchViews,
      })
    } catch (e) {
      console.error(e)
      return []
    }

    // Use composite key (baseId:tableId) to get views
    const effectiveBaseId = props.baseId || activeProjectId.value
    const key = `${effectiveBaseId}:${props.tableId}`

    viewsList = viewsByTable.value.get(key) || []
  }

  if (props.filterView) {
    viewsList = viewsList.filter(props.filterView)
  }
  return viewsList.map((view) => {
    const flags = props.itemFlags?.(view) ?? {}
    return {
      label: view.title || view.id,
      value: view.id,
      ncItemDisabled: !!flags.disabled,
      ncItemTooltip: flags.tooltip ?? '',
      ...view,
    }
  })
}, [])

const viewListMap = computed(() => {
  if (!viewList.value || viewList.value.length === 0) return new Map()

  return new Map(viewList.value.map((view) => [view.value, view]))
})

const selectedView = computed(() => {
  if (!viewListMap.value || viewListMap.value.size === 0) return undefined

  if (!modelValue.value) return undefined

  return viewListMap.value.get(modelValue.value)
})

watch(
  viewList,
  (newViewList) => {
    if (newViewList && newViewList.length > 0) {
      const newViewListMap = new Map(newViewList.map((view) => [view.value, view]))

      // Check if current value exists in the new view list
      if (modelValue.value && !newViewListMap.has(modelValue.value)) {
        // Current value is not in the list, set null to clear it
        modelValue.value = undefined
        return
      }

      // Auto-select logic (only if autoSelect is enabled and no current value)
      if (!modelValue.value && props.autoSelect) {
        const newViewId = props.viewId || newViewList[0]?.value

        const viewObj = newViewListMap.get(newViewId)

        // Change view id only if it is default view selected initially and its not enabled
        if (viewObj && viewObj.ncItemDisabled && viewObj.value === newViewList[0]?.value) {
          const selectedValue = newViewList.find((view) => !view.ncItemDisabled)?.value || newViewList[0]?.value
          modelValue.value = selectedValue
        } else {
          modelValue.value = newViewId
        }
      }
    }
  },
  { immediate: true },
)

defineExpose({
  modelValue,
  selectedView,
  isOpenViewSelectDropdown,
  viewList,
  viewListMap,
})
</script>

<template>
  <a-form-item
    name="viewId"
    class="!mb-0 nc-view-selector"
    :class="`nc-force-layout-${forceLayout}`"
    :validate-status="selectedView?.ncItemDisabled ? 'error' : ''"
    :help="selectedView?.ncItemDisabled ? [selectedView.ncItemTooltip] : []"
    @click.stop
    @dblclick.stop
  >
    <template v-if="!disableLabel" #label>
      <div>
        <slot name="label">{{ t('objects.view') }}</slot>
      </div>
    </template>
    <NcListDropdown v-model:is-open="isOpenViewSelectDropdown" :disabled="disabled" :has-error="!!selectedView?.ncItemDisabled">
      <div class="flex-1 flex group items-center gap-2 min-w-0">
        <div v-if="selectedView" class="min-w-5 flex items-center justify-center">
          <NcIconView :view="selectedView" class="text-nc-content-gray-muted" />
        </div>
        <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only>
          <span
            v-if="selectedView"
            :key="selectedView?.value"
            class="text-sm flex-1 truncate"
            :class="{ 'text-nc-content-gray-muted': !selectedView }"
          >
            {{ selectedView?.label }}
          </span>
          <span v-else class="text-sm flex-1 truncate text-nc-content-gray-muted">-- Select view --</span>

          <template #title>
            {{ selectedView?.label || 'Select view' }}
          </template>
        </NcTooltip>

        <GeneralIcon
          v-if="selectedView && allowClear"
          v-e="['c:view-selector:clear']"
          class="hidden text-nc-content-gray-muted transition group-hover:!block h-4 w-4 cursor-pointer"
          icon="ncXCircle"
          @click.stop="handleValueUpdate(null)"
        />

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
          class="!w-auto"
          wrapper-class-name="!h-auto"
          @update:value="handleValueUpdate"
          @escape="onEsc"
        >
          <template #listItemExtraLeft="{ option }">
            <div class="min-w-5 flex items-center justify-center">
              <NcIconView :view="option" class="text-nc-content-gray-muted" />
            </div>
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </a-form-item>
</template>
