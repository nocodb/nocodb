<script setup lang="ts">
import type { UITypes } from 'nocodb-sdk'
import { getAvailableAggregations } from 'nocodb-sdk'

const props = defineProps<{
  scrollLeft?: number
}>()

const { updateGridViewColumn, gridViewCols } = useViewColumnsOrThrow()

const scrollLeft = toRef(props, 'scrollLeft')

const containerElement = ref()

const fields = inject(FieldsInj, ref([]))

const visibleFields = computed(() => {
  const f = fields.value.map((field, index) => ({ field, index })).filter((f) => f.index !== 0)

  return f.map((f) => {
    const gridField = gridViewCols.value[f.field.id!]

    if (!gridField) {
      return { field: null, index: f.index }
    }

    return {
      type: f.field.uidt,
      field: gridField,
      index: f.index,
      width: `${Number(gridField.width.replace('px', ''))}px` || '180px',
    }
  })
})

const displayFieldComputed = computed(() => {
  if (!fields.value?.length || !gridViewCols.value)
    return {
      field: null,
      width: '180px',
    }

  return {
    type: fields.value[0].uidt,
    field: gridViewCols.value[fields.value[0].id!],
    width: `${Number((gridViewCols.value[fields.value[0]!.id!].width ?? '').replace('px', ''))}px` || '180px',
  }
})

const getAggregations = (type: string, hideNone?: boolean) => {
  const agg = getAvailableAggregations(type)
  if (hideNone) {
    return agg.filter((x) => x !== 'none')
  }
  return agg
}

watch(scrollLeft, (value) => {
  if (containerElement.value) {
    containerElement.value.scrollLeft = value
  }
})

const updateAggregate = async (fieldId: string, agg: string) => {
  await updateGridViewColumn(fieldId, { aggregation: agg })
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

      <NcDropdown v-if="displayFieldComputed.field && displayFieldComputed.field.id">
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
        </div>

        <template #overlay>
          <NcMenu>
            <NcMenuItem
              v-for="(agg, index) in getAggregations(displayFieldComputed!.type, true)"
              :key="index"
              @click="updateAggregate(displayFieldComputed.field.id, agg)"
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

    <template v-for="({ field, width, type }, index) in visibleFields" :key="index">
      <NcDropdown v-if="field && field.id">
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
        </div>

        <template #overlay>
          <NcMenu>
            <NcMenuItem v-for="(agg, index) in getAggregations(type)" :key="index" @click="updateAggregate(field.id, agg)">
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
