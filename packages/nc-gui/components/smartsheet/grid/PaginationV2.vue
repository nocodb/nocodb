<script setup lang="ts">
import { formatAggregation } from 'nc-gui/utils/aggregationUtils'

const props = defineProps<{
  scrollLeft?: number
}>()

const { loadViewAggregate, updateAggregate, getAggregations, visibleFieldsComputed, displayFieldComputed } =
  useViewAggregateOrThrow()

const scrollLeft = toRef(props, 'scrollLeft')

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const containerElement = ref()

watch(scrollLeft, (value) => {
  if (containerElement.value) {
    containerElement.value.scrollLeft = value
  }
})

reloadViewDataHook?.on(async () => {
  await loadViewAggregate()
})

onMounted(() => {
  loadViewAggregate()
})
</script>

<template>
  <div ref="containerElement" class="bg-gray-50 w-full pr-1 border-t-1 border-gray-200 overflow-x-hidden no-scrollbar flex h-9">
    <div class="sticky flex bg-gray-50 left-0">
      <div class="min-w-16 max-w-16 h-full left-0 flex items-center justify-center">
        <NcTooltip>
          <template #title>
            Aggregation bar : Configure summary statistics such as sum, average, count, and more for fields.</template
          >
          <GeneralIcon icon="info" />
        </NcTooltip>
      </div>

      <NcDropdown v-if="displayFieldComputed.field && displayFieldComputed.column?.id">
        <div
          class="flex items-center hover:bg-gray-100 cursor-pointer text-gray-500 transition-all transition-linear px-3 py-2"
          :style="{
            'min-width': displayFieldComputed?.width,
            'max-width': displayFieldComputed?.width,
            'width': displayFieldComputed?.width,
          }"
        >
          <div
            v-if="!displayFieldComputed.field?.aggregation || displayFieldComputed.field?.aggregation === 'none'"
            class="text-gray-500 opacity-0 transition group-hover:opacity-100"
          >
            <GeneralIcon class="text-gray-500" icon="arrowUp" />
            <span class="text-[10px] font-semibold"> -SET AGGREGATE- </span>
          </div>
          <div v-else-if="displayFieldComputed.value !== undefined" class="flex gap-2 text-nowrap overflow-hidden items-center">
            <span class="text-gray-500 text-[12px] font-semibold leading-4">
              {{ $t(`aggregation.${displayFieldComputed.field.aggregation}`) }}
            </span>

            <span class="text-gray-600 text-[12px]">
              {{
                formatAggregation(displayFieldComputed.field.aggregation, displayFieldComputed.value, displayFieldComputed.column)
              }}
            </span>
          </div>
        </div>

        <template #overlay>
          <NcMenu>
            <NcMenuItem
              v-for="(agg, index) in getAggregations(displayFieldComputed.column.uidt, true)"
              :key="index"
              @click="updateAggregate(displayFieldComputed.column.id, agg)"
            >
              <div class="flex !w-full text-gray-800 items-center justify-between">
                {{ $t(`aggregation.${agg}`) }}

                <GeneralIcon v-if="displayFieldComputed.field?.aggregation === agg" class="text-brand-500" icon="check" />
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>

    <template v-for="({ field, width, column, value }, index) in visibleFieldsComputed" :key="index">
      <NcDropdown v-if="field && column?.id">
        <div
          class="flex items-center justify-end group hover:bg-gray-100 cursor-pointer text-gray-500 transition-all transition-linear px-3 py-2"
          :style="{
            'min-width': width,
            'max-width': width,
            'width': width,
          }"
        >
          <div
            v-if="field?.aggregation === 'none' || field?.aggregation === null"
            class="text-gray-500 opacity-0 transition group-hover:opacity-100"
          >
            <GeneralIcon class="text-gray-500" icon="arrowUp" />
            <span class="text-[10px] font-semibold"> -SET AGGREGATE- </span>
          </div>

          <div v-else-if="value !== undefined" class="flex gap-2 text-nowrap overflow-hidden items-center">
            <span class="text-gray-500 text-[12px] font-semibold leading-4">
              {{ $t(`aggregation.${field.aggregation}`) }}
            </span>

            <span class="text-gray-600 text-[12px]">
              {{ formatAggregation(field.aggregation, value, column) }}
            </span>
          </div>
        </div>

        <template #overlay>
          <NcMenu>
            <NcMenuItem
              v-for="(agg, index) in getAggregations(column.uidt)"
              :key="index"
              @click="updateAggregate(column.id, agg)"
            >
              <div class="flex !w-full text-gray-800 items-center justify-between">
                {{ $t(`aggregation.${agg}`) }}

                <GeneralIcon v-if="field?.aggregation === agg" class="text-brand-500" icon="check" />
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </template>

    <div class="!px-8 !w-8 h-1">‎</div>
  </div>
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply w-full;
}
</style>
