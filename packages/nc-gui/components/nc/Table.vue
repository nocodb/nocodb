<script lang="ts" setup>
import type { CSSProperties } from '@vue/runtime-dom'

type OrderBy = 'asc' | 'desc' | undefined

interface Props {
  columns: NcTableColumnProps[]
  data: Record<string, any>[]
  headerRowHeight?: CSSProperties['height']
  rowHeight?: CSSProperties['height']
  orderBy?: Record<string, OrderBy>
  multiFieldOrderBy?: boolean
  bordered?: boolean
  isDataLoading?: boolean
  stickyHeader?: boolean
  stickyFirstColumn?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  columns: () => [] as NcTableColumnProps[],
  data: () => [] as Record<string, any>[],
  headerRowHeight: '54px',
  rowHeight: '54px',
  orderBy: () => ({} as Record<string, OrderBy>),
  multiFieldOrderBy: false,
  bordered: true,
  isDataLoading: false,
  stickyHeader: true,
})

const emit = defineEmits(['update:orderBy'])

const tableWrapper = ref<HTMLDivElement>()

const tableHeader = ref<HTMLTableElement>()

const { height: tableHeadHeight, width: tableHeadWidth } = useElementBounding(tableHeader)

const orderBy = useVModel(props, 'orderBy', emit)

const { columns, data, isDataLoading } = toRefs(props)

const slots = useSlots()

const headerCellWidth = ref<(number | undefined)[]>([])

const updateOrderBy = (field: string) => {
  if (!data.value.length || !field) return

  const orderCycle = { undefined: 'asc', asc: 'desc', desc: undefined }

  if (props.multiFieldOrderBy) {
    orderBy.value[field] = orderCycle[`${orderBy.value[field]}`] as OrderBy
  } else {
    orderBy.value = { [field]: orderCycle[`${orderBy.value[field]}`] as OrderBy }
  }
}

/**
 * We are using 2 different table tag to make header sticky,
 * so it's imp to keep header cell and body cell width same
 */
watch(
  tableHeadWidth,
  () => {
    if (!tableHeader.value || !tableHeadWidth.value) return

    nextTick(() => {
      const headerCells = tableHeader.value?.querySelectorAll('th > div')

      if (headerCells && headerCells.length) {
        headerCells.forEach((el, i) => {
          headerCellWidth.value[i] = el.getBoundingClientRect().width || undefined
        })
      }
    })
  },
  {
    immediate: true,
  },
)

useEventListener(tableWrapper, 'scroll', () => {
  const stickyHeaderCell = tableWrapper.value?.querySelector('th:nth-of-type(1)')
  const nonStickyHeaderFirstCell = tableWrapper.value?.querySelector('th:nth-of-type(2)')

  if (
    !stickyHeaderCell ||
    !nonStickyHeaderFirstCell ||
    !stickyHeaderCell?.getBoundingClientRect()?.right ||
    !nonStickyHeaderFirstCell?.getBoundingClientRect()?.left
  ) {
    return
  }

  if (nonStickyHeaderFirstCell?.getBoundingClientRect().left < stickyHeaderCell?.getBoundingClientRect().right) {
    tableWrapper.value?.classList.add('sticky-border')
  } else {
    tableWrapper.value?.classList.remove('sticky-border')
  }
})
</script>

