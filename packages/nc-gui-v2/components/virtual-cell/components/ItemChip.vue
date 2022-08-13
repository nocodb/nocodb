<script setup lang="ts">
import { useLTARStoreOrThrow } from '#imports'
import { ActiveCellInj, IsFormInj, ReadonlyInj } from '~/context'

interface Props {
  value?: string | number | boolean
  item?: any
}

const { value, item } = defineProps<Props>()

const emit = defineEmits(['unlink'])

const { relatedTableMeta } = useLTARStoreOrThrow()

const editEnabled = inject(ReadonlyInj)

const active = inject(ActiveCellInj, ref(false))

const isForm = inject(IsFormInj)

const expandedFormDlg = ref(false)
</script>

<template>
  <div
    class="group py-1 px-2 flex align-center gap-1 bg-gray-200/50 hover:bg-gray-200 rounded-[20px]"
    :class="{ active }"
    @click="expandedFormDlg = true"
  >
    <span class="name">{{ value }}</span>
    <div v-show="active || isForm" v-if="editEnabled" class="flex align-center">
      <MdiCloseThick class="unlink-icon text-xs text-gray-500/50 group-hover:text-gray-500" @click.stop="emit('unlink')" />
    </div>

    <SmartsheetExpandedForm
      v-if="expandedFormDlg && editEnabled"
      v-model="expandedFormDlg"
      :row="{ row: item }"
      :meta="relatedTableMeta"
      load-row
      use-meta-fields
    />
  </div>
</template>

<style scoped lang="scss">
.chip {
  max-width: max(100%, 60px);

  .name {
    text-overflow: ellipsis;
    overflow: hidden;
  }
}
</style>
