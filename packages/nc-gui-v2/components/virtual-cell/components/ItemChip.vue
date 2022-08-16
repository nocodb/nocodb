<script lang="ts" setup>
import { ActiveCellInj, EditModeInj, IsFormInj, defineAsyncComponent, inject, ref, useLTARStoreOrThrow } from '#imports'

interface Props {
  value?: string | number | boolean
  item?: any
}

const { value, item } = defineProps<Props>()

const emit = defineEmits(['unlink'])

const ExpandedForm: any = defineAsyncComponent(() => import('../../smartsheet/expanded-form/index.vue'))

const { relatedTableMeta } = useLTARStoreOrThrow()!

const editEnabled = inject(EditModeInj)!

const active = inject(ActiveCellInj, ref(false))

const isForm = inject(IsFormInj)!

const expandedFormDlg = ref(false)
</script>

<script lang="ts">
export default {
  name: 'ItemChip',
}
</script>

<template>
  <div
    class="group py-1 px-2 mr-1 my-1 flex align-center bg-blue-100/60 hover:bg-blue-100/40 rounded-[2px]"
    :class="{ active }"
    @click="expandedFormDlg = true"
  >
    <span class="name">{{ value }}</span>

    <div v-show="active || isForm" v-if="editEnabled" class="flex align-center">
      <MdiCloseThick class="unlink-icon text-xs text-gray-500/50 group-hover:text-gray-500" @click.stop="emit('unlink')" />
    </div>

    <Suspense>
      <ExpandedForm
        v-if="editEnabled"
        v-model="expandedFormDlg"
        :row="{ row: item }"
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
  }
}
</style>
