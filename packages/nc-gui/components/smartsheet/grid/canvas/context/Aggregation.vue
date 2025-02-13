<script setup lang="ts">
const props = defineProps<{
  column: CanvasGridColumn
}>()

const column = toRef(props, 'column')

const { updateAggregate, getAggregations } = useViewAggregateOrThrow()

const aggregations = computed(() => getAggregations(column.value.columnObj))
</script>

<template>
  <NcMenu v-if="column?.uidt" variant="small">
    <NcMenuItem v-for="(agg, index) in aggregations" :key="index" @click="updateAggregate(column.id, agg)">
      <div class="flex !w-full text-[13px] text-gray-800 items-center justify-between">
        {{ $t(`aggregation_type.${agg}`) }}

        <GeneralIcon v-if="column?.aggregation === agg" class="text-brand-500" icon="check" />
      </div>
    </NcMenuItem>
  </NcMenu>
</template>

<style scoped lang="scss"></style>
