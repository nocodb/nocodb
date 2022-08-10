<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'
import { useVModel } from '@vueuse/core'
import { computed, provide, toRef, watch } from 'vue'
import Comments from './Comments.vue'
import Header from './Header.vue'
import { NOCO } from '~/lib'
import { extractPkFromRow } from '~/utils'
import { useNuxtApp } from '#app'
import { useProvideSmartsheetStore } from '~/composables'
import type { Row } from '~/composables'
import { useProvideExpandedFormStore } from '~/composables/useExpandedFormStore'
import { FieldsInj, IsFormInj, MetaInj } from '~/context'

interface Props {
  modelValue: string | null
  row: Row
  state?: Record<string, any> | null
  meta: TableType
  loadRow?: boolean

  useMetaFields?: boolean
}

const props = defineProps<Props>()
const emits = defineEmits(['update:modelValue'])
const _fields = inject(FieldsInj, ref([]))
const row = toRef(props, 'row')
const state = toRef(props, 'state')
const meta = toRef(props, 'meta')

const fields = computed(() => {
  if (props.useMetaFields) {
    return meta.value.columns ?? []
  }
  return _fields.value
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

useProvideSmartsheetStore(ref({}) as any, meta)

provide(IsFormInj, true)

// accept as a prop
// const row: Row = { row: {}, rowMeta: {}, oldRow: {} }

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

const isExpanded = useVModel(props, 'modelValue', emits)
</script>

<template>
  <a-modal v-model:visible="isExpanded" :footer="null" width="min(90vw,1000px)" :body-style="{ padding: 0 }" :closable="false">
    <Header @cancel="isExpanded = false" />
    <a-card class="!bg-gray-100">
      <div class="flex h-full nc-form-wrapper items-stretch">
        <div class="flex-grow overflow-auto scrollbar-thin-primary">
          <div class="w-[500px] mx-auto">
            <div v-for="col in fields" :key="col.title" class="mt-2">
              <SmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" />
              <SmartsheetHeaderCell v-else :column="col" />

              <div class="!bg-white rounded px-1 min-h-[35px] flex align-center">
                <SmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="row.row[col.title]" :row="row" :column="col" />
                <SmartsheetCell
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