<template>
  <div
    class="nc-table-container relative flex-1"
    :class="{
      bordered: bordered,
    }"
  >
    <div
      ref="tableWrapper"
      class="nc-table-wrapper max-h-full relative nc-scrollbar-thin !overflow-auto"
      :class="{
        'sticky-first-column': stickyFirstColumn,
        'h-full': data.length,
      }"
    >
      <table
        ref="tableHeader"
        class="w-full max-w-full"
        :class="{
          '!sticky top-0 z-5': stickyHeader,
        }"
      >
        <thead>
          <tr
            :style="{
              height: headerRowHeight,
            }"
          >
            <th
              v-for="(col, index) in columns"
              :key="index"
              class="nc-table-header-cell"
              :class="[
                `nc-table-header-cell-${index}`,
                {
                  '!hover:bg-gray-100 select-none cursor-pointer': col.showOrderBy,
                  'cursor-not-allowed': col.showOrderBy && !data?.length,
                  '!text-gray-700': col.showOrderBy && col.key === 'name' && col?.dataIndex && orderBy[col.dataIndex],
                  'flex-1': !col.width && !col.basis,
                },
              ]"
              :style="{
                width: col.width,
                flexBasis: !col.width ? col.basis : undefined,
                maxWidth: col.basis ? col.basis : col.width,
              }"
              @click="col.showOrderBy && col.key === 'name' && col?.dataIndex ? updateOrderBy(col.dataIndex) : undefined"
            >
              <div
                class="gap-3"
                :style="{
                  padding: col.padding || '0px 24px',
                  minWidth: `calc(${col.minWidth}px - 2px)`,
                }"
              >
                <template v-if="slots.headerCell">
                  <slot name="headerCell" :column="col"> </slot>
                </template>
                <template v-else>
                  <div>{{ col.title }}</div>
                </template>

                <template v-if="col.key === 'name' && col.showOrderBy">
                  <GeneralIcon
                    v-if="orderBy[col.dataIndex]"
                    icon="chevronDown"
                    class="flex-none"
                    :class="{
                      'transform rotate-180': orderBy[col.dataIndex] === 'asc',
                    }"
                  />
                  <GeneralIcon v-else icon="chevronUpDown" class="flex-none" />
                </template>
              </div>
            </th>
          </tr>
        </thead>
      </table>

      <template v-if="data.length">
        <table
          class="w-full h-full"
          :style="{
            maxHeight: `calc(100% - ${headerRowHeight})`,
          }"
        >
          <tbody>
            <tr
              v-for="(record, recordIndex) of data"
              :key="recordIndex"
              :style="{
                height: rowHeight,
              }"
              :class="[`nc-table-row-${recordIndex}`]"
            >
              <td
                v-for="(col, colIndex) of columns"
                :key="colIndex"
                class="nc-table-cell"
                :class="[
                  `nc-table-cell-${recordIndex}`,
                  {
                    'flex-1': !col.width && !col.basis,
                  },
                ]"
                :style="{
                  width: col.width,
                  flexBasis: !col.width ? col.basis : undefined,
                  maxWidth: col.basis ? col.basis : col.width,
                }"
              >
                <div
                  :class="[`${col.align || 'items-center'} ${col.justify || ''}`]"
                  :style="{
                    padding: col.padding || '0px 24px',
                    minWidth: `calc(${col.minWidth}px - 2px)`,
                    maxWidth: headerCellWidth[colIndex] ? `${headerCellWidth[colIndex]}px` : undefined,
                  }"
                >
                  <template v-if="slots.bodyCell || col.key === 'action'">
                    <slot name="bodyCell" :column="col" :record="record" :record-index="recordIndex"> </slot>
                  </template>

                  <template v-else>
                    {{ col?.dataIndex ? record[col.dataIndex] : '' }}
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>
    <div
      v-show="isDataLoading"
      class="flex items-center justify-center absolute left-0 top-0 w-full h-full z-10 pb-10 pointer-events-none"
    >
      <div class="flex flex-col justify-center items-center gap-2">
        <GeneralLoader size="xlarge" />
        <span class="text-center">{{ $t('general.loading') }}</span>
      </div>
    </div>
    <div
      v-if="!isDataLoading && !data?.length"
      class="flex-none nc-table-empty flex items-center justify-center py-8 px-6 h-full"
      :style="{
        maxHeight: `calc(100% - ${tableHeadHeight}px)`,
      }"
    >
      <div class="flex-none text-center flex flex-col items-center gap-3">
        <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
      </div>
    </div>
    <!-- Not scrollable footer  -->
    <template v-if="slots.tableFooter">
      <slots name="table-footer"></slots>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-table-container {
  &.bordered {
    @apply border-1 border-gray-200 rounded-lg overflow-hidden w-full;
  }

  &:not(.bordered) {
    @apply overflow-hidden w-full;
  }

  .nc-table-wrapper {
    @apply w-full;

    &.sticky-first-column {
      th {
        &:first-of-type {
          @apply bg-gray-50;
        }
      }
      td {
        &:first-of-type {
          @apply bg-white;
        }
      }

      th,
      td {
        &:first-of-type {
          @apply border-r-1 border-transparent sticky left-0 z-4;
        }
      }

      &.sticky-border {
        th,
        td {
          &:first-of-type {
            @apply !border-gray-200;
          }
        }
      }
    }

    thead {
      @apply w-full max-w-full;
      th {
        @apply bg-gray-50 text-sm text-gray-500 font-weight-500;
        &.cell-title {
          @apply sticky left-0 z-4 bg-gray-50;
        }
      }
    }
    tbody {
      @apply w-full max-w-full;

      tr {
        @apply cursor-pointer;
        td {
          @apply text-sm text-gray-600;
        }
      }
    }
    tr {
      @apply flex border-b-1 border-gray-200 w-full max-w-full;

      &:hover td {
        @apply !bg-gray-50;
      }

      th,
      td {
        @apply h-full flex;

        & > div {
          @apply h-full flex-1 flex items-center;
        }
      }
    }
  }
}
.cell-header {
  @apply text-xs font-semibold text-gray-500;
}
</style>
