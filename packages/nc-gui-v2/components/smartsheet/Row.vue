<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'
import type { Row } from '~/composables'
import { useSmartsheetStoreOrThrow } from '~/composables'
import { useProvideSmartsheetRowStore } from '~/composables/useSmartsheetRowStore'
import { FieldsInj } from '~/context'

interface Props {
  row: Row
  selected: { col?: number; row?: number }
  rowIndex: number
  editEnabled: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['expandForm', 'selectCell', 'updateOrSaveRow', 'navigate'])

const row = toRef(props, 'row')
const rowIndex = toRef(props, 'rowIndex')
const editEnabled = toRef(props, 'editEnabled')

// todo : from props / inject
const isPublicView = false

const fields = inject(FieldsInj, ref([]))
const { meta } = useSmartsheetStoreOrThrow()

const { isNew } = useProvideSmartsheetRowStore(meta, row)
</script>

<template>
  <tr class="nc-grid-row group">
    <td key="row-index" class="caption nc-grid-cell">
      <div class="align-center flex w-[80px]">
        <div class="group-hover:hidden" :class="{ hidden: row.rowMeta.selected }">{{ rowIndex + 1 }}</div>
        <div :class="{ hidden: !row.rowMeta.selected, flex: row.rowMeta.selected }" class="group-hover:flex w-full align-center">
          <a-checkbox v-model:checked="row.rowMeta.selected" />
          <span class="flex-1" />
          <mdi-arrow-expand class="text-sm text-pink hidden group-hover:inline-block" @click="emit('expandForm')" />
        </div>
      </div>
    </td>
    <td
      v-for="(columnObj, colIndex) in fields"
      :key="columnObj.title"
      class="cell pointer nc-grid-cell"
      :class="{
        active: !isPublicView && selected.col === colIndex && selected.row === rowIndex,
      }"
      :data-col="columnObj.id"
      @click="emit('selectCell', rowIndex, colIndex)"
      @dblclick="editEnabled = true"
      @contextmenu="contextMenuTarget = { row: rowIndex, col: colIndex }"
    >
      <div class="w-full h-full">
        <SmartsheetVirtualCell
          v-if="isVirtualCol(columnObj)"
          v-model="row.row[columnObj.title]"
          :column="columnObj"
          :active="selected.col === colIndex && selected.row === rowIndex"
          :row="row"
          @navigate="emit('navigate', $event)"
        />

        <SmartsheetCell
          v-else
          v-model="row.row[columnObj.title]"
          :column="columnObj"
          :edit-enabled="editEnabled && selected.col === colIndex && selected.row === rowIndex"
          @update:edit-enabled="editEnabled = false"
          @save="emit('updateOrSaveRow', row, columnObj.title)"
          @navigate="emit('navigate', $event)"
          @cancel="emit('cancel')"
        />
      </div>
    </td>
  </tr>
</template>
