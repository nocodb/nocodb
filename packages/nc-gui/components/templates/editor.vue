<template>
  <div class="h-100" style="min-height: 500px">
    <v-toolbar v-if="!viewMode" class="elevation-0">
      <slot name="toolbar" :valid="valid">

        <v-tooltip bottom>
          <template #activator="{on}">
            <v-btn
              small
              outlined
              v-on="on"
              @click="$toast.info('Happy hacking!').goAway(3000)"
            >
              <v-icon small class="mr-1">
                mdi-file-excel-outline
              </v-icon>
              Import
            </v-btn>
          </template>
          <span class="caption">Create template from Excel</span>
        </v-tooltip>

        <v-spacer />

        <v-icon class="mr-3" @click="helpModal=true">
          mdi-information-outline
        </v-icon>

        <v-btn small outlined class="mr-1" @click="project = {tables : []}">
          <v-icon small>
            mdi-close
          </v-icon>
          Reset
        </v-btn>
        <v-btn small outlined class="mr-1" @click="createTableClick">
          <v-icon small>
            mdi-plus
          </v-icon>
          New table
        </v-btn>
        <v-btn
          color="primary"
          outlined
          small
          class="mr-1"
          :loading="loading"
          :disabled="loading"
          @click="saveTemplate"
        >
          {{ id || localId ? 'Update in' : 'Submit to' }} NocoDB
        </v-btn>
      </slot>
    </v-toolbar>
    <v-divider class="mt-6" />
    <v-container class="text-center" style="height:calc(100% - 64px);overflow-y: auto">
      <v-form ref="form" v-model="valid">
        <v-row fluid class="justify-center">
          <v-col cols="12">
            <v-card class="elevation-0">
              <v-card-text>
                <div v-if="!viewMode" class="mx-auto" style="max-width:400px">
                  <div class="mt-1">
                    <v-text-field
                      ref="project"
                      v-model="project.title"
                      class="title"
                      outlined
                      hide-details
                      denses
                      :rules="[v => !!v || 'Project name required'] "
                    >
                      <template #label>
                        <span class="caption">Project Name</span>
                      </template>
                    </v-text-field>
                  </div>
                </div>

                <p v-if="project.tables" class="caption grey--text mt-4">
                  {{ project.tables.length }} sheet{{ project.tables.length > 1 ? 's' :'' }} available for import
                </p>

                <v-expansion-panels
                  v-if="project.tables && project.tables.length"
                  v-model="expansionPanel"
                  :multiple="viewMode"
                  accordion
                >
                  <v-expansion-panel
                    v-for="(table, i) in project.tables"
                    :key="i"
                  >
                    <v-expansion-panel-header
                      :id="`tn_${table.table_name}`"
                    >
                      <v-text-field
                        v-if="editableTn[i]"
                        :value="table.table_name"
                        class="font-weight-bold"
                        style="max-width: 300px"
                        outlinedk
                        autofocus
                        dense
                        hide-details
                        @input="e => onTableNameUpdate(table, e)"
                        @click="e => viewMode || e.stopPropagation()"
                        @blur="$set(editableTn,i, false)"
                        @keydown.enter=" $set(editableTn,i, false)"
                      />
                      <span
                        v-else
                        class="font-weight-bold"
                        @click="e => viewMode || (e.stopPropagation() , $set(editableTn,i, true))"
                      >
                        <v-icon color="primary lighten-1">mdi-table</v-icon>
                        {{ table.table_name }}
                      </span>

                      <v-spacer />
                      <v-icon v-if="!viewMode" class="flex-grow-0 mr-2" small color="grey" @click.stop="deleteTable(i)">
                        mdi-delete-outline
                      </v-icon>
                    </v-expansion-panel-header>
                    <v-expansion-panel-content>
                      <!--                <v-toolbar>
                                        <v-spacer></v-spacer>
                                        <v-btn outlined small @click='showColCreateDialog(table,i)'>New Column
                                        </v-btn>
                                      </v-toolbar>-->

                      <template>
                        <v-simple-table v-if="table.columns.length" dense class="my-4">
                          <thead>
                            <tr>
                              <th class="caption text-left pa-1">
                                <!--Column Name-->
                                {{ $t('labels.columnName') }}
                              </th>
                              <th class="caption text-left pa-1" colspan="4">
                                <!--Column Type-->
                                {{ $t('labels.columnType') }}
                              </th>
                              <th />
                            <!--                    <th class='text-center'>Related Table</th>-->
                            <!--                    <th class='text-center'>Related Column</th>-->
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(col,j) in table.columns" :key="j" :data-exp="i">
                              <td class="pa-1 text-left" :style="{width:viewMode ? '33%' : '15%'}">
                                <span v-if="viewMode" class="body-1 ">
                                  {{ col.column_name }}
                                </span>

                                <v-text-field
                                  v-else

                                  :ref="`cn_${table.table_name}_${j}`"
                                  :value="col.column_name"
                                  outlined
                                  dense
                                  class="caption"
                                  :placeholder="$t('labels.columnName')"
                                  hide-details="auto"
                                  :rules="[
                                    v => !!v || 'Column name required',
                                    v =>!table.columns.some(c=>c !== col && c.column_name === v) || 'Duplicate column not allowed'
                                  ]"
                                  @input="e => onColumnNameUpdate(col,e,table.table_name)"
                                />
                              </td>

                              <template v-if="viewMode">
                                <td
                                  :style="{width:viewMode && isRelation(col) || isLookupOrRollup(col) ? '33%' : ''}"
                                  :colspan="isRelation(col) || isLookupOrRollup(col) ? 3 : 5"
                                  class="text-left"
                                >
                                  <v-icon small>
                                    {{ getIcon(col.uidt) }}
                                  </v-icon>
                                  <span class="caption">{{ col.uidt }}</span>
                                </td>
                                <td v-if="isRelation(col) || isLookupOrRollup(col)" class="text-left">
                                  <span
                                    v-if="isRelation(col)"
                                    class="caption pointer primary--text"
                                    @click="navigateToTable(col.rtn)"
                                  >
                                    {{ col.rtn }}
                                  </span>
                                  <template
                                    v-else-if="isLookup(col)"
                                  >
                                    <span
                                      class="caption pointer primary--text"
                                      @click="navigateToTable(col.rtn && col.rtn.table_name)"
                                    >
                                      {{ col.rtn && col.rtn.table_name }}
                                    </span> <span class="caption">({{ col.rcn }})</span>
                                  </template>

                                  <template
                                    v-else-if="isRollup(col)"
                                  >
                                    <span
                                      class="caption pointer primary--text"
                                      @click="navigateToTable(col.rtn && col.rtn.table_name)"
                                    >
                                      {{ col.rtn && col.rtn.table_name }}
                                    </span> <span class="caption">({{ col.fn }})</span>
                                  </template>
                                </td>
                              </template>

                              <template v-else>
                                <td
                                  class="pa-1  text-left"
                                  style="width:200px;max-width:200px"
                                >
                                  <v-autocomplete
                                    :ref="`uidt_${table.table_name}_${j}`"
                                    style="max-width: 200px"
                                    :value="col.uidt"
                                    placeholder="Column Datatype"
                                    outlined
                                    dense
                                    class="caption"
                                    hide-details="auto"
                                    :rules="[v => !!v || 'Column data type required']"
                                    :items="col.uidt ==='ForeignKey' ? [...uiTypes, {
                                      name: 'ForeignKey',
                                      icon: 'mdi-link-variant',
                                      virtual: 1
                                    }] : uiTypes"
                                    item-text="name"
                                    item-value="name"
                                    @input="v => onUidtChange(col.uidt,v,col,table)"
                                  >
                                    <template #item="{item:{name}}">
                                      <v-chip v-if="colors[name]" :color="colors[name]" small>
                                        {{ name }}
                                      </v-chip>
                                      <span v-else class="caption">{{ name }}</span>
                                    </template>
                                    <template #selection="{item:{name}} ">
                                      <v-chip v-if="colors[name]" :color="colors[name]" small style="max-width: 100px">
                                        {{ name }}
                                      </v-chip>
                                      <span v-else class="caption">{{ name }}</span>
                                    </template>
                                  </v-autocomplete>
                                </td>

                                <template
                                  v-if="isRelation(col) || isLookupOrRollup(col)"
                                >
                                  <td class="pa-1 text-left">
                                    <v-autocomplete
                                      :value="col.rtn"
                                      placeholder="Related table"
                                      outlined
                                      class="caption"
                                      dense
                                      hide-details="auto"
                                      :rules="[v => !!v || 'Related table name required', ...getRules(col, table)]"
                                      :items="isLookupOrRollup(col) ? getRelatedTables(table.table_name, isRollup(col)) : project.tables"
                                      :item-text="t => isLookupOrRollup(col) ? `${t.table_name} (${t.type})` : t.table_name"
                                      :item-value="t => isLookupOrRollup(col) ? t : t.table_name"
                                      :value-comparator="compareRel"
                                      @input="v => onRtnChange(col.rtn,v, col, table)"
                                    />
                                  </td>

                                  <td v-if="isRelation(col)" class="pa-1">
                                    <template v-if="col.uidt !== 'ForeignKey'">
                                      <span
                                        v-if="viewMode"
                                        class="caption"
                                      >
                                        <!--                                    {{ col.type }}-->
                                      </span>
                                      <v-autocomplete
                                        v-else
                                        :value="col.type"
                                        placeholder="Relation Type"
                                        outlined
                                        class="caption"
                                        dense
                                        hide-details="auto"
                                        :rules="[v => !!v || 'Relation type required']"
                                        :items="[{text:'Many To Many', value:'mm'},{text:'Has Many', value:'hm'}]"
                                        @input="v => onRTypeChange(col.type, v, col,table)"
                                      />
                                    </template>
                                  </td>
                                  <td v-if="isLookupOrRollup(col)" class="pa-1">
                                    <span
                                      v-if="viewMode"
                                      class="caption"
                                    >
                                      {{ col.rcn }}
                                    </span>

                                    <v-autocomplete
                                      v-else
                                      v-model="col.rcn"
                                      placeholder="Related table column"
                                      outlined
                                      dense
                                      class="caption"
                                      hide-details="auto"
                                      :rules="[v => !!v || 'Related column name required']"
                                      :items="(project.tables.find(t => t.table_name === (col.rtn && col.rtn.table_name || col.rtn)) || {columns:[]}).columns.filter(v=> !isVirtual(v))"
                                      item-text="column_name"
                                      item-value="column_name"
                                    />
                                  </td>
                                  <td v-if="isRollup(col)" class="pa-1">
                                    <span
                                      v-if="viewMode"
                                      class="caption"
                                    >
                                      {{ col.fn }}
                                    </span>

                                    <v-autocomplete
                                      v-else
                                      v-model="col.fn"
                                      placeholder="Rollup function"
                                      outlined
                                      dense
                                      class="caption"
                                      hide-details="auto"
                                      :rules="[v => !!v || 'Rollup aggregate function name required']"
                                      :items="rollupFnList"
                                    />
                                  </td>
                                </template>
                                <template
                                  v-if="isSelect(col)"
                                >
                                  <td class="pa-1 text-left" colspan="2">
                                    <span
                                      v-if="viewMode"
                                      class="caption"
                                    >
                                      {{ col.dtxp }}
                                    </span>
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
                                  v-if="!isRollup(col) "
                                  :colspan="isLookupOrRollup(col) || isRelation(col) || isSelect(col) ? (isRollup(col)?
                                    0 :1) : 3"
                                />
                                <td style="max-width: 50px;width: 50px">
                                  <v-icon
                                    v-if="!viewMode"
                                    class="flex-grow-0"
                                    small
                                    color="grey"
                                    @click.stop="deleteTableColumn(i,j, col, table)"
                                  >
                                    mdi-delete-outline
                                  </v-icon>
                                </td>
                              </template>
                            </tr>

                          <!--                  <tr>-->
                          <!--                    <td colspan='4' class='text-center pa-2'>-->
                          <!--                    </td>-->
                          <!--                  </tr>-->
                          </tbody>
                        </v-simple-table>

                        <div v-if="!viewMode" class="text-center">
                          <v-icon class="mx-2" small @click="addNewColumnRow(table, 'Number')">
                            {{ getIcon('Number') }}
                          </v-icon>
                          <v-icon class="mx-2" small @click="addNewColumnRow(table, 'SingleLineText')">
                            {{ getIcon('SingleLineText') }}
                          </v-icon>
                          <v-icon class="mx-2" small @click="addNewColumnRow(table, 'LongText')">
                            {{
                              getIcon('LongText')
                            }}
                          </v-icon>
                          <v-icon class="mx-2" small @click="addNewColumnRow(table, 'LinkToAnotherRecord')">
                            {{ getIcon('LinkToAnotherRecord') }}
                          </v-icon>
                          <v-icon class="mx-2" small @click="addNewColumnRow(table, 'Lookup')">
                            {{ getIcon('Lookup') }}
                          </v-icon>
                          <v-icon class="mx-2" small @click="addNewColumnRow(table, 'Rollup')">
                            {{ getIcon('Rollup') }}
                          </v-icon>
                          <v-btn class="mx-2" small @click="addNewColumnRow(table)">
                            + column
                          </v-btn>
                        </div>
                      </template>
                    </v-expansion-panel-content>
                  </v-expansion-panel>
                </v-expansion-panels>
                <div v-if="!viewMode" class="mx-auto" style="max-width:600px">
                  <template v-if="!excelImport">
                    <gradient-generator v-model="project.image_url" class=" d-100 mt-4" />

                    <v-row>
                      <v-col>
                        <v-text-field
                          v-model="project.category"
                          :rules="[v => !!v || 'Category name required']"
                          class="caption"
                          outlined
                          dense
                          label="Project Category"
                        />
                      </v-col>
                      <v-col>
                        <v-text-field
                          v-model="project.tags"
                          class="caption"
                          outlined
                          dense
                          label="Project Tags"
                        />
                      </v-col>
                    </v-row>
                    <div>
                      <v-textarea
                        v-model="project.description"
                        class="caption"
                        outlined
                        dense
                        label="Project Description"
                        @click="counter++"
                      />
                    </div>
                  </template>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-form>
    </v-container>

    <v-dialog v-model="createTablesDialog" max-width="500">
      <v-card>
        <v-card-title>
          <!--Enter table name-->
          {{ $t('msg.info.enterTableName') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="tableNamesInput"
            autofocus
            hide-details
            dense
            outlined
            label="Enter comma separated table names"
            @keydown.enter="addTables"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn outlined small @click="createTablesDialog=false">
            <!-- Cancel -->
            {{ $t('general.cancel') }}
          </v-btn>
          <v-btn outlined color="primary" small @click="addTables">
            <!-- Save -->
            {{ $t('general.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="createTableColumnsDialog" max-width="500">
      <v-card>
        <v-card-title>Enter column name</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="columnNamesInput"
            autofocus
            dense
            outlined
            hide-details
            label="Enter comma separated column names"
            @keydown.enter="addColumns"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn outlined small @click="createTableColumnsDialog=false">
            <!-- Cancel -->
            {{ $t('general.cancel') }}
          </v-btn>
          <v-btn outlined color="primary" small @click="addColumns">
            <!-- Save -->
            {{ $t('general.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <help v-model="helpModal" />

    <v-tooltip v-if="!viewMode" left>
      <template #activator="{on}">
        <v-btn
          fixed
          fab
          large
          color="primary"
          right
          style="top:45%"
          @click="createTableClick"
          v-on="on"
        >
          <v-icon>mdi-plus</v-icon>
        </v-btn>
      </template>
      <span class="caption">
        <!--Add new table-->
        {{ $t('tooltip.addTable') }}
      </span>
    </v-tooltip>
  </div>
</template>

<script>

import { uiTypes, getUIDTIcon, UITypes } from '~/components/project/spreadsheet/helpers/uiTypes'
import GradientGenerator from '~/components/templates/gradientGenerator'
import Help from '~/components/templates/help'

const LinkToAnotherRecord = 'LinkToAnotherRecord'
const Lookup = 'Lookup'
const Rollup = 'Rollup'
const defaultColProp = {}

export default {
  name: 'TemplateEditor',
  components: { Help, GradientGenerator },
  props: {
    id: [Number, String],
    viewMode: Boolean,
    projectTemplate: Object,
    excelImport: Boolean
  },
  data: () => ({
    loading: false,
    localId: null,
    valid: false,
    url: '',
    githubConfigForm: false,
    helpModal: false,
    editableTn: {},
    expansionPanel: 0,
    project: {
      name: 'Project name',
      tables: []
    },
    tableNamesInput: '',
    columnNamesInput: '',
    createTablesDialog: false,
    createTableColumnsDialog: false,
    selectedTable: null,
    uiTypes: uiTypes.filter(t => ![UITypes.Formula, UITypes.SpecificDBType].includes(t.name)),
    rollupFnList: [
      { text: 'count', value: 'count' },
      { text: 'min', value: 'min' },
      { text: 'max', value: 'max' },
      { text: 'avg', value: 'avg' },
      { text: 'min', value: 'min' },
      { text: 'sum', value: 'sum' },
      { text: 'countDistinct', value: 'countDistinct' },
      { text: 'sumDistinct', value: 'sumDistinct' },
      { text: 'avgDistinct', value: 'avgDistinct' }
    ],
    colors: {
      LinkToAnotherRecord: 'blue lighten-5',
      Rollup: 'pink lighten-5',
      Lookup: 'green lighten-5'
    }
  }),
  computed: {
    counter: {
      get() {
        return this.$store.state.templateC
      },
      set(c) {
        this.$store.commit('mutTemplateC', c)
      }
    },
    updateFilename() {
      return this.url && this.url.split('/').pop()
    }
  },
  watch: {
    project: {
      deep: true,
      handler() {
        const template = {
          ...this.project,
          tables: (this.project.tables || []).map((t) => {
            const table = { ...t, columns: [], hasMany: [], manyToMany: [], belongsTo: [], v: [] }

            for (const column of (t.columns || [])) {
              if (this.isRelation(column)) {
                if (column.type === 'hm') {
                  table.hasMany.push({
                    tn: column.rtn,
                    _cn: column.column_name
                  })
                } else if (column.type === 'mm') {
                  table.manyToMany.push({
                    rtn: column.rtn,
                    _cn: column.column_name
                  })
                } else if (column.uidt === UITypes.ForeignKey) {
                  table.belongsTo.push({
                    tn: column.rtn,
                    _cn: column.column_name
                  })
                }
              } else if (this.isLookup(column)) {
                if (column.rtn) {
                  table.v.push({
                    _cn: column.column_name,
                    lk: {
                      ltn: column.rtn.table_name,
                      type: column.rtn.type,
                      lcn: column.rcn
                    }
                  })
                }
              } else if (this.isRollup(column)) {
                if (column.rtn) {
                  table.v.push({
                    _cn: column.column_name,
                    rl: {
                      rltn: column.rtn.table_name,
                      rlcn: column.rcn,
                      type: column.rtn.type,
                      fn: column.fn
                    }
                  })
                }
              } else {
                table.columns.push(column)
              }
            }
            return table
          })
        }
        this.$emit('update:projectTemplate', template)
      }
    }
  },

  created() {
    document.addEventListener('keydown', this.handleKeyDown)
  },
  destroyed() {
    document.removeEventListener('keydown', this.handleKeyDown)
  },
  mounted() {
    this.parseAndLoadTemplate()
    const input = this.$refs.projec && this.$refs.project.$el.querySelector('input')
    if (input) {
      input.focus()
      input.select()
    }
  },
  methods: {
    createTableClick() {
      this.createTablesDialog = true
      this.$tele.emit('table:create:mdi-plus-circle')
    },
    parseAndLoadTemplate() {
      if (this.projectTemplate) {
        this.parseTemplate(this.projectTemplate)
        this.expansionPanel = Array.from({ length: this.project.tables.length }, (_, i) => i)
      }
    },
    getIcon(type) {
      return getUIDTIcon(type)
    },
    getRelatedTables(tableName, rollup = false) {
      const tables = []
      for (const t of this.projectTemplate.tables) {
        if (tableName === t.table_name) {
          for (const hm of t.hasMany) {
            const rTable = this.project.tables.find(t1 => t1.table_name === hm.table_name)
            tables.push({
              ...rTable,
              type: 'hm'
            })
          }
          for (const mm of t.manyToMany) {
            const rTable = this.project.tables.find(t1 => t1.table_name === mm.rtn)
            tables.push({
              ...rTable,
              type: 'mm'
            })
          }
        } else {
          for (const hm of t.hasMany) {
            if (hm.table_name === tableName && !rollup) {
              tables.push({
                ...t,
                type: 'bt'
              })
            }
          }
          for (const mm of t.manyToMany) {
            if (mm.rtn === tableName) {
              tables.push({
                ...t,
                type: 'mm'
              })
            }
          }
        }
      }

      return tables
    },
    validateAndFocus() {
      if (!this.$refs.form.validate()) {
        const input = this.$el.querySelector('.v-input.error--text')
        this.expansionPanel = input && input.parentElement && input.parentElement.parentElement && +input.parentElement.parentElement.dataset.exp
        setTimeout(() => {
          input.querySelector('input,select').focus()
        }, 500)
        return false
      }
      return true
    },
    deleteTable(i) {
      const deleteTable = this.project.tables[i]
      for (const table of this.project.tables) {
        if (table === deleteTable) {
          continue
        }
        table.columns = table.columns.filter(c => c.rtn !== deleteTable.table_name)
      }
      this.project.tables.splice(i, 1)
    },
    deleteTableColumn(i, j, col, table) {
      const deleteTable = this.project.tables[i]
      const deleteColumn = deleteTable.columns[j]

      let rTable, index
      // if relation column, delete the corresponding relation from other table
      if (col.uidt === UITypes.LinkToAnotherRecord) {
        if (col.type === 'hm') {
          rTable = this.project.tables.find(t => t.table_name === col.rtn)
          index = rTable && rTable.columns.findIndex(c => c.uidt === UITypes.ForeignKey && c.rtn === table.table_name)
        } else if (col.type === 'mm') {
          rTable = this.project.tables.find(t => t.table_name === col.rtn)
          index = rTable && rTable.columns.findIndex(c => c.uidt === UITypes.LinkToAnotherRecord && c.rtn === table.table_name && c.type === 'mm')
        }
      } else if (col.uidt === UITypes.ForeignKey) {
        rTable = this.project.tables.find(t => t.table_name === col.rtn)
        index = rTable && rTable.columns.findIndex(c => c.uidt === UITypes.LinkToAnotherRecord && c.rtn === table.table_name && c.type === 'hm')
      }

      if (rTable && index > -1) {
        rTable.columns.splice(index, 1)
      }

      for (const table of this.project.tables) {
        if (table === deleteTable) {
          continue
        }
        table.columns = table.columns.filter(c => c.rtn !== deleteTable.table_name || c.rcn !== deleteColumn.column_name)
      }
      deleteTable.columns.splice(j, 1)
    },
    addTables() {
      if (!this.tableNamesInput) {
        return
      }
      // todo: fix
      const re = /(?:^|,\s*)(\w+)(?:\(((\w+)(?:\s*,\s*\w+)?)?\)){0,1}(?=\s*,|\s*$)/g
      let m
      // eslint-disable-next-line no-cond-assign
      while (m = re.exec(this.tableNamesInput)) {
        if (this.project.tables.some(t => t.table_name === m[1])) {
          this.$toast.info(`Table '${m[1]}' is already exist`).goAway(1000)
          continue
        }

        this.project.tables.push({
          tn: m[1],
          columns: (m[2] ? m[2].split(/\s*,\s*/) : []).map(col => ({
            cn: col,
            ...defaultColProp
          })).filter((v, i, arr) => i === arr.findIndex(c => c.column_name === v.column_name))
        })
      }
      this.createTablesDialog = false
      this.tableNamesInput = ''
    },
    compareRel(a, b) {
      return ((a && a.table_name) || a) === ((b && b.table_name) || b) && (a && a.type) === (b && b.type)
    },
    addColumns() {
      if (!this.columnNamesInput) {
        return
      }
      const table = this.project.tables[this.expansionPanel]
      for (const col of this.columnNamesInput.split(/\s*,\s*/)) {
        if (table.columns.some(c => c.column_name === col)) {
          this.$toast.info(`Column '${col}' is already exist`).goAway(1000)
          continue
        }

        table.columns.push({
          cn: col,
          ...defaultColProp
        })
      }
      this.columnNamesInput = ''
      this.createTableColumnsDialog = false

      this.$nextTick(() => {
        const input = this.$refs[`uidt_${table.table_name}_${table.columns.length - 1}`][0].$el.querySelector('input')
        input.focus()
        this.$nextTick(() => {
          input.select()
        })
      })
    },
    showColCreateDialog(table) {
      this.createTableColumnsDialog = true
      this.selectedTable = table
    },

    isRelation(col) {
      return col.uidt === 'LinkToAnotherRecord' ||
          col.uidt === 'ForeignKey'
    },
    isLookup(col) {
      return col.uidt === 'Lookup'
    },
    isRollup(col) {
      return col.uidt === 'Rollup'
    },
    isVirtual(col) {
      return col && uiTypes.some(ut => ut.name === col.uidt && ut.virtual)
    },
    isLookupOrRollup(col) {
      return this.isLookup(col) ||
          this.isRollup(col)
    },
    isSelect(col) {
      return col.uidt === 'MultiSelect' ||
          col.uidt === 'SingleSelect'
    },
    addNewColumnRow(table, uidt) {
      table.columns.push({
        cn: `title${table.columns.length + 1}`,
        ...defaultColProp,
        uidt,
        ...(uidt === LinkToAnotherRecord
          ? {
              type: 'mm'
            }
          : {})
      })
      this.$nextTick(() => {
        const input = this.$refs[`cn_${table.table_name}_${table.columns.length - 1}`][0].$el.querySelector('input')
        input.focus()
        input.select()
      })
    },

    async handleKeyDown({ metaKey, key, altKey, shiftKey, ctrlKey }) {
      if (!(metaKey && ctrlKey) && !(altKey && shiftKey)) {
        return
      }
      switch (key && key.toLowerCase()) {
        case 't':
          this.createTablesDialog = true
          break
        case 'c':
          this.createTableColumnsDialog = true
          break
        case 'a':
          this.addNewColumnRow(this.project.tables[this.expansionPanel])
          break
        case 'j':
          this.copyJSON()
          break
        case 's':
          await this.saveTemplate()
          break
        case 'arrowup':
          this.expansionPanel = this.expansionPanel ? --this.expansionPanel : this.project.tables.length - 1
          break
        case 'arrowdown':
          this.expansionPanel = ++this.expansionPanel % this.project.tables.length
          break

        case '1':
          this.addNewColumnRow(this.project.tables[this.expansionPanel], 'Number')
          break
        case '2':
          this.addNewColumnRow(this.project.tables[this.expansionPanel], 'SingleLineText')
          break
        case '3':
          this.addNewColumnRow(this.project.tables[this.expansionPanel], 'LongText')
          break
        case '4':
          this.addNewColumnRow(this.project.tables[this.expansionPanel], 'LinkToAnotherRecord')
          break
        case '5':
          this.addNewColumnRow(this.project.tables[this.expansionPanel], 'Lookup')
          break
        case '6':
          this.addNewColumnRow(this.project.tables[this.expansionPanel], 'Rollup')
          break
      }
    },
    copyJSON() {
      if (!this.validateAndFocus()) {
        this.$toast.info('Please fill all the required column!').goAway(5000)
        return
      }
      const el = document.createElement('textarea')
      el.addEventListener('focusin', e => e.stopPropagation())
      el.value = JSON.stringify(this.projectTemplate, null, 2)
      el.style = { position: 'absolute', left: '-9999px' }
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      this.$toast.success('Successfully copied JSON data to clipboard!').goAway(3000)
      return true
    },
    openUrl() {
      window.open(this.url, '_blank')
    },
    async loadUrl() {
      try {
        let template = (await this.$axios.get(this.url)).data

        if (typeof template === 'string') {
          template = JSON.parse(template)
        }

        this.parseTemplate(template)
      } catch (e) {
        this.$toast.error(e.message).goAway(5000)
      }
    },

    parseTemplate({ tables = [], ...rest }) {
      const parsedTemplate = {
        ...rest,
        tables: tables.map(({ manyToMany = [], hasMany = [], belongsTo = [], v = [], columns = [], ...rest }) => ({
          ...rest,
          columns: [
            ...columns,
            ...manyToMany.map(mm => ({
              cn: mm.title || `${rest.table_name} <=> ${mm.rtn}`,
              uidt: LinkToAnotherRecord,
              type: 'mm',
              ...mm
            })),
            ...hasMany.map(hm => ({
              cn: hm.title || `${rest.table_name} => ${hm.table_name}`,
              uidt: LinkToAnotherRecord,
              type: 'hm',
              rtn: hm.table_name,
              ...hm
            })),
            ...belongsTo.map(bt => ({
              cn: bt.title || `${rest.table_name} => ${bt.rtn}`,
              uidt: UITypes.ForeignKey,
              rtn: bt.table_name,
              ...bt
            })),
            ...v.map((v) => {
              const res = {
                cn: v.title,
                rtn: {
                  ...v
                }
              }
              if (v.lk) {
                res.uidt = Lookup
                res.rtn.table_name = v.lk.ltn
                res.rcn = v.lk.lcn
                res.rtn.type = v.lk.type
              } else if (v.rl) {
                res.uidt = Rollup
                res.rtn.table_name = v.rl.rltn
                res.rcn = v.rl.rlcn
                res.rtn.type = v.rl.type
                res.fn = v.rl.fn
              }
              return res
            })
          ]
        }))
      }

      this.project = parsedTemplate
    },

    async projectTemplateCreate() {
      if (!this.validateAndFocus()) {
        this.$toast.info('Please fill all the required column!').goAway(5000)
        return
      }

      try {
        const githubConfig = this.$store.state.github

        // const token = await models.store.where({ key: 'GITHUB_TOKEN' }).first()
        // const branch = await models.store.where({ key: 'GITHUB_BRANCH' }).first()
        // const filePath = await models.store.where({ key: 'GITHUB_FILE_PATH' }).first()
        // const templateRepo = await models.store.where({ key: 'PROJECT_TEMPLATES_REPO' }).first()

        if (!githubConfig.token || !githubConfig.repo) {
          throw new Error('Missing token or template path')
        }

        const data = JSON.stringify(this.projectTemplate, 0, 2)
        const filename = this.updateFilename || `${this.projectTemplate.name}_${Date.now()}.json`
        const filePath = `${githubConfig.filePath ? githubConfig.filePath + '/' : ''}${filename}`
        const apiPath = `https://api.github.com/repos/${githubConfig.repo}/contents/${filePath}`

        let sha
        if (this.updateFilename) {
          const { data: { sha: _sha } } = await this.$axios({
            url: `https://api.github.com/repos/${githubConfig.repo}/contents/${filePath}`,
            method: 'get',
            headers: {
              Authorization: 'token ' + githubConfig.token
            }
          })
          sha = _sha
        }

        await this.$axios({
          url: apiPath,
          method: 'put',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'token ' + githubConfig.token
          },
          data: {
            message: `templates : init template ${filename}`,
            content: Base64.encode(data),
            sha,
            branch: githubConfig.branch
          }
        })

        this.url = `https://raw.githubusercontent.com/${githubConfig.repo}/${githubConfig.branch}/${filePath}`

        this.$toast.success('Template generated and saved successfully!').goAway(4000)
      } catch (e) {
        this.$toast.error(e.message).goAway(5000)
      }
    },
    navigateToTable(tn) {
      const index = this.projectTemplate.tables.findIndex(t => t.table_name === tn)
      if (Array.isArray(this.expansionPanel)) {
        this.expansionPanel.push(index)
      } else {
        this.expansionPanel = index
      }

      this.$nextTick(() => {
        const accord = this.$el.querySelector(`#tn_${tn}`)
        accord.focus()
        accord.scrollIntoView()
      })
    },

    async saveTemplate() {
      this.loading = true
      try {
        if (this.id || this.localId) {
          await this.$axios.put(`${process.env.NC_API_URL}/api/v1/nc/templates/${this.id || this.localId}`, this.projectTemplate, {
            params: {
              token: this.$store.state.template
            }
          })
          this.$toast.success('Template updated successfully').goAway(3000)
        } else if (!this.$store.state.template) {
          if (!this.copyJSON()) {
            return
          }

          this.$toast.info('Initiating Github for template').goAway(3000)
          const res = await this.$axios.post(`${process.env.NC_API_URL}/api/v1/projectTemplateCreate`, this.projectTemplate)
          this.$toast.success('Initiated Github successfully').goAway(3000)
          window.open(res.data.path, '_blank')
        } else {
          const res = await this.$axios.post(`${process.env.NC_API_URL}/api/v1/nc/templates`, this.projectTemplate, {
            params: {
              token: this.$store.state.template
            }
          })
          this.localId = res.data.id
          this.$toast.success('Template updated successfully').goAway(3000)
        }

        this.$emit('saved')
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      } finally {
        this.loading = false
      }
    },
    getRules(col, table) {
      return v => col.uidt !== UITypes.LinkToAnotherRecord || !table.columns.some(c => c !== col && c.uidt === UITypes.LinkToAnotherRecord && c.type === col.type && c.rtn === col.rtn) || 'Duplicate relation is not allowed'
    },
    onTableNameUpdate(oldTable, newVal) {
      const oldVal = oldTable.table_name
      this.$set(oldTable, 'tn', newVal)

      for (const table of this.project.tables) {
        for (const col of table.columns) {
          if (col.uidt === UITypes.LinkToAnotherRecord) {
            if (col.rtn === oldVal) {
              this.$set(col, 'rtn', newVal)
            }
          } else if (col.uidt === UITypes.Rollup || col.uidt === UITypes.Lookup) {
            if (col.rtn && col.rtn.table_name === oldVal) {
              this.$set(col.rtn, 'tn', newVal)
            }
          }
        }
      }
    },
    onColumnNameUpdate(oldCol, newVal, tn) {
      const oldVal = oldCol.column_name
      this.$set(oldCol, 'cn', newVal)

      for (const table of this.project.tables) {
        for (const col of table.columns) {
          if (col.uidt === UITypes.Rollup || col.uidt === UITypes.Lookup) {
            if (col.rtn && col.rcn === oldVal && col.rtn.table_name === tn) {
              this.$set(col, 'rcn', newVal)
            }
          }
        }
      }
    },
    async onRtnChange(oldVal, newVal, col, table) {
      this.$set(col, 'rtn', newVal)

      await this.$nextTick()

      if (col.uidt !== UITypes.LinkToAnotherRecord && col.uidt !== UITypes.ForeignKey) {
        return
      }

      if (oldVal) {
        const rTable = this.project.tables.find(t => t.table_name === oldVal)
        // delete relation from other table if exist

        let index = -1
        if (col.uidt === UITypes.LinkToAnotherRecord && col.type === 'mm') {
          index = rTable.columns.findIndex(c => c.uidt === UITypes.LinkToAnotherRecord && c.rtn === table.table_name && c.type === 'mm')
        } else if (col.uidt === UITypes.LinkToAnotherRecord && col.type === 'hm') {
          index = rTable.columns.findIndex(c => c.uidt === UITypes.ForeignKey && c.rtn === table.table_name)
        } else if (col.uidt === UITypes.ForeignKey) {
          index = rTable.columns.findIndex(c => c.uidt === UITypes.LinkToAnotherRecord && c.rtn === table.table_name && c.type === 'hm')
        }

        if (index > -1) {
          rTable.columns.splice(index, 1)
        }
      }
      if (newVal) {
        const rTable = this.project.tables.find(t => t.table_name === newVal)

        // check relation relation exist in other table
        // if not create a relation
        if (col.uidt === UITypes.LinkToAnotherRecord && col.type === 'mm') {
          if (!rTable.columns.find(c => c.uidt === UITypes.LinkToAnotherRecord && c.rtn === table.table_name && c.type === 'mm')) {
            rTable.columns.push({
              cn: `title${rTable.columns.length + 1}`,
              uidt: UITypes.LinkToAnotherRecord,
              type: 'mm',
              rtn: table.table_name
            })
          }
        } else if (col.uidt === UITypes.LinkToAnotherRecord && col.type === 'hm') {
          if (!rTable.columns.find(c => c.uidt === UITypes.ForeignKey && c.rtn === table.table_name)) {
            rTable.columns.push({
              cn: `title${rTable.columns.length + 1}`,
              uidt: UITypes.ForeignKey,
              rtn: table.table_name
            })
          }
        } else if (col.uidt === UITypes.ForeignKey) {
          if (!rTable.columns.find(c => c.uidt === UITypes.LinkToAnotherRecord && c.rtn === table.table_name && c.type === 'hm')) {
            rTable.columns.push({
              cn: `title${rTable.columns.length + 1}`,
              uidt: UITypes.LinkToAnotherRecord,
              type: 'hm',
              rtn: table.table_name
            })
          }
        }
      }
    },
    onRTypeChange(oldType, newType, col, table) {
      this.$set(col, 'type', newType)

      const rTable = this.project.tables.find(t => t.table_name === col.rtn)

      let index = -1

      // find column and update relation
      // or create a new column

      if (oldType === 'hm') {
        index = rTable.columns.findIndex(c => c.uidt === UITypes.ForeignKey && c.rtn === table.table_name)
      } else if (oldType === 'mm') {
        index = rTable.columns.findIndex(c => c.uidt === UITypes.LinkToAnotherRecord && c.rtn === table.table_name && c.type === 'mm')
      }

      const rCol = index === -1 ? { cn: `title${rTable.columns.length + 1}` } : { ...rTable.columns[index] }
      index = index === -1 ? rTable.columns.length : index

      if (newType === 'mm') {
        rCol.type = 'mm'
        rCol.uidt = UITypes.LinkToAnotherRecord
      } else if (newType === 'hm') {
        rCol.type = 'bt'
        rCol.uidt = UITypes.ForeignKey
      }
      rCol.rtn = table.table_name

      this.$set(rTable.columns, index, rCol)
    },
    onUidtChange(oldVal, newVal, col, table) {
      this.$set(col, 'uidt', newVal)
      this.$set(col, 'dtxp', undefined)

      // delete relation column from other table
      // if previous type is relation

      let index = -1
      let rTable

      if (oldVal === UITypes.LinkToAnotherRecord) {
        rTable = this.project.tables.find(t => t.table_name === col.rtn)
        if (rTable) {
          if (col.type === 'hm') {
            index = rTable.columns.findIndex(c => c.uidt === UITypes.ForeignKey && c.rtn === table.table_name)
          } else if (col.type === 'mm') {
            index = rTable.columns.findIndex(c => c.uidt === UITypes.LinkToAnotherRecord && c.rtn === table.table_name && c.type === 'mm')
          }
        }
      } else if (oldVal === UITypes.ForeignKey) {
        rTable = this.project.tables.find(t => t.table_name === col.rtn)
        if (rTable) { index = rTable.columns.findIndex(c => c.uidt === UITypes.LinkToAnotherRecord && c.rtn === table.table_name && c.type === 'hm') }
      }
      if (rTable && index > -1) {
        rTable.columns.splice(index, 1)
      }

      col.rtn = undefined
      col.type = undefined
      col.rcn = undefined

      if (col.uidt === LinkToAnotherRecord) {
        col.type = col.type || 'mm'
      }
    }
  }
}
</script>

<style scoped>
/deep/ .v-select__selections{
  flex-wrap: nowrap;
}
</style>
