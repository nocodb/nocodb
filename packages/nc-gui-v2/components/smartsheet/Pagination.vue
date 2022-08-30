<script setup lang="ts">
import { computed, inject } from '#imports'
import { ChangePageInj, PaginationDataInj } from '~/context'

const paginatedData = inject(PaginationDataInj)!

const changePage = inject(ChangePageInj)!

const count = computed(() => paginatedData.value?.totalRows ?? Infinity)

const size = computed(() => paginatedData.value?.pageSize ?? 25)

const page = computed({
  get: () => {
    // if current page is undefined, then show page 1 by default
    if (!paginatedData?.value?.page) return 1
    console.log("count=" + count.value)
    console.log("size=" + size.value)
    console.log("paginatedData.value.page=" + paginatedData.value.page)
    
    // the maximum possible page given the current count and the size
    const mxPage = Math.ceil(count.value / size.value)
    // calculate targetPage where 1 <= targetPage <= mxPage 
    const targetPage = Math.max(1, Math.min(mxPage, paginatedData.value.page))
    // if the current page is greater than targetPage,
    // then the page should be changed instead of showing an empty page
    // e.g. deleting all records in the last page N should return N - 1 page
    if (paginatedData.value.page > targetPage) {
      changePage?.(targetPage)
    }
    return targetPage
  },
  set: (p) => changePage?.(p),
})
</script>

<template>
  <div class="flex items-center mb-1">
    <span v-if="count !== null && count !== Infinity" class="caption ml-5 text-gray-500">
      {{ count }} record{{ count !== 1 ? 's' : '' }}
    </span>

    <div class="flex-1" />

    count : {{ count }}
    page: {{ page }}
    size: {{ size }}

    <a-pagination
      v-if="count !== Infinity"
      v-model:current="page"
      size="small"
      class="!text-xs !m-1 nc-pagination"
      :total="count"
      :page-size="size"
      show-less-items
      :show-size-changer="false"
    />
    <div v-else class="mx-auto flex items-center mt-n1" style="max-width: 250px">
      <span class="text-xs" style="white-space: nowrap"> Change page:</span>
      <a-input :value="page" size="small" class="ml-1 !text-xs" type="number" @keydown.enter="changePage(page)">
        <template #suffix>
          <MdiKeyboardReturn class="mt-1" @click="changePage(page)" />
        </template>
      </a-input>
    </div>

    <div class="flex-1" />
  </div>
</template>

<style scoped>
:deep(.ant-pagination-item a) {
  @apply text-sm !leading-[21px] !no-underline;
}

:deep(.ant-pagination-item:not(.ant-pagination-item-active) a) {
  line-height: 21px !important;
  @apply text-sm !text-gray-500;
}

:deep(.ant-pagination-item-link) {
  @apply text-gray-500;
}
</style>
