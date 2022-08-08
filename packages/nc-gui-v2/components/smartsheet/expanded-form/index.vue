<script setup lang="ts">
import { isVirtualCol } from 'nocodb-sdk'
import { useVModel } from '@vueuse/core'
import { Ref, computed, provide, toRef } from 'vue'
import Comments from './Comments.vue'
import Header from './Header.vue'
import { useSmartsheetStoreOrThrow } from '~/composables'
import type { Row } from '~/composables'
import { useProvideExpandedFormStore } from '~/composables/useExpandedFormStore'
import { FieldsInj, IsFormInj, MetaInj } from '~/context'

interface Props {
  modelValue: string | null
  row: Row
}

const props = defineProps<Props>()
const emits = defineEmits(['update:modelValue'])
const fields = inject(FieldsInj, ref([]))
const row = toRef(props, 'row')

const { meta } = useSmartsheetStoreOrThrow()

provide(IsFormInj, true)

// accept as a prop
// const row: Row = { row: {}, rowMeta: {}, oldRow: {} }

const { commentsDrawer, changedColumns } = useProvideExpandedFormStore(meta, row)

const isExpanded = useVModel(props, 'modelValue', emits)
</script>

<template>
  <a-modal v-model:visible="isExpanded" :footer="null" width="min(90vw,1000px)" :body-style="{ padding: 0 }" :closable="false">
    <Header />
    <a-card class="!bg-gray-100">
      <div class="flex">
        <div class="flex-grow">
          <div class="h-550px overflow-auto w-[500px] mx-auto">
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

        <div
          class="nc-comments-drawer pr-3 min-w-0 max-h-[calc(90vh_-_100px)] overflow-y-auto"
          :class="{ active: commentsDrawer }"
        >
          <div class="w-[280px]">
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
</style>
