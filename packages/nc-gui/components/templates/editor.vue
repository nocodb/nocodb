<template>
  <div>
    <v-toolbar v-if="!viewMode">
      <v-text-field
        v-model="url"
        clearable
        placeholder="Enter template url"
        outlined
        hide-details
        dense
        @keydown.enter="loadUrl"
      />
      <!--      <v-btn outlined class='ml-1' @click='loadUrl'> Load URL</v-btn>-->
      <v-spacer />

      <v-icon class="mr-3" @click="helpModal=true">
        mdi-information-outline
      </v-icon>

      <v-icon class="mr-3" @click="openUrl">
        mdi-web
      </v-icon>
      <v-tooltip bottom>
        <template #activator="{on}">
          <v-icon
            class="mr-3"
            v-on="on"
            @click="url = '',project.tables= []"
          >
            mdi-close-circle-outline
          </v-icon>
        </template>
        <span class="caption">Reset template</span>
      </v-tooltip>

      <v-icon
        :color="$store.getters['github/isAuthorized'] ? '' : 'error'"
        class="mr-3"
        @click="githubConfigForm = !githubConfigForm"
      >
        mdi-github
      </v-icon>

      <v-icon class="mr-3" @click="createTablesDialog = true">
        mdi-plus
      </v-icon>
      <!--      <v-btn outlined small class='mr-1' @click='submitTemplate'> Submit Template</v-btn>-->
      <v-btn color="primary" outlined small class="mr-1" @click="projectTemplateCreate">
        {{ updateFilename ? 'Update' : 'Create' }}
        Template
      </v-btn>
    </v-toolbar>
    <v-container class="text-center">
      <v-form ref="form">
        <v-row fluid class="justify-center">
          <v-col cols="12">
            <v-card>
              <v-card-text>
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
                      :id="`tn_${table.tn}`"
                    >
                      <v-text-field
                        v-if="editableTn[i]"
                        v-model="table.tn"
                        class="title"
                        style="max-width: 300px"
                        outlinedk
                        autofocus
                        dense
                        hide-details
                        @click="e => viewMode || e.stopPropagation()"
                        @blur="$set(editableTn,i, false)"
                        @keydown.enter=" $set(editableTn,i, false)"
                      />
                      <span
                        v-else
                        class="title"
                        @click="e => viewMode || (e.stopPropagation() , $set(editableTn,i, true))"
                      >
                        <v-icon color="primary lighten-1">mdi-table</v-icon>
                        {{ table.tn }}
                      </span>

                      <v-spacer />
                      <v-icon v-if="!viewMode" class="flex-grow-0 mr-2" small color="grey" @click.stop="deleteTable(i)">
                        mdi-delete
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
                              <th class="caption text-left pa-3">
                                Column Name
                              </th>
                              <th class="caption text-left pa-3" colspan="4">
                                Column Type
                              </th>
                              <th />
                            <!--                    <th class='text-center'>Related Table</th>-->
                            <!--                    <th class='text-center'>Related Column</th>-->
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(col,j) in table.columns" :key="j" :data-exp="i">
                              <td class="pa-3 text-left" :style="{width:viewMode ? '33%' : ''}">
                                <span v-if="viewMode" class="body-1 ">
                                  {{ col.cn }}
                                </span>

                                <v-text-field
                                  v-else
                                  :ref="`cn_${table.tn}_${j}`"
                                  v-model="col.cn"
                                  outlined
                                  dense
                                  class="caption"
                                  placeholder="Column name"
                                  hide-details="auto"
                                  :rules="[v => !!v || 'Column name required']"
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
                                      @click="navigateToTable(col.rtn && col.rtn.tn)"
                                    >
                                      {{ col.rtn && col.rtn.tn }}
                                    </span> <span class="caption">({{ col.rcn }})</span>
                                  </template>

                                  <template
                                    v-else-if="isRollup(col)"
                                  >
                                    <span
                                      class="caption pointer primary--text"
                                      @click="navigateToTable(col.rtn && col.rtn.tn)"
                                    >
                                      {{ col.rtn && col.rtn.tn }}
                                    </span> <span class="caption">({{ col.fn }})</span>
                                  </template>
                                </td>
                              </template>

                              <template v-else>
                                <td
                                  class="pa-3  text-left"
                                  :colspan="isLookupOrRollup(col) || isRelation(col) || isSelect(col) ? (isRollup(col)?
                                    1 :2) : 4"
                                >
                                  <v-autocomplete
                                    :ref="`uidt_${table.tn}_${j}`"
                                    v-model="col.uidt"
                                    placeholder="Column Datatype"
                                    outlined
                                    dense
                                    class="caption"
                                    hide-details="auto"
                                    :rules="[v => !!v || 'Column data type required']"
                                    :items="uiTypes"
                                    item-text="name"
                                    item-value="name"
                                    @change="onUidtChange(col)"
                                  >
                                    <template #item="{item:{name}}">
                                      <v-chip v-if="colors[name]" :color="colors[name]" small>
                                        {{ name }}
                                      </v-chip>
                                      <span v-else class="caption">{{ name }}</span>
                                    </template>
                                    <template #selection="{item:{name}}">
                                      <v-chip v-if="colors[name]" :color="colors[name]" small>
                                        {{ name }}
                                      </v-chip>
                                      <span v-else class="caption">{{ name }}</span>
                                    </template>
                                  </v-autocomplete>
                                </td>

                                <template
                                  v-if="isRelation(col) || isLookupOrRollup(col)"
                                >
                                  <td class="pa-3 text-left">
                                    <v-autocomplete
                                      v-model="col.rtn"
                                      placeholder="Related table"
                                      outlined
                                      class="caption"
                                      dense
                                      hide-details="auto"
                                      :rules="[v => !!v || 'Related table name required']"
                                      :items="isLookupOrRollup(col) ? getRelatedTables(table.tn, isRollup(col)) : project.tables"
                                      :item-text="t => isLookupOrRollup(col) ? `${t.tn} (${t.type})` : t.tn"
                                      :item-value="t => isLookupOrRollup(col) ? t : t.tn"
                                      :value-comparator="compareRel"
                                    />
                                  </td>

                                  <td v-if="isRelation(col)" class="pa-3">
                                    <span
                                      v-if="viewMode"
                                      class="caption"
                                    >
                                    <!--                                    {{ col.type }}-->
                                    </span>
                                    <v-autocomplete
                                      v-else
                                      v-model="col.type"
                                      placeholder="Relation Type"
                                      outlined
                                      class="caption"
                                      dense
                                      hide-details="auto"
                                      :rules="[v => !!v || 'Relation type required']"
                                      :items="[{text:'Many To Many', value:'mm'},{text:'Has Many', value:'hm'}]"
                                    />
                                  </td>
                                  <td v-if="isLookupOrRollup(col)" class="pa-3">
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
                                      :items="(project.tables.find(t => t.tn === (col.rtn && col.rtn.tn || col.rtn)) || {columns:[]}).columns.filter(v=> !isVirtual(v))"
                                      item-text="cn"
                                      item-value="cn"
                                    />
                                  </td>
                                  <td v-if="isRollup(col)" class="pa-3">
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
                                  <td class="pa-3 text-left" colspan="2">
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
                                <td>
                                  <v-icon
                                    v-if="!viewMode"
                                    class="flex-grow-0"
                                    small
                                    color="grey"
                                    @click.stop="deleteTableColumn(i,j)"
                                  >
                                    mdi-delete
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

                <!--            <v-btn small color='primary' class='mt-10' @click='createTablesDialog = true'>New Table</v-btn>-->
                <div v-if="!viewMode" class="mx-auto" style="max-width:600px">
                  <div class="mt-10">
                    <v-text-field
                      ref="project"
                      v-model="project.name"
                      class="caption"
                      outlined
                      dense
                      label="Project Name"
                      :rules="[v => !!v || 'Required'] "
                    />
                  </div>
                  <v-row>
                    <v-col>
                      <v-text-field
                        v-model="project.category"
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
                      label="Project Tags"
                    />
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-form>

      <github-config v-if="githubConfigForm" class="mx-auto mt-10 mb-4" />
    </v-container>

    <v-dialog v-model="createTablesDialog" max-width="500">
      <v-card>
        <v-card-title>Enter table name</v-card-title>
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
            Cancel
          </v-btn>
          <v-btn outlined color="primary" small @click="addTables">
            Save
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
            Cancel
          </v-btn>
          <v-btn outlined color="primary" small @click="addColumns">
            Save
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
          right="100"
          style="top:45%"
          @click="createTablesDialog = true"
          v-on="on"
        >
          <v-icon>mdi-plus</v-icon>
        </v-btn>
      </template>
      <span class="caption">Add new table</span>
    </v-tooltip>
  </div>
