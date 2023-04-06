<script setup lang="ts">
import { ChangePageInj, PaginationDataInj, computed, iconMap, inject } from '#imports'

const paginatedData = inject(PaginationDataInj)!

const changePage = inject(ChangePageInj)!

const count = computed(() => paginatedData.value?.totalRows ?? Infinity)

const currentLimit = $computed(() => paginatedData.value?.pageSize ?? 25)

const currentPage = $computed(() => paginatedData?.value?.page ?? 1)

function loadData(page = currentPage, limit = currentLimit) {
  paginatedData.value.pageSize = limit
  paginatedData.value.page = page
  changePage?.(page)
}
</script>

<template>
  <div class="flex items-center mb-1">
    <span v-if="count !== null && count !== Infinity" class="caption ml-5 text-gray-500" data-testid="grid-pagination">
      {{ count }} {{ count !== 1 ? $t('objects.records') : $t('objects.record') }}
    </span>

    <div class="flex-1" />

    <a-pagination
      v-if="count !== Infinity"
      v-model:current="currentPage"
      v-model:page-size="currentLimit"
      size="small"
      class="!text-xs !m-1 nc-pagination"
      :total="count"
      show-size-changer
      @change="loadData"
    />
    <div v-else class="mx-auto flex items-center mt-n1" style="max-width: 250px">
      <span class="text-xs" style="white-space: nowrap"> Change page:</span>
      <a-input :value="currentPage" size="small" class="ml-1 !text-xs" type="number" @keydown.enter="changePage(currentPage)">
        <template #suffix>
          <component :is="iconMap.returnKey" class="mt-1" @click="changePage(currentPage)" />
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
  @apply text-gray-500 flex items-center justify-center;
}
</style>
