<script lang="ts" setup>
import { inject, ComputedRef } from 'vue'
import { isVirtualCol } from 'nocodb-sdk'
import type { TableType } from 'nocodb-sdk'
import { useNuxtApp } from '#app'
import type { TabItem } from '~/composables/tabs'

const tabMeta = inject<TabItem>('tabMeta')
const meta = inject<ComputedRef<TableType>>('meta')

const { project } = useProject()
const rows = ref()

const { $api, $state } = useNuxtApp()

const loadData = async () => {
  const response = await $api.dbTableRow.list(
    'noco',
    project.value.id!,
    meta.id
  )

  rows.value = response.list
}
onMounted(loadData)
</script>

<template>
  <table
    class="xc-row-table nc-grid backgroundColorDefault"
  >
    <thead>
      <tr>
        <th>#</th>
        <th v-for="(col) in meta.columns" :key="col.title">
          {{ col.title }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(row, rowIndex) in rows"
        :key="rowIndex"
        class="nc-grid-row"
      >
        <td
          key="row-index"
          style="width: 65px"
          class="caption nc-grid-cell"
        >
          <div class="d-flex align-center">
            {{ rowIndex + 1 }}
          </div>
        </td>
        <td
          v-for="(columnObj) in meta.columns"
          :key="rowIndex + columnObj.title"
          class="cell pointer nc-grid-cell"
          :class="{
            // 'active':
            //   !isPublicView
            //   && selected.col === col
            //   && selected.row === row
            //   && isEditable,
            // 'primary-column': primaryValueColumn === columnObj.title,
            // 'text-center': isCentrallyAligned(columnObj),
            // 'required': isRequired(columnObj, rowObj),
          }"
          :data-col="columnObj.title"
        >
          <!--          @dblclick="makeEditable(col, row, columnObj.ai, rowMeta)" -->
          <!--          @click="makeSelected(col, row)" -->
          <!--          @contextmenu=" -->
          <!--            showRowContextMenu($event, rowObj, rowMeta, row, col, columnObj) -->
          <!--          " -->
          <!--        > -->
          <!--          <virtual-cell -->
          <!--            v-if="isVirtualCol(columnObj)" -->
          <!--            :password="password" -->
          <!--            :is-public="isPublicView" -->
          <!--            :metas="metas" -->
          <!--            :is-locked="isLocked" -->
          <!--            :column="columnObj" -->
          <!--            :row="rowObj" -->
          <!--            :nodes="nodes" -->
          <!--            :meta="meta" -->
          <!--            :api="api" -->
          <!--            :active="selected.col === col && selected.row === row" -->
          <!--            :sql-ui="sqlUi" -->
          <!--            :is-new="rowMeta.new" -->
          <!--            v-on="$listeners" -->
          <!--            @updateCol=" -->
          <!--              (...args) => -->
          <!--                updateCol( -->
          <!--                  ...args, -->
          <!--                  columnObj.bt -->
          <!--                    && meta.columns.find( -->
          <!--                      (c) => c.column_name === columnObj.bt.column_name, -->
          <!--                    ), -->
          <!--                  col, -->
          <!--                  row, -->
          <!--                ) -->
          <!--            " -->
          <!--            @saveRow="onCellValueChange(col, row, columnObj, true)" -->
          <!--          /> -->

          <!--          <editable-cell -->
          <!--            v-else-if=" -->
          <!--              ((isPkAvail || rowMeta.new) -->
          <!--                && !isView -->
          <!--                && !isLocked -->
          <!--                && !isPublicView -->
          <!--                && editEnabled.col === col -->
          <!--                && editEnabled.row === row) -->
          <!--                || enableEditable(columnObj) -->
          <!--            " -->
          <!--            v-model="rowObj[columnObj.title]" -->
          <!--            :column="columnObj" -->
          <!--            :meta="meta" -->
          <!--            :active="selected.col === col && selected.row === row" -->
          <!--            :sql-ui="sqlUi" -->
          <!--            :db-alias="nodes.dbAlias" -->
          <!--            :is-locked="isLocked" -->
          <!--            :is-public="isPublicView" -->
          <!--            :view-id="viewId" -->
          <!--            @save="editEnabled = {}; onCellValueChange(col, row, columnObj, true);" -->
          <!--            @cancel="editEnabled = {}" -->
          <!--            @update="onCellValueChange(col, row, columnObj, false)" -->
          <!--            @blur="onCellValueChange(col, row, columnObj, true)" -->
          <!--            @input="unsaved = true" -->
          <!--            @navigateToNext="navigateToNext" -->
          <!--            @navigateToPrev="navigateToPrev" -->
          <!--          /> -->

          <span v-if="isVirtualCol(columnObj)" />

          <SmartsheetCell
            v-else
            :class="{
              // 'primary--text': primaryValueColumn === columnObj.title,
            }"
            :column="columnObj"
            :value="row[columnObj.title]"
          />
        <!-- :selected="selected.col === col && selected.row === row" -->
        <!--        :is-locked="isLocked" -->
        <!--            :column="columnObj" -->
        <!--            :meta="meta" -->
        <!--            :db-alias="nodes.dbAlias" -->
        <!--            :value="rowObj[columnObj.title]" -->
        <!--            :sql-ui="sqlUi" -->
        <!--            @enableedit=" -->
        <!--              makeSelected(col, row); -->
        <!--              makeEditable(col, row, columnObj.ai, rowMeta); -->
        <!--            " -->
        <!--          /> -->
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped lang="scss">
td,
tr {
  min-height: 31px !important;
  position: relative;
  padding: 0 5px !important;
  min-width: 200px;
}

table,
td,
th {
  border-right: 1px solid #7f828b33 !important;
  border-left: 1px solid #7f828b33 !important;
  border-bottom: 1px solid #7f828b33 !important;
  border-top: 1px solid #7f828b33 !important;
  border-collapse: collapse;

  font-size:.8rem;
}

td{
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
