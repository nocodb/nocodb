<script setup lang="ts">
import type { ViewType } from 'nocodb-sdk'
import type { NSelectProps } from './types'
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
    ignoreLoading: false,
    forceLoadBaseTables: false,
    labelDefaultViewAsDefault: false,
  },
)
const NSelectComponent = ref()
const modelValue = useVModel(props, 'modelValue')
const viewsStore = useViewsStore()
const { viewsByTable } = storeToRefs(viewsStore)
const viewsRef = shallowRef<ViewType[]>([])
watch(
  () => [props.tableId, props.ignoreLoading, props.forceFetchViews],
  async () => {
    try {
      await viewsStore.loadViews({ tableId: props.tableId, ignoreLoading: props.ignoreLoading, force: props.forceFetchViews })
    } catch (e) {
      console.error(e)
    }

    let viewsList: ViewType[] = viewsByTable.value.get(props.tableId) || []
    if (props.labelDefaultViewAsDefault) {
      viewsList = viewsList.map((v) => ({ ...v, title: v.is_default ? 'Default View' : v.title }))
    }
    if (props.filterView) {
      viewsList = viewsList.filter(props.filterView)
    }
    viewsRef.value = viewsList
  },
  { immediate: true },
)
defineExpose({
  viewsRef,
})
</script>

<template>
  <NSelect v-bind="props" ref="NSelectComponent" v-model="modelValue">
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
