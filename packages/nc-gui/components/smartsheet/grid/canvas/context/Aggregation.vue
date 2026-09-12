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
const { meta } = useSmartsheetStoreOrThrow()
const isLocked = inject(IsLockedInj, ref(false))

// Interface pages use the airy default-variant menu chrome (same as the
// record context menu); the data tab keeps the dense small variant.
const interfacePageDataApi = inject(InterfacePageDataInj, undefined)

const isMmTable = computed(() => !!meta.value?.mm)
const gridCol = computed(() => gridViewCols.value[column.value.id])
const hasColError = computed(() => !!column.value?.columnObj?.colOptions?.error)
const aggregations = computed(() => (hasColError.value || isMmTable.value ? [] : getAggregations(column.value.columnObj)))

const onClick = (agg) => {
  updateAggregate(column.value.id, agg)
  column.value = null
}
</script>

<template>
  <NcMenu
    v-if="column?.uidt"
    :disabled="isLocked"
    class="overflow-auto"
    :class="interfacePageDataApi ? '!rounded-lg !max-h-80 nc-interface-aggregation-menu' : '!max-h-55'"
    :variant="interfacePageDataApi ? 'default' : 'small'"
  >
    <NcMenuItem v-for="(agg, index) in aggregations" :key="index" @click="onClick(agg)">
      <div class="flex !w-full text-[13px] text-nc-content-gray items-center justify-between gap-3">
        {{ $t(`aggregation_type.${agg}`) }}
        <GeneralIcon v-if="gridCol?.aggregation === agg" class="text-nc-content-brand" icon="check" />
      </div>
    </NcMenuItem>
  </NcMenu>
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply w-full;
}

.nc-interface-aggregation-menu {
  :deep(.nc-menu-item) {
    svg {
      @apply w-3.5 h-3.5;
    }
  }
}
</style>
