<script setup lang="ts">
import { isVirtualCol } from 'nocodb-sdk'
import { useVModel } from '@vueuse/core'
import { computed, provide } from 'vue'
import type { Row } from '~/composables'
import { FieldsInj, IsFormInj, MetaInj } from '~/context'
import MdiDoorOpen from '~icons/mdi/door-open'
import MdiDoorClosed from '~icons/mdi/door-closed'

interface Props {
  modelValue: string | null
}

const props = defineProps<Props>()
const emits = defineEmits(['update:modelValue'])
const fields = inject(FieldsInj, ref([]))
const meta = inject(MetaInj)

provide(IsFormInj, true)

// accept as a prop
const row: Row = { row: {}, rowMeta: {}, oldRow: {} }

const commentsDrawer = ref(false)

const isExpanded = useVModel(props, 'modelValue', emits)

const drawerToggleIcon = computed(() => (commentsDrawer.value ? MdiDoorOpen : MdiDoorClosed))
</script>

<template>
  <a-modal v-model:visible="isExpanded" :footer="null" width="min(90vw,1000px)" body-style="padding:0" :closable="false">
    <div class="flex p-2">
      <div class="flex-grow" />
      <component :is="drawerToggleIcon" class="" @click="commentsDrawer = !commentsDrawer" />
    </div>
    <a-card class="!bg-gray-100">
      <div class="flex">
        <div class="flex-grow">
          <div class="h-550px overflow-auto w-[500px] mx-auto">
            <div v-for="col in fields" :key="col.title" class="mt-2">
              <SmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" />
              <SmartsheetHeaderCell v-else :column="col" />

              <div class="!bg-white rounded px-1 min-h-[35px] flex align-center">
                <SmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="row.row[col.title]" :column="col" />
                <SmartsheetCell
                  v-else
                  v-model="row.row[col.title]"
                  :column="col"
                  :edit-enabled="true"
                  @update:edit-enabled="editEnabled = false"
                  @cancel="editEnabled = false"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="nc-comments-drawer min-w-0 h-full" :class="{ active: commentsDrawer }">
          <div class="w-[250px]">
            dsdsssdsdsdd
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
  @apply !bg-gray-100
}

.nc-comments-drawer {
  @apply w-0 transition-width ease-in-out duration-200;
  overflow: hidden;

  &.active {
    @apply w-[250px] border-left-1;
  }
}
</style>
