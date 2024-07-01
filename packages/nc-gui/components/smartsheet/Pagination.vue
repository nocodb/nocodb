<script setup lang="ts">
import axios from 'axios'
import type { PaginatedType } from 'nocodb-sdk'

interface Props {
  paginationData: PaginatedType
  changePage: (page: number) => void
  alignCountOnRight?: boolean
  hidePagination?: boolean
  hideSidebars?: boolean
  customLabel?: string
  fixedSize?: number
  extraStyle?: string
  showApiTiming?: boolean
  alignLeft?: boolean
  showSizeChanger?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:paginationData'])

const { locale } = useI18n()

const vPaginationData = useVModel(props, 'paginationData', emits)

const { isMobileMode } = useGlobal()

const { alignCountOnRight, customLabel, changePage } = props

const fixedSize = toRef(props, 'fixedSize')

const extraStyle = toRef(props, 'extraStyle')

const isGroupBy = inject(IsGroupByInj, ref(false))

const alignLeft = computed(() => props.alignLeft ?? false)

const { isViewDataLoading, isPaginationLoading } = storeToRefs(useViewsStore())

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

const isRTLLanguage = computed(() => isRtlLang(locale.value as keyof typeof Language))

const renderAltOrOptlKey = () => {
  return isMac() ? '⌥' : 'ALT'
}

const tempPageVal = ref(page.value)
</script>

<template>
  <div
    class="flex items-center bg-white border-gray-200 nc-grid-pagination-wrapper"
    :class="{ 'border-t-1': !isGroupBy, 'h-13': isMobileMode, 'h-10': !isMobileMode }"
    :style="`${fixedSize ? `width: ${fixedSize}px;` : ''}${
      isGroupBy ? 'margin-top:1px; border-radius: 0 0 8px 8px !important;' : ''
    } ${extraStyle}`"
  >
    <div
      class="flex items-center"
      :class="{
        'flex-1': !alignLeft,
        'left-0 sticky': alignLeft,
      }"
    >
      <slot name="add-record" />
      <span
        v-if="!alignCountOnRight && count !== null && count !== Infinity"
        class="caption ml-2.5 text-gray-500 text-xs"
        data-testid="grid-pagination"
      >
        {{ count }} {{ customLabel ? customLabel : count !== 1 ? $t('objects.records') : $t('objects.record') }}
      </span>
    </div>

    <div
      v-if="!hidePagination"
      class="transition-all ml-2 sticky left-0 duration-350"
      :class="{
        'ml-8': alignLeft,
        'left-[159px]': isGroupBy && $slots['add-record'],
        'left-[32px]': isGroupBy && !$slots['add-record'],
      }"
    >
      <div v-if="isViewDataLoading" class="nc-pagination-skeleton flex flex-row justify-center item-center min-h-10 min-w-42">
        <a-skeleton :active="true" :title="true" :paragraph="false" class="-mt-1 max-w-60" />
      </div>
      <NcPagination
        v-else-if="count !== Infinity"
        v-model:current="page"
        v-model:page-size="size"
        class="xs:(mr-2)"
        :class="{ 'rtl-pagination': isRTLLanguage }"
        :total="+count"
        entity-name="grid"
        :prev-page-tooltip="`${renderAltOrOptlKey()}+←`"
        :next-page-tooltip="`${renderAltOrOptlKey()}+→`"
        :first-page-tooltip="`${renderAltOrOptlKey()}+↓`"
        :last-page-tooltip="`${renderAltOrOptlKey()}+↑`"
        :show-size-changer="showSizeChanger"
      />
      <div v-else class="mx-auto flex items-center mt-n1" style="max-width: 250px">
        <span class="text-xs" style="white-space: nowrap"> Change page:</span>
        <a-input
          v-model:value="tempPageVal"
          size="small"
          class="ml-1 !text-xs"
          type="number"
          @keydown.enter="changePage(tempPageVal)"
          @blur="tempPageVal = page"
        >
          <template #suffix>
            <component :is="iconMap.returnKey" class="mt-1" @click="changePage(page)" />
          </template>
        </a-input>
      </div>
    </div>
    <div v-if="!isMobileMode" class="flex-1 flex justify-end items-center">
      <GeneralApiTiming v-if="isEeUI && props.showApiTiming" class="m-1" />
      <div class="text-right">
        <span
          v-if="alignCountOnRight && count !== Infinity"
          class="caption nc-grid-row-count mr-2.5 text-gray-500 text-xs"
          data-testid="grid-pagination"
        >
          {{ count }} {{ customLabel ? customLabel : count !== 1 ? $t('objects.records') : $t('objects.record') }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.nc-grid-pagination-wrapper {
  .ant-pagination-item-active {
    a {
      @apply text-sm !text-gray-700 !hover:text-gray-800;
    }
  }
}
</style>

<style scoped>
:deep(.ant-pagination-item a) {
  @apply text-sm !leading-[21px] !no-underline;
}

:deep(.nc-pagination .ant-pagination-item) {
  @apply !border-0 !pt-0.25;
}

:deep(.ant-pagination-item:not(.ant-pagination-item-active) a) {
  line-height: 21px !important;
  @apply text-sm !text-gray-400;
}

:deep(.ant-pagination-item-link) {
  @apply text-gray-800 flex items-center justify-center;
}

:deep(.ant-pagination-item.ant-pagination-item-active) {
  @apply !bg-transparent;
}

:deep(.rtl-pagination .ant-pagination-prev .ant-pagination-item-link),
:deep(.rtl-pagination .ant-pagination-next .ant-pagination-item-link) {
  @apply transform rotate-180;
}
</style>
