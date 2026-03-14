<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

const column = inject(ColumnInj)!

const row = inject(RowInj)!

const meta = inject(MetaInj, ref())

const isGrid = inject(IsGridInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const { t } = useI18n()

const docFieldStore = useDocField()

const rowId = computed(() => {
  return extractPkFromRow(row.value.row, meta.value?.columns as ColumnType[])
})

const hasDoc = computed(() => !!row.value.row[column.value.title!])

const handleOpen = () => {
  if (!docFieldStore || !rowId.value || !column.value.id) return
  docFieldStore.openDoc(rowId.value, column.value.id, row.value.row)
}
</script>

<template>
  <div
    :class="{
      'justify-center': isGrid && !isExpandedForm,
    }"
    class="nc-virtual-cell-doc w-full flex items-center group"
  >
    <button
      v-if="hasDoc"
      class="nc-cell-doc-pill flex items-center gap-1 px-2 h-6 rounded-md text-nc-content-brand hover:bg-nc-bg-brand transition-colors truncate"
      :class="{ 'h-8 rounded-lg': isExpandedForm }"
      data-testid="nc-doc-cell-open"
      @click="handleOpen"
      @keydown.enter.stop="handleOpen"
      @keydown.space.prevent="handleOpen"
    >
      <GeneralIcon icon="ncFileText" class="w-4 h-4 flex-none" />
      <span class="truncate text-[13px] font-medium">{{ t('general.open') }}</span>
    </button>
    <button
      v-else
      class="nc-cell-doc-pill flex items-center gap-1 px-2 h-6 rounded-md text-nc-content-gray-subtle opacity-0 group-hover:opacity-100 hover:bg-nc-bg-brand transition-all truncate"
      :class="{ 'h-8 rounded-lg': isExpandedForm }"
      data-testid="nc-doc-cell-new"
      @click="handleOpen"
      @keydown.enter.stop="handleOpen"
      @keydown.space.prevent="handleOpen"
    >
      <GeneralIcon icon="ncPlus" class="w-4 h-4 flex-none" />
      <span class="truncate text-[13px] font-medium">{{ t('general.new') }}</span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.nc-cell-doc-pill {
  @apply cursor-pointer;
  &:focus-within {
    @apply outline-none ring-0 shadow-focus;
  }
}
</style>
