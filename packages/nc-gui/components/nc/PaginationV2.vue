<script setup lang="ts">
import { UseVirtualList } from '@vueuse/components'
import type { NcButtonProps } from './Button.vue'
import NcTooltip from '~/components/nc/Tooltip.vue'

const props = withDefaults(
  defineProps<{
    current: number
    total: number
    pageSize: number
    entityName?: string
    mode?: 'simple' | 'full'
    variant?: 'default' | 'v2'
    prevPageTooltip?: string
    nextPageTooltip?: string
    firstPageTooltip?: string
    lastPageTooltip?: string
    showSizeChanger?: boolean
  }>(),
  {
    variant: 'default',
  },
)

const emits = defineEmits(['update:current', 'update:pageSize'])

const { total, showSizeChanger } = toRefs(props)

const current = useVModel(props, 'current', emits)

const pageSize = useVModel(props, 'pageSize', emits)

const { gridViewPageSize, setGridViewPageSize } = useGlobal()

const localPageSize = computed({
  get: () => {
    if (!showSizeChanger.value) return pageSize.value

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

const btnSize = computed<NcButtonProps['size']>(() => (props.variant === 'default' ? 'xsmall' : 'xs'))

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
</script>

<template>
  <div class="nc-pagination flex flex-row items-center gap-x-0.25" :class="`nc-variant-${variant}`">
    <div class="nc-pagition-btns-wrapper">
      <component :is="props.firstPageTooltip && mode === 'full' ? NcTooltip : 'div'" v-if="mode === 'full'">
        <template v-if="props.firstPageTooltip" #title>
          {{ props.firstPageTooltip }}
        </template>
        <NcButton
          v-e="[`a:pagination:${entityName}:first-page`]"
          class="first-page !border-0"
          type="text"
          :size="btnSize"
          :disabled="current === 1"
          @click="goToFirstPage"
        >
          <GeneralIcon icon="doubleLeftArrow" class="nc-pagination-icon" />
        </NcButton>
      </component>
      <div v-if="variant === 'v2'" class="nc-pagition-v2-border"></div>

      <component :is="props.prevPageTooltip && mode === 'full' ? NcTooltip : 'div'">
        <template v-if="props.prevPageTooltip" #title>
          {{ props.prevPageTooltip }}
        </template>
        <NcButton
          v-e="[`a:pagination:${entityName}:prev-page`]"
          class="prev-page"
          type="text"
          :size="btnSize"
          :disabled="current === 1"
          @click="changePage({ increase: false })"
        >
          <GeneralIcon icon="arrowLeft" class="nc-pagination-icon" />
        </NcButton>
      </component>
    </div>

    <div v-if="!isMobileMode" class="nc-pagination-selector-wrapper text-gray-500">
      <NcDropdown placement="top" overlay-class-name="!shadow-none">
        <div class="flex items-center gap-2">
          <NcButton class="nc-select-page" :type="variant === 'default' ? 'text' : 'secondary'" :size="btnSize">
            <div
              class="flex items-center"
              :class="{
                'gap-1 px-2': variant === 'default',
                'gap-2': variant !== 'default',
              }"
            >
              <span class="nc-current-page">
                {{ current }}
              </span>
              <GeneralIcon icon="arrowDown" class="text-gray-800 mt-0.5 nc-select-expand-btn" />
            </div>
          </NcButton>
          <div v-if="variant === 'v2'" class="text-small1 font-500 text-nc-content-gray-subtle">/{{ pagesList.length }}</div>
        </div>

        <template #overlay>
          <NcMenu class="nc-pagination-menu overflow-hidden" variant="small">
            <NcSubMenu
              v-if="showSizeChanger"
              :key="`${localPageSize}page`"
              class="bg-gray-100 z-20 top-0 !sticky"
              variant="small"
            >
              <template #title>
                <div class="rounded-lg text-[13px] font-medium w-full">{{ localPageSize }} / page</div>
              </template>

              <NcMenuItem v-for="option in pageSizeOptions" :key="option.value" @click="localPageSize = option.value">
                <span
                  class="text-[13px]"
                  :class="{
                    '!text-brand-500': option.value === localPageSize,
                  }"
                >
                  {{ option.value }} / page
                </span>
              </NcMenuItem>
            </NcSubMenu>

            <UseVirtualList
              :key="localPageSize"
              :list="pagesList"
              height="auto"
              :options="{ itemHeight: 28 }"
              class="mt-1 max-h-46 nc-scrollbar-thin"
            >
              <template #default="{ data: item }">
                <NcMenuItem
                  :key="`${localPageSize}${item.value}`"
                  :style="{
                    height: '28px',
                  }"
                  @click.stop="
                    changePage({
                      set: item.value,
                    })
                  "
                >
                  <div
                    :class="{
                      'text-brand-500': item.value === current,
                    }"
                    class="flex text-[13px] !w-full text-gray-800 items-center justify-between"
                  >
                    {{ item.label }}
                  </div>
                </NcMenuItem>
              </template>
            </UseVirtualList>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>

    <div class="nc-pagition-btns-wrapper">
      <component :is="props.nextPageTooltip && mode === 'full' ? NcTooltip : 'div'">
        <template v-if="props.nextPageTooltip" #title>
          {{ props.nextPageTooltip }}
        </template>
        <NcButton
          v-e="[`a:pagination:${entityName}:next-page`]"
          class="next-page"
          type="text"
          :size="btnSize"
          :disabled="current === totalPages"
          @click="changePage({ increase: true })"
        >
          <GeneralIcon icon="arrowRight" class="nc-pagination-icon" />
        </NcButton>
      </component>
      <div v-if="variant === 'v2'" class="nc-pagition-v2-border"></div>

      <component :is="props.lastPageTooltip && mode === 'full' ? NcTooltip : 'div'" v-if="mode === 'full'">
        <template v-if="props.lastPageTooltip" #title>
          {{ props.lastPageTooltip }}
        </template>
        <NcButton
          v-e="[`a:pagination:${entityName}:last-page`]"
          class="last-page"
          type="text"
          :size="btnSize"
          :disabled="current === totalPages"
          @click="goToLastPage"
        >
          <GeneralIcon icon="doubleRightArrow" class="nc-pagination-icon" />
        </NcButton>
      </component>
    </div>

    <div v-if="showSizeChanger && !isMobileMode" class="text-gray-500"></div>
  </div>
</template>

<style lang="scss" scoped>
.nc-pagination-icon {
  @apply w-4 h-4;
}

:deep(.ant-dropdown-menu-title-content) {
  @apply justify-center;
}

:deep(.nc-button:not(:disabled)) {
  .nc-pagination-icon {
    @apply !text-gray-500;
  }
}

.nc-pagition-btns-wrapper {
  @apply flex items-center gap-x-0.25;
}

.nc-pagination {
  &.nc-variant-v2 {
    @apply w-full max-w-[308px] justify-between gap-2;

    .nc-pagition-btns-wrapper {
      @apply border-1 border-nc-border-gray-medium rounded-lg gap-x-0 items-stretch;

      .nc-pagition-v2-border {
        @apply self-stretch border-r-1 border-nc-border-gray-medium;
      }

      .first-page,
      .next-page {
        @apply rounded-r-none px-2;
      }

      .prev-page,
      .last-page {
        @apply rounded-l-none px-2;
      }
    }

    .nc-pagination-selector-wrapper {
      @apply flex-1 flex justify-center items-center children:flex-none;
    }
  }
}
</style>

<style lang="scss"></style>
