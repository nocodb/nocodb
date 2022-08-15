<script setup lang="ts">
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'
import type { Ref } from 'vue'
import Cell from '../Cell.vue'
import VirtualCell from '../VirtualCell.vue'
import Comments from './Comments.vue'
import Header from './Header.vue'
import {
  FieldsInj,
  IsFormInj,
  MetaInj,
  NOCO,
  computedInject,
  extractPkFromRow,
  provide,
  ref,
  toRef,
  useNuxtApp,
  useProject,
  useProvideExpandedFormStore,
  useProvideSmartsheetStore,
  useVModel,
  watch,
} from '#imports'
import type { Row } from '~/composables'

interface Props {
  modelValue?: boolean
  row: Row
  state?: Record<string, any> | null
  meta: TableType
  loadRow?: boolean
  useMetaFields?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const row = toRef(props, 'row')

const state = toRef(props, 'state')

const meta = toRef(props, 'meta')

const fields = computedInject(FieldsInj, (_fields) => {
  if (props.useMetaFields) {
    return meta.value.columns ?? []
  }
  return _fields?.value ?? []
})

provide(MetaInj, meta)

const { commentsDrawer, changedColumns, state: rowState } = useProvideExpandedFormStore(meta, row)

const { $api } = useNuxtApp()

if (props.loadRow) {
  const { project } = useProject()

  row.value.row = await $api.dbTableRow.read(
    NOCO,
    project.value.id as string,
    meta.value.title,
    extractPkFromRow(row.value.row, meta.value.columns as ColumnType[]),
  )

  row.value.oldRow = { ...row.value.row }

  row.value.rowMeta = {}
}

useProvideSmartsheetStore(ref({}) as Ref<ViewType>, meta)

provide(IsFormInj, ref(true))

watch(
  state,
  () => {
    if (state.value) {
      rowState.value = state.value
    } else {
      rowState.value = {}
    }
  },
  { immediate: true },
)

const isExpanded = useVModel(props, 'modelValue', emits, {
  defaultValue: false,
})
</script>

<script lang="ts">
export default {
  name: 'ExpandedForm',
}
</script>

<template>
  <a-modal v-model:visible="isExpanded" :footer="null" width="min(90vw,1000px)" :body-style="{ padding: 0 }" :closable="false">
    <Header @cancel="isExpanded = false" />
    <a-card class="!bg-gray-100">
      <div class="flex h-full nc-form-wrapper items-stretch min-h-[70vh]">
        <div class="flex-grow overflow-auto scrollbar-thin-primary">
          <div class="w-[500px] mx-auto">
            <div v-for="col of fields" :key="col.title" class="mt-2 py-2" :class="`nc-expand-col-${col.title}`">
              <SmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" />
              <SmartsheetHeaderCell v-else :column="col" />

              <div class="!bg-white rounded px-1 min-h-[35px] flex align-center mt-2">
                <VirtualCell v-if="isVirtualCol(col)" v-model="row.row[col.title]" :row="row" :column="col" />

                <Cell
                  v-else
                  v-model="row.row[col.title]"
                  :column="col"
                  :edit-enabled="true"
                  @update:model-value="changedColumns.add(col.title)"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="nc-comments-drawer min-w-0 min-h-full max-h-full" :class="{ active: commentsDrawer }">
          <div class="h-full">
            <Comments v-if="commentsDrawer" />
          </div>
        </div>
      </div>
    </a-card>
  </a-modal>
</template>

<style scoped lang="scss">
:deep(input, select, textarea) {
  @apply !bg-white;
}

:deep(.ant-modal-body) {
  @apply !bg-gray-100;
}

.nc-comments-drawer {
  @apply w-0 transition-width ease-in-out duration-200;
  overflow: hidden;

  &.active {
    @apply w-[250px] border-left-1;
  }
}

.nc-form-wrapper {
  max-height: max(calc(90vh - 100px), 600px);
  height: max-content !important;
}
</style>
