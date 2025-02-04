<script setup lang="ts">
import axios from 'axios'
import { type PaginatedType, UITypes } from 'nocodb-sdk'

const props = defineProps<{
  scrollLeft?: number
  paginationData?: PaginatedType
  changePage?: (page: number) => void
  showSizeChanger?: boolean
  customLabel?: string
  totalRows?: number
  depth?: number
  disablePagination?: boolean
}>()

const emits = defineEmits(['update:paginationData'])

const { isViewDataLoading, isPaginationLoading } = storeToRefs(useViewsStore())

const isLocked = inject(IsLockedInj, ref(false))

const { changePage, customLabel } = props

const showSizeChanger = toRef(props, 'showSizeChanger')

const vPaginationData = useVModel(props, 'paginationData', emits)

const disablePagination = toRef(props, 'disablePagination')

const { updateAggregate, getAggregations, visibleFieldsComputed, displayFieldComputed } = useViewAggregateOrThrow()

const scrollLeft = toRef(props, 'scrollLeft')

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

const count = computed(() => vPaginationData.value?.totalRows ?? Infinity)

const page = computed({
  get: () => vPaginationData?.value?.page ?? 1,
  set: async (p) => {
    if (disablePagination.value) {
      return
    }
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

const getAddnlMargin = (depth: number, ignoreCondition = false) => {
  if (!ignoreCondition ? (scrollLeft.value ?? 0) < 30 : true) {
    switch (depth) {
      case 3:
        return 26
      case 2:
        return 17
      case 1:
        return 8
      default:
        return 0
    }
  }
  return 0
}
</script>

<template>
  <div ref="containerElement" class="bg-gray-50 w-full pr-1 border-t-1 border-gray-200 overflow-x-hidden no-scrollbar flex h-9">
    <div class="sticky flex items-center bg-gray-50 left-0">
      <NcDropdown
        :disabled="[UITypes.SpecificDBType, UITypes.ForeignKey,  UITypes.Button].includes(displayFieldComputed.column?.uidt!) || isLocked"
        overlay-class-name="max-h-96 relative scroll-container nc-scrollbar-md overflow-auto"
      >
        <div
          v-if="displayFieldComputed.field && displayFieldComputed.column?.id"
          class="flex items-center overflow-x-hidden hover:bg-gray-100 cursor-pointer text-gray-500 justify-end transition-all transition-linear px-3 py-2"
          :style="{
            'min-width': displayFieldComputed?.width,
            'max-width': displayFieldComputed?.width,
            'width': displayFieldComputed?.width,
            'margin-left': `${getAddnlMargin(depth ?? 0)}px`,
          }"
        >
          <div class="flex relative justify-between gap-2 w-full">
            <template v-if="!disablePagination">
              <div v-if="isViewDataLoading" class="nc-pagination-skeleton flex justify-center item-center min-h-10 min-w-16 w-16">
                <a-skeleton :active="true" :title="true" :paragraph="false" class="w-16 max-w-16" />
              </div>
              <NcTooltip v-else class="flex sticky items-center h-full">
                <template #title>
                  {{ count }} {{ customLabel ? customLabel : count !== 1 ? $t('objects.records') : $t('objects.record') }}
                </template>
                <span
                  data-testid="grid-pagination"
                  class="text-gray-500 text-ellipsis overflow-hidden pl-1 truncate nc-grid-row-count caption text-xs text-nowrap"
                >
                  {{ Intl.NumberFormat('en', { notation: 'compact' }).format(count) }}
                  {{ customLabel ? customLabel : count !== 1 ? $t('objects.records') : $t('objects.record') }}
                </span>
              </NcTooltip>
            </template>

            <template v-else-if="+totalRows >= 0">
              <NcTooltip class="flex sticky items-center h-full">
                <template #title> {{ totalRows }} {{ totalRows !== 1 ? $t('objects.records') : $t('objects.record') }} </template>
                <span
                  data-testid="grid-pagination"
                  class="text-gray-500 text-ellipsis overflow-hidden pl-1 truncate nc-grid-row-count caption text-xs text-nowrap"
                >
                  {{ Intl.NumberFormat('en', { notation: 'compact' }).format(totalRows) }}
                  {{ totalRows !== 1 ? $t('objects.records') : $t('objects.record') }}
                </span>
              </NcTooltip>
            </template>

            <template
              v-if="![UITypes.SpecificDBType, UITypes.ForeignKey, UITypes.Button].includes(displayFieldComputed.column?.uidt!)"
            >
              <div
                v-if="!displayFieldComputed.field?.aggregation || displayFieldComputed.field?.aggregation === 'none'"
                :class="{
                  'group-hover:opacity-100': ![UITypes.SpecificDBType, UITypes.ForeignKey, UITypes.Button].includes(displayFieldComputed.column?.uidt!)
                }"
                class="text-gray-500 opacity-0 transition"
              >
                <GeneralIcon class="text-gray-500" icon="arrowDown" />
                <span class="text-[10px] font-semibold"> Summary </span>
              </div>
              <NcTooltip
                v-else-if="displayFieldComputed.value !== undefined"
                :style="{
                  maxWidth: `${displayFieldComputed?.width}`,
                }"
              >
                <div style="direction: rtl" class="flex gap-2 text-nowrap truncate overflow-hidden items-center">
                  <span class="text-gray-600 text-[12px] font-semibold">
                    {{
                      formatAggregation(
                        displayFieldComputed.field.aggregation,
                        displayFieldComputed.value,
                        displayFieldComputed.column,
                      )
                    }}
                  </span>
                  <span class="text-gray-500 text-[12px] leading-4">
                    {{ $t(`aggregation.${displayFieldComputed.field.aggregation}`) }}
                  </span>
                </div>

                <template #title>
                  <div class="flex gap-2 text-nowrap overflow-hidden items-center">
                    <span class="text-[12px] leading-4">
                      {{ $t(`aggregation.${displayFieldComputed.field.aggregation}`) }}
                    </span>

                    <span class="text-[12px] font-semibold">
                      {{
                        formatAggregation(
                          displayFieldComputed.field.aggregation,
                          displayFieldComputed.value,
                          displayFieldComputed.column,
                        )
                      }}
                    </span>
                  </div>
                </template>
              </NcTooltip>
            </template>
          </div>
        </div>

        <template #overlay>
          <NcMenu v-if="displayFieldComputed.field && displayFieldComputed.column?.id" variant="small">
            <NcMenuItem
              v-for="(agg, index) in getAggregations(displayFieldComputed.column)"
              :key="index"
              @click="updateAggregate(displayFieldComputed.column.id, agg)"
            >
              <div class="flex !w-full text-[13px] text-gray-800 items-center justify-between">
                {{ $t(`aggregation_type.${agg}`) }}

                <GeneralIcon v-if="displayFieldComputed.field?.aggregation === agg" class="text-brand-500" icon="check" />
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>

    <template v-for="({ field, width, column, value }, index) in visibleFieldsComputed" :key="index">
      <div
        v-if="index === 0 && scrollLeft > 30"
        :style="`width: ${getAddnlMargin(depth ?? 0, true)}px;min-width: ${getAddnlMargin(
          depth ?? 0,
          true,
        )}px;max-width: ${getAddnlMargin(depth ?? 0, true)}px`"
      ></div>
      <NcDropdown
        v-if="field && column?.id"
        :disabled="[UITypes.SpecificDBType, UITypes.ForeignKey,  UITypes.Button].includes(column?.uidt!) || isLocked"
        overlay-class-name="max-h-96 relative scroll-container nc-scrollbar-md overflow-auto"
      >
        <div
          class="flex items-center overflow-hidden justify-end group hover:bg-gray-100 cursor-pointer text-gray-500 transition-all transition-linear px-3 py-2"
          :style="{
            'min-width': width,
            'max-width': width,
            'width': width,
          }"
        >
          <template v-if="![UITypes.SpecificDBType, UITypes.ForeignKey, UITypes.Button].includes(column?.uidt!)">
            <div
              v-if="field?.aggregation === 'none' || field?.aggregation === null"
              :class="{
                  'group-hover:opacity-100': ![UITypes.SpecificDBType, UITypes.ForeignKey, UITypes.Button].includes(column?.uidt!)
                }"
              class="text-gray-500 opacity-0 transition"
            >
              <GeneralIcon class="text-gray-500" icon="arrowDown" />
              <span class="text-[10px] font-semibold"> Summary </span>
            </div>

            <NcTooltip
              v-else-if="value !== undefined"
              :style="{
                maxWidth: `${field?.width}px`,
              }"
            >
              <div class="flex gap-2 truncate text-nowrap overflow-hidden items-center">
                <span class="text-gray-500 text-[12px] leading-4">
                  {{ $t(`aggregation.${field.aggregation}`).replace('Percent ', '') }}
                </span>

                <span class="text-gray-600 font-semibold text-[12px]">
                  {{ formatAggregation(field.aggregation, value, column) }}
                </span>
              </div>

              <template #title>
                <div class="flex gap-2 text-nowrap overflow-hidden items-center">
                  <span class="text-[12px] leading-4">
                    {{ $t(`aggregation.${field.aggregation}`).replace('Percent ', '') }}
                  </span>

                  <span class="font-semibold text-[12px]">
                    {{ formatAggregation(field.aggregation, value, column) }}
                  </span>
                </div>
              </template>
            </NcTooltip>
          </template>
        </div>

        <template #overlay>
          <NcMenu variant="small">
            <NcMenuItem v-for="(agg, i) in getAggregations(column)" :key="i" @click="updateAggregate(column.id, agg)">
              <div class="flex !w-full text-[13px] text-gray-800 items-center justify-between">
                {{ $t(`aggregation_type.${agg}`) }}

                <GeneralIcon v-if="field?.aggregation === agg" class="text-brand-500" icon="check" />
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </template>

    <div class="!pl-8 pr-60 !w-8 h-1">‎</div>

    <div v-if="!disablePagination" class="absolute h-9 bg-white border-l-1 border-gray-200 px-1 flex items-center right-0">
      <NcPaginationV2
        v-if="count !== Infinity"
        v-model:current="page"
        v-model:page-size="size"
        :show-size-changer="showSizeChanger"
        class="xs:(mr-2)"
        :total="+count"
        entity-name="grid"
        :prev-page-tooltip="`${renderAltOrOptlKey()}+←`"
        :next-page-tooltip="`${renderAltOrOptlKey()}+→`"
        :first-page-tooltip="`${renderAltOrOptlKey()}+↓`"
        :last-page-tooltip="`${renderAltOrOptlKey()}+↑`"
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

<style lang="scss"></style>
