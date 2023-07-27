<script setup lang="ts">
import { ChangePageInj, PaginationDataInj, computed, iconMap, inject } from '#imports'
import SidebarIcon from '~icons/nc-icons/sidebar'

const props = defineProps<{
  alignCountOnRight?: boolean
}>()

const { alignCountOnRight } = props

const isPublic = inject(IsPublicInj, ref(false))

const { isLeftSidebarOpen, isRightSidebarOpen } = storeToRefs(useSidebarStore())

const paginatedData = inject(PaginationDataInj)!

const changePage = inject(ChangePageInj)!

const count = computed(() => paginatedData.value?.totalRows ?? Infinity)

const size = computed(() => paginatedData.value?.pageSize ?? 25)

const page = computed({
  get: () => paginatedData?.value?.page ?? 1,
  set: (p) => {
    changePage?.(p)
  },
})
</script>

<template>
  <div class="flex items-center border-t-1 border-gray-75 h-10 nc-pagination-wrapper">
    <NcTooltip v-if="!isPublic" class="ml-2" placement="topLeft" hide-on-click>
      <template #title>
        {{ isLeftSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar' }}
      </template>
      <div
        class="nc-sidebar-left-toggle-icon hover:after:(bg-primary bg-opacity-75) hover:(bg-gray-50 border-gray-200) border-gray-100 group flex items-center justify-center rounded-md h-full px-2 h-7 cursor-pointer text-gray-400 hover:text-gray-700"
        :class="{
          'bg-gray-50': !isLeftSidebarOpen,
        }"
        @click="isLeftSidebarOpen = !isLeftSidebarOpen"
      >
        <SidebarIcon class="cursor-pointer transform transition-transform duration-500 rounded-md rotate-180" />
      </div>
    </NcTooltip>
    <slot name="add-record" />
    <div class="flex-1">
      <span
        v-if="!alignCountOnRight && count !== null && count !== Infinity"
        class="caption ml-2.5 text-gray-500 text-xs"
        data-testid="grid-pagination"
      >
        {{ count }} {{ count !== 1 ? $t('objects.records') : $t('objects.record') }}
      </span>
    </div>

    <a-pagination
      v-if="count !== Infinity"
      v-model:current="page"
      v-model:page-size="size"
      size="small"
      class="!text-xs !m-1 nc-pagination"
      :total="count"
      show-less-items
      :show-size-changer="false"
    />
    <div v-else class="mx-auto flex items-center mt-n1" style="max-width: 250px">
      <span class="text-xs" style="white-space: nowrap"> Change page:</span>
      <a-input :value="page" size="small" class="ml-1 !text-xs" type="number" @keydown.enter="changePage(page)">
        <template #suffix>
          <component :is="iconMap.returnKey" class="mt-1" @click="changePage(page)" />
        </template>
      </a-input>
    </div>

    <div class="flex-1 text-right pr-2">
      <span
        v-if="alignCountOnRight && count !== null && count !== Infinity"
        class="caption mr-2.5 text-gray-500 text-xs"
        data-testid="grid-pagination"
      >
        {{ count }} {{ count !== 1 ? $t('objects.records') : $t('objects.record') }}
      </span>
    </div>

    <NcTooltip v-if="!isPublic" placement="topRight" hide-on-click>
      <template #title>
        {{ isRightSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar' }}
      </template>

      <div
        class="flex flex-row items-center justify-center !rounded-md !p-1.75 border-gray-100 cursor-pointer bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-700 nc-sidebar-right-toggle-icon"
        :class="{
          'bg-gray-75': !isRightSidebarOpen,
        }"
        type="ghost"
        @click="isRightSidebarOpen = !isRightSidebarOpen"
      >
        <SidebarIcon class="w-4 h-4" />
      </div>
    </NcTooltip>
    <div class="w-2"></div>
  </div>
</template>

<style lang="scss">
.nc-pagination-wrapper {
  .ant-pagination-item-active {
    a {
      @apply text-sm !text-gray-500 !hover:text-gray-700;
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
  @apply text-sm !text-gray-500;
}

:deep(.ant-pagination-item-link) {
  @apply text-gray-500 flex items-center justify-center;
}
</style>
