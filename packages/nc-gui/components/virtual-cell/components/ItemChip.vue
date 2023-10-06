<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import {
  ActiveCellInj,
  IsFormInj,
  IsLockedInj,
  ReadonlyInj,
  iconMap,
  inject,
  isAttachment,
  ref,
  useExpandedFormDetached,
  useLTARStoreOrThrow,
} from '#imports'

interface Props {
  value: string | number | boolean
  item: any
  column: any
  showUnlinkButton?: boolean
  border?: boolean
  readonly?: boolean
}

const { value, item, column, showUnlinkButton, border = true, readonly: readonlyProp } = defineProps<Props>()

const emit = defineEmits(['unlink'])

const { relatedTableMeta } = useLTARStoreOrThrow()!

const { isUIAllowed } = useRoles()

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const isForm = inject(IsFormInj)!

const isLocked = inject(IsLockedInj, ref(false))

const { open } = useExpandedFormDetached()

function openExpandedForm() {
  const rowId = extractPkFromRow(item, relatedTableMeta.value.columns as ColumnType[])
  if (!readOnly.value && !isLocked.value && !readonlyProp && rowId) {
    open({
      isOpen: true,
      row: { row: item, rowMeta: {}, oldRow: { ...item } },
      meta: relatedTableMeta.value,
      rowId,
      useMetaFields: true,
    })
  }
}
</script>

<script lang="ts">
export default {
  name: 'ItemChip',
}
</script>

<template>
  <div
    v-e="['c:row-expand:open']"
    class="chip group mr-1 my-1 flex items-center rounded-[2px] flex-row"
    :class="{ active, 'border-1 py-1 px-2': isAttachment(column) }"
    @click="openExpandedForm"
  >
    <span class="name">
      <!-- Render virtual cell -->
      <div v-if="isVirtualCol(column)">
        <template v-if="column.uidt === UITypes.LinkToAnotherRecord">
          <LazySmartsheetVirtualCell :edit-enabled="false" :model-value="value" :column="column" :read-only="true" />
        </template>

        <LazySmartsheetVirtualCell v-else :edit-enabled="false" :read-only="true" :model-value="value" :column="column" />
      </div>
      <!-- Render normal cell -->
      <template v-else>
        <div v-if="isAttachment(column) && value && !Array.isArray(value) && typeof value === 'object'">
          <LazySmartsheetCell :model-value="value" :column="column" :edit-enabled="false" :read-only="true" />
        </div>
        <!-- For attachment cell avoid adding chip style -->
        <template v-else>
          <div
            class="min-w-max"
            :class="{
              'px-1 rounded-full flex-1': !isAttachment(column),
              'border-gray-200 rounded border-1':
                border && ![UITypes.Attachment, UITypes.MultiSelect, UITypes.SingleSelect].includes(column.uidt),
            }"
          >
            <LazySmartsheetCell :model-value="value" :column="column" :edit-enabled="false" :virtual="true" :read-only="true" />
          </div>
        </template>
      </template>
    </span>

    <div
      v-show="active || isForm"
      v-if="showUnlinkButton && !readOnly && !isLocked && isUIAllowed('dataEdit')"
      class="flex items-center"
    >
      <component
        :is="iconMap.closeThick"
        class="nc-icon unlink-icon text-xs text-gray-500/50 group-hover:text-gray-500"
        @click.stop="emit('unlink')"
      />
    </div>
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