</template>

<script>

import { uiTypes, getUIDTIcon } from '~/components/project/spreadsheet/helpers/uiTypes'

const LinkToAnotherRecord = 'LinkToAnotherRecord'
const Lookup = 'Lookup'
const Rollup = 'Rollup'
const defaultColProp = {}

export default {
  name: 'TemplateEditor',
  components: {},
  props: {
    viewMode: Boolean,
    templateData: Object
  },
  data: () => ({
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
    uiTypes,
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

    updateFilename() {
      return this.url && this.url.split('/').pop()
    },
    projectTemplate() {
      return {
        ...this.project,
        tables: (this.project.tables || []).map((t) => {
          const table = { tn: t.tn, columns: [], hasMany: [], manyToMany: [], v: [] }

          for (const column of (t.columns || [])) {
            if (this.isRelation(column)) {
              if (column.type === 'hm') {
                table.hasMany.push({
                  tn: column.rtn,
                  _cn: column.cn
                })
              } else if (column.type === 'mm') {
                table.manyToMany.push({
                  rtn: column.rtn,
                  _cn: column.cn
                })
              }
            } else if (this.isLookup(column)) {
              if (column.rtn) {
                table.v.push({
                  _cn: column.cn,
                  lk: {
                    ltn: column.rtn.tn,
                    type: column.rtn.type,
                    lcn: column.rcn
                  }
                })
              }
            } else if (this.isRollup(column)) {
              if (column.rtn) {
                table.v.push({
                  _cn: column.cn,
                  rl: {
                    rltn: column.rtn.tn,
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
    }
  },

  created() {
    document.addEventListener('keydown', this.handleKeyDown)
  },
  destroyed() {
    document.removeEventListener('keydown', this.handleKeyDown)
  },
  mounted() {
    if (this.templateData) {
      this.parseTemplate(this.templateData)
      this.expansionPanel = Array.from({ length: this.project.tables.length }, (_, i) => i)
    }
    const input = this.$refs.projec && this.$refs.project.$el.querySelector('input')
    if (input) {
      input.focus()
      input.select()
    }
  },
  methods: {
    getIcon(type) {
      return getUIDTIcon(type)
    },
    getRelatedTables(tableName, rollup = false) {
      const tables = []
      for (const t of this.projectTemplate.tables) {
        if (tableName === t.tn) {
          for (const hm of t.hasMany) {
            const rTable = this.project.tables.find(t1 => t1.tn === hm.tn)
            tables.push({
              ...rTable,
              type: 'hm'
            })
          }
          for (const mm of t.manyToMany) {
            const rTable = this.project.tables.find(t1 => t1.tn === mm.rtn)
            tables.push({
              ...rTable,
              type: 'mm'
            })
          }
        } else {
          for (const hm of t.hasMany) {
            if (hm.tn === tableName && !rollup) {
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
        this.expansionPanel = +input.parentElement.parentElement.dataset.exp
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
        table.columns = table.columns.filter(c => c.rtn !== deleteTable.tn)
      }
      this.project.tables.splice(i, 1)
    },
    deleteTableColumn(i, j) {
      const deleteTable = this.project.tables[i]
      const deleteColumn = deleteTable.columns[j]
      for (const table of this.project.tables) {
        if (table === deleteTable) {
          continue
        }
        table.columns = table.columns.filter(c => c.rtn !== deleteTable.tn || c.rcn !== deleteColumn.cn)
      }
      deleteTable.columns.splice(j, 1)
    },
    addTables() {
      if (!this.tableNamesInput) {
        return
      }
      // todo: fix
      const re = /(?<=^|,\s*)(\w+)(?:\(((\w+)(?:\s*,\s*\w+)?)?\)){0,1}(?=\s*,|\s*$)/g
      let m
      // eslint-disable-next-line no-cond-assign
      while (m = re.exec(this.tableNamesInput)) {
        if (this.project.tables.some(t => t.tn === m[1])) {
          this.$toast.info(`Table '${m[1]}' is already exist`).goAway(1000)
          continue
        }

        this.project.tables.push({
          tn: m[1],
          columns: (m[2] ? m[2].split(/\s*,\s*/) : []).map(col => ({
            cn: col,
            ...defaultColProp
          })).filter((v, i, arr) => i === arr.findIndex(c => c.cn === v.cn))
        })
      }
      this.tableNamesInput = ''
      this.createTablesDialog = false
    },
    compareRel(a, b) {
      return ((a && a.tn) || a) === ((b && b.tn) || b) && (a && a.type) === (b && b.type)
    },
    addColumns() {
      if (!this.columnNamesInput) {
        return
      }
      const table = this.project.tables[this.expansionPanel]
      for (const col of this.columnNamesInput.split(/\s*,\s*/)) {
        if (table.columns.some(c => c.cn === col)) {
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
        const input = this.$refs[`uidt_${table.tn}_${table.columns.length - 1}`][0].$el.querySelector('input')
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
        const input = this.$refs[`cn_${table.tn}_${table.columns.length - 1}`][0].$el.querySelector('input')
        input.focus()
        input.select()
      })
    },

    async handleKeyDown({ metaKey, key, altKey, shiftKey, ctrlKey }) {
      // eslint-disable-next-line no-console
      console.log({ metaKey, key, altKey, shiftKey, ctrlKey })
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
          await this.submitTemplate()
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
      el.value = JSON.stringify(this.projectTemplate, null, 2)
      el.setAttribute('readonly', '')
      el.style = { position: 'absolute', left: '-9999px' }
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      this.$toast.success('Successfully copied JSON data to clipboard!').goAway(3000)
    },
    async submitTemplate() {
      try {
        this.copyJSON()

        this.$toast.info('Initing Github for template').goAway(3000)
        // const res = await axios.get('https://hookb.in/K3k2OOeN01fPMK88MMwb', el.value);
        const res = await this.$axios.post('https://nocodb.com/api/v1/projectTemplateCreate', this.projectTemplate)
        console.log(res)
        this.$toast.success('Inited Github successfully').goAway(3000)
        window.open(res.data.path, '_blank')
      } catch (e) {
        console.log(e)
        this.$toast.error('Some error occurred').goAway(3000)
      }
    },
    async template() {
      //
      // this.$axios({
      //   method:'post',
      //   url:'https://nocodb.com/api/api/v1/projectTemplateCreate',
      //   data:{
      //     name:'test_name'
      //   }
      // }).then(res => {
      //   console.log(res.data)
      // }).catch(e => console.log(e.message))

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

        console.log(template)
        this.parseTemplate(template)
      } catch (e) {
        this.$toast.error(e.message).goAway(5000)
      }
    },

    parseTemplate({ tables = [], ...rest }) {
      const parsedTemplate = {
        ...rest,
        tables: tables.map(({ manyToMany, hasMany, v, columns, ...rest }) => ({
          ...rest,
          columns: [
            ...columns,
            ...manyToMany.map(mm => ({
              cn: mm._cn || `${rest.tn} <=> ${mm.rtn}`,
              uidt: LinkToAnotherRecord,
              type: 'mm',
              ...mm
            })),
            ...hasMany.map(hm => ({
              cn: hm._cn || `${rest.tn} => ${hm.tn}`,
              uidt: LinkToAnotherRecord,
              type: 'hm',
              rtn: hm.tn,
              ...hm
            })),
            ...v.map((v) => {
              const res = {
                cn: v._cn,
                rtn: {
                  ...v
                }
              }
              if (v.lk) {
                res.uidt = Lookup
                res.rtn.tn = v.lk.ltn
                res.rcn = v.lk.lcn
                res.rtn.type = v.lk.type
              } else if (v.rl) {
                res.uidt = Rollup
                res.rtn.tn = v.rl.rltn
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
    onUidtChange(col) {
      if (col.uidt === LinkToAnotherRecord) {
        col.type = 'mm'
      }
    },
    navigateToTable(tn) {
      const index = this.projectTemplate.tables.findIndex(t => t.tn === tn)
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
    }

  }
}
</script>

<style scoped>
</style>
