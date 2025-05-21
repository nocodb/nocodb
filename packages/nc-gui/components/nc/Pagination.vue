<script setup lang="ts">
import NcTooltip from '~/components/nc/Tooltip.vue'

const props = withDefaults(
  defineProps<{
    current: number
    total: number
    pageSize: number
    entityName?: string
    mode?: 'simple' | 'full'
    prevPageTooltip?: string
    nextPageTooltip?: string
    firstPageTooltip?: string
    lastPageTooltip?: string
    showSizeChanger?: boolean
    useStoredPageSize?: boolean
  }>(),
  {
    useStoredPageSize: true,
  },
)

const emits = defineEmits(['update:current', 'update:pageSize'])

const { total, showSizeChanger, useStoredPageSize } = toRefs(props)

const current = useVModel(props, 'current', emits)

const pageSize = useVModel(props, 'pageSize', emits)

const { gridViewPageSize, setGridViewPageSize } = useGlobal()

const localPageSize = computed({
  get: () => {
    if (!showSizeChanger.value || (showSizeChanger.value && !useStoredPageSize.value)) return pageSize.value

    const storedPageSize = gridViewPageSize.value || 25

    if (pageSize.value !== storedPageSize) {
      pageSize.value = storedPageSize
    }

    return pageSize.value
  },
  set: (val) => {
    setGridViewPageSize(val)

    pageSize.value = val
  },
})

const entityName = computed(() => props.entityName || 'item')

const totalPages = computed(() => Math.max(Math.ceil(total.value / localPageSize.value), 1))

const { isMobileMode } = useGlobal()

const mode = computed(() => props.mode || (isMobileMode.value ? 'simple' : 'full'))

const changePage = ({ increase, set }: { increase?: boolean; set?: number }) => {
  if (set) {
    current.value = set
  } else if (increase && current.value < totalPages.value) {
    current.value = current.value + 1
  } else if (current.value > 0) {
    current.value = current.value - 1
  }
}

const goToLastPage = () => {
  current.value = totalPages.value
}

const goToFirstPage = () => {
  current.value = 1
}

const pagesList = computed(() => {
  return Array.from({ length: totalPages.value }, (_, i) => ({
    value: i + 1,
    label: i + 1,
  }))
})

const pageSizeOptions = [
  {
    value: 25,
    label: '25 / page',
  },
  {
    value: 50,
    label: '50 / page',
  },
  {
    value: 75,
    label: '75 / page',
  },
  {
    value: 100,
    label: '100 / page',
  },
]

const pageListRef = ref()
const pageSizeRef = ref()

const pageListDropdownVisibleChange = (value: boolean) => {
  if (!value && pageListRef.value) {
    pageListRef.value?.blur()
  }
}
const pageSizeDropdownVisibleChange = (value: boolean) => {
  if (!value && pageSizeRef.value) {
    pageSizeRef.value?.blur()
  }
}
</script>

<template>
  <div class="nc-pagination flex flex-row items-center gap-x-2">
    <template v-if="totalPages > 1">
      <component :is="props.firstPageTooltip && mode === 'full' ? NcTooltip : 'div'" v-if="mode === 'full'">
        <template v-if="props.firstPageTooltip" #title>
          {{ props.firstPageTooltip }}
        </template>
        <NcButton
          v-e="[`a:pagination:${entityName}:first-page`]"
          class="first-page"
          type="secondary"
          size="xsmall"
          :disabled="current === 1"
          @click="goToFirstPage"
        >
          <GeneralIcon icon="doubleLeftArrow" class="nc-pagination-icon" />
        </NcButton>
      </component>

      <component :is="props.prevPageTooltip && mode === 'full' ? NcTooltip : 'div'">
        <template v-if="props.prevPageTooltip" #title>
          {{ props.prevPageTooltip }}
        </template>
        <NcButton
          v-e="[`a:pagination:${entityName}:prev-page`]"
          class="prev-page"
          type="secondary"
          size="xsmall"
          :disabled="current === 1"
          @click="changePage({ increase: false })"
        >
          <GeneralIcon icon="arrowLeft" class="nc-pagination-icon" />
        </NcButton>
      </component>

      <div v-if="!isMobileMode" class="text-gray-500">
        <a-select
          ref="pageListRef"
          v-model:value="current"
          class="!mr-[2px]"
          :options="pagesList"
          size="small"
          dropdown-class-name="nc-pagination-dropdown"
          @dropdown-visible-change="pageListDropdownVisibleChange"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-500 nc-select-expand-btn" />
          </template>
        </a-select>
        <span class="mx-1"> {{ mode !== 'full' ? '/' : 'of' }} </span>
        <span class="total">
          {{ totalPages }}
        </span>
      </div>

      <component :is="props.nextPageTooltip && mode === 'full' ? NcTooltip : 'div'">
        <template v-if="props.nextPageTooltip" #title>
          {{ props.nextPageTooltip }}
        </template>
        <NcButton
          v-e="[`a:pagination:${entityName}:next-page`]"
          class="next-page"
          type="secondary"
          size="xsmall"
          :disabled="current === totalPages"
          @click="changePage({ increase: true })"
        >
          <GeneralIcon icon="arrowRight" class="nc-pagination-icon" />
        </NcButton>
      </component>

      <component :is="props.lastPageTooltip && mode === 'full' ? NcTooltip : 'div'" v-if="mode === 'full'">
        <template v-if="props.lastPageTooltip" #title>
          {{ props.lastPageTooltip }}
        </template>
        <NcButton
          v-e="[`a:pagination:${entityName}:last-page`]"
          class="last-page"
          type="secondary"
          size="xsmall"
          :disabled="current === totalPages"
          @click="goToLastPage"
        >
          <GeneralIcon icon="doubleRightArrow" class="nc-pagination-icon" />
        </NcButton>
      </component>
    </template>
    <div v-if="showSizeChanger && !isMobileMode" class="text-gray-500">
      <a-select
        ref="pageSizeRef"
        v-model:value="localPageSize"
        class="!min-w-[110px]"
        :options="pageSizeOptions"
        size="small"
        dropdown-class-name="nc-pagination-dropdown"
        @dropdown-visible-change="pageSizeDropdownVisibleChange"
      >
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-gray-500 nc-select-page-size-expand-btn" />
        </template>
      </a-select>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-select-selector) {
  @apply !border-gray-200 !rounded-lg !h-[25px];
}

.nc-pagination-icon {
  @apply w-4 h-4;
}

:deep(.nc-button:not(:disabled)) {
  .nc-pagination-icon {
    @apply !text-gray-500;
  }
}
</style>

<style lang="scss">
.nc-pagination-dropdown {
  @apply !rounded-lg;
}
</style>
