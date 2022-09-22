<script lang="ts" setup>
import { ActiveCellInj, IsFormInj, IsLockedInj, ReadonlyInj, inject, ref, useLTARStoreOrThrow, useUIPermission } from '#imports'

interface Props {
  value?: string | number | boolean
  item?: any
}

const { value, item } = defineProps<Props>()

const emit = defineEmits(['unlink'])

const { relatedTableMeta } = useLTARStoreOrThrow()!

const { isUIAllowed } = useUIPermission()

const readOnly = inject(ReadonlyInj, false)

const active = inject(ActiveCellInj, ref(false))

const isForm = inject(IsFormInj)!

const isLocked = inject(IsLockedInj, ref(false))

const expandedFormDlg = ref(false)
</script>

<script lang="ts">
export default {
  name: 'ItemChip',
}
</script>

<template>
  <div
    class="chip group py-1 px-2 mr-1 my-1 flex items-center bg-blue-100/60 hover:bg-blue-100/40 rounded-[2px]"
    :class="{ active }"
    @click="expandedFormDlg = true"
  >
    <span class="name">{{ value }}</span>

    <div v-show="active || isForm" v-if="!readOnly && !isLocked && isUIAllowed('xcDatatableEditable')" class="flex items-center">
      <MdiCloseThick class="unlink-icon text-xs text-gray-500/50 group-hover:text-gray-500" @click.stop="emit('unlink')" />
    </div>

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="!readOnly && !isLocked && expandedFormDlg"
        v-model="expandedFormDlg"
        :row="{ row: item, rowMeta: {}, oldRow: { ...item } }"
        :meta="relatedTableMeta"
        load-row
        use-meta-fields
      />
    </Suspense>
  </div>
</template>

<style scoped lang="scss">
.chip {
  max-width: max(100%, 60px);

  .name {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }
}
</style>
