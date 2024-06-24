<script setup lang="ts">
import axios from 'axios'
import type { PaginatedType } from 'nocodb-sdk'

const props = defineProps<{
  scrollLeft?: number
  paginationData: PaginatedType
  changePage: (page: number) => void
}>()

const emits = defineEmits(['update:paginationData'])

const { isPaginationLoading } = storeToRefs(useViewsStore())

const { changePage } = props

const vPaginationData = useVModel(props, 'paginationData', emits)

const { loadViewAggregate, updateAggregate, getAggregations, visibleFieldsComputed, displayFieldComputed } =
  useViewAggregateOrThrow()

const scrollLeft = toRef(props, 'scrollLeft')

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const containerElement = ref()

watch(
  scrollLeft,
  (value) => {
    if (containerElement.value) {
      containerElement.value.scrollLeft = value
    }
  },
  {
    immediate: true,
  },
)

reloadViewDataHook?.on(async () => {
  await loadViewAggregate()
})

const count = computed(() => vPaginationData.value?.totalRows ?? Infinity)

const page = computed({
  get: () => vPaginationData?.value?.page ?? 1,
  set: async (p) => {
    isPaginationLoading.value = true
    try {
      await changePage?.(p)
      isPaginationLoading.value = false
    } catch (e) {
      if (axios.isCancel(e)) {
        return
      }
      isPaginationLoading.value = false
    }
  },
})

const size = computed({
  get: () => vPaginationData.value?.pageSize ?? 25,
  set: (size: number) => {
    if (vPaginationData.value) {
      // if there is no change in size then return
      if (vPaginationData.value?.pageSize && vPaginationData.value?.pageSize === size) {
        return
      }

      vPaginationData.value.pageSize = size

      if (vPaginationData.value.totalRows && page.value * size < vPaginationData.value.totalRows) {
        changePage?.(page.value)
      } else {
        changePage?.(1)
      }
    }
  },
})

const renderAltOrOptlKey = () => {
  return isMac() ? '⌥' : 'ALT'
}

onMounted(() => {
  loadViewAggregate()
})
</script>

<template>
  <div ref="containerElement" class="bg-gray-50 w-full pr-1 border-t-1 border-gray-200 overflow-x-hidden no-scrollbar flex h-9">
    <div class="sticky flex bg-gray-50 left-0">
      <div class="min-w-16 max-w-16 h-full left-0 flex items-center justify-center">
        <NcTooltip wrap-child="span">
          <template #title>
            Aggregation bar: Use to quickly calculate totals, averages, and other summary statistics over your field data.
          </template>
          <GeneralIcon class="text-gray-600" icon="info" />
        </NcTooltip>
      </div>

      <NcDropdown v-if="displayFieldComputed.field && displayFieldComputed.column?.id">
        <div
          class="flex items-center hover:bg-gray-100 cursor-pointer text-gray-500 justify-end transition-all transition-linear px-3 py-2"
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
              v-for="(agg, index) in getAggregations(displayFieldComputed.column, true)"
              :key="index"
              @click="updateAggregate(displayFieldComputed.column.id, agg)"
            >
              <div class="flex !w-full text-gray-800 items-center justify-between">
                {{ $t(`aggregation_type.${agg}`) }}

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
              {{ $t(`aggregation.${field.aggregation}`).replace('Percent ', '') }}
            </span>

            <span class="text-gray-600 text-[12px]">
              {{ formatAggregation(field.aggregation, value, column) }}
            </span>
          </div>
        </div>

        <template #overlay>
          <NcMenu>
            <NcMenuItem v-for="(agg, index) in getAggregations(column)" :key="index" @click="updateAggregate(column.id, agg)">
              <div class="flex !w-full text-gray-800 items-center justify-between">
                {{ $t(`aggregation_type.${agg}`) }}

                <GeneralIcon v-if="field?.aggregation === agg" class="text-brand-500" icon="check" />
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </template>

    <div class="!pl-8 pr-60 !w-8 h-1">‎</div>

    <div class="fixed h-9 bg-white border-l-1 border-gray-200 px-1 flex items-center right-0">
      <NcPaginationV2
        v-if="count !== Infinity"
        v-model:current="page"
        v-model:page-size="size"
        class="xs:(mr-2)"
        :total="+count"
        entity-name="grid"
        :prev-page-tooltip="`${renderAltOrOptlKey()}+←`"
        :next-page-tooltip="`${renderAltOrOptlKey()}+→`"
        :first-page-tooltip="`${renderAltOrOptlKey()}+↓`"
        :last-page-tooltip="`${renderAltOrOptlKey()}+↑`"
        :show-size-changer="true"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply w-full;
}

.nc-grid-pagination-wrapper {
  .ant-pagination-item-active {
    a {
      @apply text-sm !text-gray-700 !hover:text-gray-800;
    }
  }
}
</style>

<style scoped></style>
