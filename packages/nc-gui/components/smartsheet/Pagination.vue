<script setup lang="ts">
import { ChangePageInj, PaginationDataInj, computed, inject } from '#imports'

const { showSizeChanger } = defineProps<{ showSizeChanger?: boolean }>()

const paginatedData = inject(PaginationDataInj)!

const changePage = inject(ChangePageInj)!

const { appInfo } = $(useGlobal())

const pageSizeOptions = computed(() =>
  [
    '5',
    '10',
    '25',
    '50',
    '100',
    '200',
    '500',
    '1000',
    '2000',
    '5000',
    ...(appInfo.maxLimit > 5000 ? [appInfo.maxLimit] : []),
  ].filter((v) => +v >= appInfo.minLimit && +v <= appInfo.maxLimit),
)

const count = computed(() => paginatedData.value?.totalRows ?? Infinity)

const page = computed({
  get: () => paginatedData?.value?.page ?? 1,
  set: (p) => {
    changePage?.(p)
  },
})

const size = computed({
  get: () => paginatedData?.value?.pageSize ?? 25,
  set: (size: number) => {
    if (paginatedData.value) {
      paginatedData.value.pageSize = size
      changePage?.(page.value)
    }
  },
})
</script>

<template>
  <div class="flex items-center mb-1">
    <span v-if="count !== null && count !== Infinity" class="caption ml-5 text-gray-500" data-testid="grid-pagination">
      {{ count }} {{ count !== 1 ? $t('objects.records') : $t('objects.record') }}
    </span>

    <div class="flex-1" />
    <a-pagination
      v-if="count !== Infinity"
      v-model:current="page"
      v-model:page-size="size"
      size="small"
      class="!text-xs !m-1 nc-pagination"
      :total="count"
      show-less-items
      :page-size-options="pageSizeOptions"
      :show-size-changer="showSizeChanger"
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
  @apply text-gray-500 flex items-center justify-center;
}
</style>
