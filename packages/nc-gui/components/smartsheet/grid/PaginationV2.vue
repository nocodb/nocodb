<script setup lang="ts">
import { getAvailableAggregations } from 'nocodb-sdk'

const props = defineProps<{
  scrollLeft?: number
}>()

const { updateGridViewColumn, gridViewCols } = useViewColumnsOrThrow()

const scrollLeft = toRef(props, 'scrollLeft')

const containerElement = ref()

const fields = inject(FieldsInj, ref([]))

const visibleFields = computed(() => {
  return fields.value.map((field, index) => ({ field, index })).filter((f) => f.index !== 0)
})

watch(scrollLeft, (value) => {
  if (containerElement.value) {
    containerElement.value.scrollLeft = value
  }
})

const updateAggregate = async (fieldId: string, agg: string) => {
  await updateGridViewColumn(fieldId, { aggregate: agg })
}
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

      <NcDropdown>
        <div
          class="flex items-center hover:bg-gray-100 cursor-pointer text-gray-500 transition-all transition-linear px-3 py-2"
          :style="{
            'min-width': `${Number(gridViewCols[fields[0]?.id]?.width.replace('px', ''))}px` || '180px',
            'max-width': `${Number(gridViewCols[fields[0]?.id]?.width.replace('px', ''))}px` || '180px',
            'width': `${Number(gridViewCols[fields[0]?.id]?.width.replace('px', ''))}px` || '180px',
          }"
        >
          <div
            v-if="gridViewCols[fields[0].id].aggregate === 'none' || gridViewCols[fields[0].id].aggregate === null"
            class="text-gray-500 opacity-0 transition group-hover:opacity-100"
          >
            <GeneralIcon class="text-gray-500" icon="arrowUp" />
            <span class="text-[10px] font-semibold"> -SET AGGREGATE- </span>
          </div>
        </div>

        <template #overlay>
          <NcMenu>
            <NcMenuItem v-for="(agg, index) in getAvailableAggregations(fields[0].uidt).filter((x) => x !== 'none')" :key="index">
              {{ $t(`aggregation.${agg}`) }}
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>

    <NcDropdown v-for="({ field }, index) in visibleFields" :key="index">
      <div
        class="flex items-center justify-end group hover:bg-gray-100 cursor-pointer text-gray-500 transition-all transition-linear px-3 py-2"
        :style="{
          'min-width': `${Number(gridViewCols[field.id]?.width.replace('px', ''))}px` || '180px',
          'max-width': `${Number(gridViewCols[field.id]?.width.replace('px', ''))}px` || '180px',
          'width': `${Number(gridViewCols[field.id]?.width.replace('px', ''))}px` || '180px',
        }"
      >
        <div
          v-if="gridViewCols[field.id].aggregate === 'none' || gridViewCols[field.id].aggregate === null"
          class="text-gray-500 opacity-0 transition group-hover:opacity-100"
        >
          <GeneralIcon class="text-gray-500" icon="arrowUp" />
          <span class="text-[10px] font-semibold"> -SET AGGREGATE- </span>
        </div>
      </div>

      <template #overlay>
        <NcMenu>
          <NcMenuItem
            v-for="(agg, index) in getAvailableAggregations(field.uidt)"
            :key="index"
            @click="updateAggregate(field.id, agg)"
          >
            <div class="flex !w-full text-gray-800 items-center justify-between">
              {{ $t(`aggregation.${agg}`) }}

              <GeneralIcon v-if="gridViewCols[field.id].aggregate === agg" class="text-brand-500" icon="check" />
            </div>
          </NcMenuItem>
        </NcMenu>
      </template>
    </NcDropdown>

    <div class="!px-8 !w-8 h-1">‎</div>
  </div>
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply w-full;
}
</style>
