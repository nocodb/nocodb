<script setup lang="ts">
const props = defineProps<{
  column: CanvasGridColumn | null
}>()

const emits = defineEmits<{
  'update:column': (column: CanvasGridColumn) => void
}>()

const column = useVModel(props, 'column', emits)

const { updateAggregate, getAggregations } = useViewAggregateOrThrow()

const { gridViewCols } = useViewColumnsOrThrow()

const gridCol = computed(() => gridViewCols.value[column.value.id])
const aggregations = computed(() => getAggregations(column.value.columnObj))

const onClick = (agg) => {
  updateAggregate(column.value.id, agg)
  column.value = null
}
</script>

<template>
  <NcMenu v-if="column?.uidt" class="!max-h-55 overflow-auto" variant="small">
    <NcMenuItem v-for="(agg, index) in aggregations" :key="index" @click="onClick(agg)">
      <div class="flex !w-full text-[13px] text-gray-800 items-center justify-between">
        {{ $t(`aggregation_type.${agg}`) }}
        <GeneralIcon v-if="gridCol?.aggregation === agg" class="text-brand-500" icon="check" />
      </div>
    </NcMenuItem>
  </NcMenu>
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply w-full;
}
</style>
