<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ChangePageInj, PaginationDataInj, computed, inject } from '#imports'

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

useEventListener('keydown', (e: KeyboardEvent) => {
  if (!e.altKey) return

  if (e.key === 'ArrowRight') {
    changePage?.(page.value + 1)
  } else if (e.key === 'ArrowLeft') {
    changePage?.(page.value - 1)
  } else if (e.key === 'ArrowUp') {
    changePage?.(1)
  } else if (e.key === 'ArrowDown') {
    changePage?.(Math.ceil(count.value / size.value))
  }
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
  @apply text-gray-500 flex items-center justify-center;
}
</style>
