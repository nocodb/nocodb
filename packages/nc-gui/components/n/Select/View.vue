<script setup lang="ts">
import type { NSelectProps } from './types'
import type { ViewType } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<
    NSelectProps & {
      tableId?: string
      ignoreLoading?: boolean
      forceFetchViews?: boolean
      filterView?: (v: ViewType) => boolean
      labelDefaultViewAsDefault?: boolean
    }
  >(),
  {
    placeholder: '- select view -',
    showSearch: false,
    suffixIcon: 'arrowDown',
    forceLoadBaseTables: false,
    labelDefaultViewAsDefault: false,
  },
)

const NSelectComponent = ref()

const viewsStore = useViewsStore()
const { viewsByTable } = storeToRefs(viewsStore)

const viewsRef = computedAsync<ViewType[]>(async () => {
  await viewsStore.loadViews(props.tableId, props.ignoreLoading, props.forceFetchViews)
  let viewsList: ViewType[] = viewsByTable.value.get(props.tableId) || []
  if (props.labelDefaultViewAsDefault) {
    viewsList = viewsList.map((v) => ({ ...v, title: v.is_default ? 'Default View' : v.title }))
  }
  if (props.filterView) {
    viewsList = viewsList.filter(props.filterView)
  }

  if (NSelectComponent.value) {
    let selectedView = viewsList.find((v) => v.is_default)
    if (!selectedView) {
      selectedView = viewsList[0]
    }
    NSelectComponent.value.selectValue(selectedView?.id)
  }

  return viewsList
})
</script>

<template>
  <NSelect v-bind="props" ref="NSelectComponent">
    <a-select-option v-for="view of viewsRef" :key="view.id" :value="view.id">
      <div class="w-full flex items-center gap-2">
        <div class="min-w-5 flex items-center justify-center">
          <NIconView :view="view" class="text-gray-500" />
        </div>
        <NcTooltip class="flex-1 truncate" show-on-truncate-only>
          <template #title>{{ view.title }}</template>
          <span>{{ view.title }}</span>
        </NcTooltip>
        <component
          :is="iconMap.check"
          v-if="modelValue === view.id"
          id="nc-selected-item-icon"
          class="flex-none text-primary w-4 h-4"
        />
      </div>
    </a-select-option>
  </NSelect>
</template>
