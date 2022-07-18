<script setup lang="ts">
import { useEventBus } from '@vueuse/core'
import type { ColumnType, FormType, GalleryType, GridType, KanbanType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { computed, onMounted, provide, watch } from '#imports'
import { ActiveViewInj, FieldsInj, IsLockedInj, MetaInj, ReloadViewDataHookInj, TabMetaInj } from '~/components'
import useMetas from '~/composables/useMetas'

interface Props {
  quickimportType: string
}
const { quickimportType } = defineProps<Props>()

const expansionPanel = ref(0)
const editableTn = ref({})
const project = ref({
  name: 'Project name',
  tables: [],
})

const onTableNameUpdate = (oldTable: string, newVal: string) => {
  // TODO:
}

const deleteTable = (tableIdx: number) => {
  // TODO:
}

const isRelation = (col: ColumnType) => {
  return col.uidt === 'LinkToAnotherRecord' || col.uidt === 'ForeignKey'
}

const isLookup = (col: ColumnType) => {
  return col.uidt === 'Lookup'
}

const isRollup = (col: ColumnType) => {
  return col.uidt === 'Rollup'
}

const isVirtual = (col: ColumnType) => {
  // TODO: uiTypes
  // return col && uiTypes.some(ut => ut.name === col.uidt && ut.virtual);
}

const isLookupOrRollup = (col: ColumnType) => {
  return isLookup(col) || isRollup(col)
}

const isSelect = (col: ColumnType) => {
  return col.uidt === 'MultiSelect' || col.uidt === 'SingleSelect'
}

const onColumnNameUpdate = (oldCol: ColumnType, newVal: string, tn: string) => {
  // TODO
}

const onRTypeChange = (oldType: string, newType: string, col: ColumnType, table: string) => {
  // TODO
}

const deleteTableColumn = (i: number, j: number, col: ColumnType, table: string) => {
  // TODO
}

const addNewColumnRow = (table: string, uidt?: string) => {
  // TODO
}
</script>

<template>
  <div class="h-100" style="min-height: 500px">
    <v-toolbar class="elevation-0">
      <slot name="toolbar" />
    </v-toolbar>
    <v-divider class="mt-6" />
    <v-container class="text-center" style="height: calc(100% - 64px); overflow-y: auto">
      <v-form ref="form" v-model="valid">
        <v-row fluid class="justify-center">
          <v-col cols="12">
            <v-card class="elevation-0">
              <v-card-text>
                <p v-if="project.tables && quickImportType === 'excel'" class="caption grey--text mt-4">
                  {{ project.tables.length }} sheet{{ project.tables.length > 1 ? 's' : '' }}
                  available for import
                </p>
                <v-expansion-panels v-if="project.tables && project.tables.length" v-model="expansionPanel" accordion>
                  <v-expansion-panel v-for="(table, i) in project.tables" :key="i">
                    <v-expansion-panel-header :id="`tn_${table.table_name}`">
                      <v-text-field
                        v-if="editableTn[i]"
                        :value="table.table_name"
                        class="font-weight-bold"
                        style="max-width: 300px"
                        outlinedk
                        autofocus
                        density="compact"
                        hide-details
                        @input="(e) => onTableNameUpdate(table, e)"
                        @click="(e) => e.stopPropagation()"
                        @blur="$set(editableTn, i, false)"
                        @keydown.enter="$set(editableTn, i, false)"
                      />
                      <span v-else class="font-weight-bold" @click="(e) => (e.stopPropagation(), $set(editableTn, i, true))">
                        <v-icon color="primary lighten-1">mdi-table</v-icon>
                        {{ table.table_name }}
                      </span>

                      <v-spacer />
                      <v-tooltip bottom>
                        <template #activator="{ on }">
                          <v-icon
                            v-if="project.tables.length > 1"
                            class="flex-grow-0 mr-2"
                            small
                            color="grey"
                            @click.stop="deleteTable(i)"
                            v-on="on"
                          >
                            mdi-delete-outline
                          </v-icon>
                        </template>
                        <!-- TODO: i18n -->
                        <span>Delete Table</span>
                      </v-tooltip>
                    </v-expansion-panel-header>
                    <v-expansion-panel-content>
                      <template>
                        <v-simple-table v-if="table.columns.length" dense class="my-4">
                          <thead>
                            <tr>
                              <th class="caption text-left pa-1">
                                <!-- Column Name -->
                                {{ $t('labels.columnName') }}
                              </th>
                              <th class="caption text-left pa-1" colspan="4">
                                <!-- Column Type -->
                                {{ $t('labels.columnType') }}
                              </th>
                              <th />
                              <!--                    <th class='text-center'>Related Table</th> -->
                              <!--                    <th class='text-center'>Related Column</th> -->
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(col, j) in table.columns" :key="j" :data-exp="i">
                              <td class="pa-1 text-left" :style="{ width: '15%' }">
                                <v-text-field
                                  :ref="`cn_${table.table_name}_${j}`"
                                  :value="col.column_name"
                                  outlined
                                  dense
                                  class="caption"
                                  :placeholder="$t('labels.columnName')"
                                  hide-details="auto"
                                  :rules="[
                                    (v) => !!v || 'Column name required',
                                    (v) =>
                                      !table.columns.some((c) => c !== col && c.column_name === v) ||
                                      'Duplicate column not allowed',
                                  ]"
                                  @input="(e) => onColumnNameUpdate(col, e, table.table_name)"
                                />
                              </td>
                              <template>
                                <td class="pa-1 text-left" style="width: 200px; max-width: 200px">
                                  <v-autocomplete
                                    :ref="`uidt_${table.table_name}_${j}`"
                                    style="max-width: 200px"
                                    :value="col.uidt"
                                    placeholder="Column Data Type"
                                    outlined
                                    dense
                                    class="caption"
                                    hide-details="auto"
                                    :rules="[(v) => !!v || 'Column data type required']"
                                    :items="
                                      col.uidt === 'ForeignKey'
                                        ? [
                                            ...uiTypes,
                                            {
                                              name: 'ForeignKey',
                                              icon: 'mdi-link-variant',
                                              virtual: 1,
                                            },
                                          ]
                                        : uiTypes
                                    "
                                    item-text="name"
                                    item-value="name"
                                    @input="(v) => onUidtChange(col.uidt, v, col, table)"
                                  >
                                    <template #item="{ item: { name } }">
                                      <v-chip v-if="colors[name]" :color="colors[name]" small>
                                        {{ name }}
                                      </v-chip>
                                      <span v-else class="caption">{{ name }}</span>
                                    </template>
                                    <template #selection="{ item: { name } }">
                                      <v-chip v-if="colors[name]" :color="colors[name]" small style="max-width: 100px">
                                        {{ name }}
                                      </v-chip>
                                      <span v-else class="caption">{{ name }}</span>
                                    </template>
                                  </v-autocomplete>
                                </td>

                                <template v-if="isRelation(col) || isLookupOrRollup(col)">
                                  <td class="pa-1 text-left">
                                    <v-autocomplete
                                      :value="col.ref_table_name"
                                      placeholder="Related table"
                                      outlined
                                      class="caption"
                                      dense
                                      hide-details="auto"
                                      :rules="[(v) => !!v || 'Related table name required', ...getRules(col, table)]"
                                      :items="
                                        isLookupOrRollup(col) ? getRelatedTables(table.table_name, isRollup(col)) : project.tables
                                      "
                                      :item-text="(t) => (isLookupOrRollup(col) ? `${t.table_name} (${t.type})` : t.table_name)"
                                      :item-value="(t) => (isLookupOrRollup(col) ? t : t.table_name)"
                                      :value-comparator="compareRel"
                                      @input="(v) => onRtnChange(col.ref_table_name, v, col, table)"
                                    />
                                  </td>

                                  <td v-if="isRelation(col)" class="pa-1">
                                    <template v-if="col.uidt !== 'ForeignKey'">
                                      <v-autocomplete
                                        :value="col.type"
                                        placeholder="Relation Type"
                                        outlined
                                        class="caption"
                                        dense
                                        hide-details="auto"
                                        :rules="[(v) => !!v || 'Relation type required']"
                                        :items="[
                                          { text: 'Many To Many', value: 'mm' },
                                          { text: 'Has Many', value: 'hm' },
                                        ]"
                                        @input="(v) => onRTypeChange(col.type, v, col, table)"
                                      />
                                    </template>
                                  </td>
                                  <td v-if="isLookupOrRollup(col)" class="pa-1">
                                    <v-autocomplete
                                      v-model="col.ref_column_name"
                                      placeholder="Related table column"
                                      outlined
                                      dense
                                      class="caption"
                                      hide-details="auto"
                                      :rules="[(v) => !!v || 'Related column name required']"
                                      :items="
                                        (
                                          project.tables.find(
                                            (t) =>
                                              t.table_name ===
                                              ((col.ref_table_name && col.ref_table_name.table_name) || col.ref_table_name),
                                          ) || { columns: [] }
                                        ).columns.filter((v) => !isVirtual(v))
                                      "
                                      item-text="column_name"
                                      item-value="column_name"
                                    />
                                  </td>
                                  <td v-if="isRollup(col)" class="pa-1">
                                    <v-autocomplete
                                      v-model="col.fn"
                                      placeholder="Rollup function"
                                      outlined
                                      dense
                                      class="caption"
                                      hide-details="auto"
                                      :rules="[(v) => !!v || 'Rollup aggregate function name required']"
                                      :items="rollupFnList"
                                    />
                                  </td>
                                </template>
                                <template v-if="isSelect(col)">
                                  <td class="pa-1 text-left" colspan="2">
                                    <v-text-field
                                      v-model="col.dtxp"
                                      placeholder="Select options"
                                      outlined
                                      class="caption"
                                      dense
                                      hide-details
                                    />
                                  </td>
                                </template>
                                <td
                                  v-if="!isRollup(col)"
                                  :colspan="
                                    isLookupOrRollup(col) || isRelation(col) || isSelect(col) ? (isRollup(col) ? 0 : 1) : 3
                                  "
                                />
                                <td style="max-width: 50px; width: 50px">
                                  <v-tooltip v-if="j == 0" bottom>
                                    <template #activator="{ on }">
                                      <x-icon small class="mr-1" color="primary" v-on="on"> mdi-key-star </x-icon>
                                    </template>
                                    <!-- TODO: i18n -->
                                    <span>Primary Value</span>
                                  </v-tooltip>
                                  <v-tooltip v-else bottom>
                                    <template #activator="{ on }">
                                      <v-icon
                                        class="flex-grow-0"
                                        small
                                        color="grey"
                                        @click.stop="deleteTableColumn(i, j, col, table)"
                                        v-on="on"
                                      >
                                        mdi-delete-outline
                                      </v-icon>
                                    </template>
                                    <!-- TODO: i18n -->
                                    <span>Delete Column</span>
                                  </v-tooltip>
                                </td>
                              </template>
                            </tr>
                          </tbody>
                        </v-simple-table>

                        <div class="text-center">
                          <v-tooltip bottom>
                            <template #activator="{ on }">
                              <v-icon class="mx-2" small @click="addNewColumnRow(table, 'Number')" v-on="on">
                                {{ getIcon('Number') }}
                              </v-icon>
                            </template>
                            <!-- TODO: i18n -->
                            <span>Add Number Column</span>
                          </v-tooltip>

                          <v-tooltip bottom>
                            <template #activator="{ on }">
                              <v-icon class="mx-2" small @click="addNewColumnRow(table, 'SingleLineText')" v-on="on">
                                {{ getIcon('SingleLineText') }}
                              </v-icon>
                            </template>
                            <!-- TODO: i18n -->
                            <span>Add SingleLineText Column</span>
                          </v-tooltip>

                          <v-tooltip bottom>
                            <template #activator="{ on }">
                              <v-icon class="mx-2" small @click="addNewColumnRow(table, 'LongText')" v-on="on">
                                {{ getIcon('LongText') }}
                              </v-icon>
                            </template>
                            <!-- TODO: i18n -->
                            <span>Add LongText Column</span>
                          </v-tooltip>

                          <!-- <v-tooltip bottom>
                            <template #activator="{ on }">
                              <v-icon
                                class="mx-2"
                                small
                                @click="addNewColumnRow(table, 'LinkToAnotherRecord')"
                                v-on="on"
                              >
                                {{ getIcon("LinkToAnotherRecord") }}
                              </v-icon>
                            </template>
                            <span>Add LinkToAnotherRecord Column</span>
                          </v-tooltip>

                          <v-tooltip bottom>
                            <template #activator="{ on }">
                              <v-icon
                                class="mx-2"
                                small
                                @click="addNewColumnRow(table, 'Lookup')"
                                v-on="on"
                              >
                                {{ getIcon("Lookup") }}
                              </v-icon>
                            </template>
                            <span>Add Lookup Column</span>
                          </v-tooltip>

                          <v-tooltip bottom>
                            <template #activator="{ on }">
                              <v-icon
                                class="mx-2"
                                small
                                @click="addNewColumnRow(table, 'Rollup')"
                                v-on="on"
                              >
                                {{ getIcon("Rollup") }}
                              </v-icon>
                            </template>
                            <span>Add Rollup Column</span>
                          </v-tooltip> -->

                          <v-tooltip bottom>
                            <template #activator="{ on }">
                              <v-btn class="mx-2" small @click="addNewColumnRow(table)" v-on="on"> + column </v-btn>
                            </template>
                            <!-- TODO: i18n -->
                            <span>Add Other Column</span>
                          </v-tooltip>
                        </div>
                      </template>
                    </v-expansion-panel-content>
                  </v-expansion-panel>
                </v-expansion-panels>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-form>
    </v-container>
  </div>
</template>
