<template>
  <v-card
    min-width="300px"
    max-width="400px"
    max-height="95vh"
    style="overflow: auto"
    class="elevation-0 card nc-col-create-or-edit-card"
  >
    <v-form ref="form" v-model="valid">
      <v-container fluid @click.stop.prevent>
        <v-row>
          <v-col cols="12" class="d-flex pb-0">
            <v-spacer />
            <v-btn small outlined @click="close">
              Cancel
            </v-btn>
            <v-btn small color="primary" :disabled="!valid" @click="save">
              Save
            </v-btn>
          </v-col>
          <v-col cols="12">
            <v-text-field
              v-if="!isLookup"
              ref="column"
              v-model="newColumn.cn"
              hide-details="auto"
              color="primary"
              :rules="[
                v => !!v || 'Required',
                v => !meta || !meta.columns || meta.columns.every(c => column && c.cn === column.cn || v !== c.cn ) && meta.v.every(c => v !== c._cn ) || 'Duplicate column name'
              ]"
              class="caption nc-column-name-input"
              label="Column name"
              dense
              outlined
              @input="newColumn.altered = newColumn.altered || 8"
            />
          </v-col>
          <v-container
            fluid
            :class="{
              editDisabled :isEditDisabled
            }"
          >
            <v-row>
              <v-col v-if="relation" cols="12">
                <div class="caption">
                  <p class="mb-1">
                    Foreign Key
                  </p>

                  <v-icon small class="mt-n1">
                    mdi-table
                  </v-icon>
                  <span class="text-capitalize font-weight-bold body-1"> {{ relation._rtn }}</span>
                  <v-icon
                    v-ge="['columns','fk-delete']"
                    small
                    class="ml-3 mt-n1"
                    color="error"
                    @click="deleteRelation('showDialog', column)"
                  >
                    mdi-delete-forever
                  </v-icon>
                  <span v-if="relation.type=== 'virtual'" class="caption">(v)</span>
                </div>
              </v-col>
              <template v-else>
                <v-col cols="12">
                  <v-autocomplete
                    v-model="newColumn.uidt"
                    hide-details
                    item-value="name"
                    item-text="name"
                    class="caption ui-type nc-ui-dt-dropdown"
                    :class="{'primary lighten-5' : newColumn.uidt }"
                    label="Column type"
                    dense
                    outlined
                    :items="uiTypes"
                    @change="onUiTypeChange"
                  >
                    <template #selection="{item}">
                      <div>
                        <v-icon color="grey darken-4" small class="mr-1">
                          {{ item.icon }}
                        </v-icon>
                        <span class="caption  grey--text text--darken-4"> {{ item.name }}</span>
                      </div>
                    </template>

                    <template #item="{item}">
                      <div class="caption">
                        <v-icon small class="mr-1">
                          {{ item.icon }}
                        </v-icon>
                        {{ item.name }}
                      </div>
                    </template>
                  </v-autocomplete>

                  <!--                        <v-list dense max-height="calc(100vh - 300px)" style="overflow: auto">-->
                  <!--                          <v-list-item v-for="item in uiTypes" @click.stop :key="item">-->
                  <!--                            <span class="caption">{{ item }}</span>-->
                  <!--                          </v-list-item>-->
                  <!--                        </v-list>-->
                </v-col>

                <template v-if="newColumn.uidt !== 'Formula'">
                  <v-col
                    v-if="isLookup"
                    cols="12"
                  >
                    <lookup-options
                      ref="lookup"
                      :column="newColumn"
                      :nodes="nodes"
                      :meta="meta"
                      :is-s-q-lite="isSQLite"
                      :alias="newColumn.cn"
                      :is-m-s-s-q-l="isMSSQL"
                      v-on="$listeners"
                    />
                  </v-col>
                  <v-col
                    v-if="isRollup"
                    cols="12"
                  >
                    <rollup-options
                      ref="rollup"
                      :column="newColumn"
                      :nodes="nodes"
                      :meta="meta"
                      :is-s-q-lite="isSQLite"
                      :alias="newColumn.cn"
                      :is-m-s-s-q-l="isMSSQL"
                      v-on="$listeners"
                    />
                  </v-col>
                  <v-col
                    v-if="isLinkToAnotherRecord"
                    cols="12"
                  >
                    <linked-to-another-options
                      ref="relation"
                      :column="newColumn"
                      :nodes="nodes"
                      :meta="meta"
                      :is-s-q-lite="isSQLite"
                      :alias="newColumn.cn"
                      :is-m-s-s-q-l="isMSSQL"
                      @onColumnSelect="onRelColumnSelect"
                    />
                  </v-col>
                  <v-col
                    v-if="isRelation"
                    cols="12"
                  >
                    <relation-options
                      ref="relation"
                      :column="newColumn"
                      :nodes="nodes"
                      :is-m-s-s-q-l="isMSSQL"
                      :is-s-q-lite="isSQLite"
                      @onColumnSelect="onRelColumnSelect"
                    />
                  </v-col>

                  <v-col v-if="isSelect" cols="12">
                    <custom-select-options
                      v-model="newColumn.dtxp"
                      @input="newColumn.altered = newColumn.altered || 2"
                    />
                  </v-col>

                  <template v-if="newColumn.cn && newColumn.uidt && !isVirtual">
                    <v-col cols="12">
                      <v-container fluid class="wrapper">
                        <v-row>
                          <v-col cols="12">
                            <div class="d-flex justify-space-between caption">
                              <v-tooltip bottom z-index="99999">
                                <template #activator="{on}">
                                  <div v-on="on">
                                    <v-checkbox
                                      v-model="newColumn.rqd"
                                      :disabled="newColumn.pk || !sqlUi.columnEditable(newColumn)"
                                      class="mr-2 mt-0"
                                      dense
                                      hide-details
                                      label="NN"
                                      @input="newColumn.altered = newColumn.altered || 2"
                                    >
                                      <template #label>
                                        <span class="caption font-weight-bold">NN</span>
                                      </template>
                                    </v-checkbox>
                                  </div>
                                </template>
                                <span>Not Null</span>
                              </v-tooltip>
                              <v-tooltip bottom z-index="99999">
                                <template #activator="{on}">
                                  <div v-on="on">
                                    <v-checkbox

                                      v-model="newColumn.pk"
                                      :disabled="!sqlUi.columnEditable(newColumn)"
                                      class="mr-2 mt-0"
                                      dense
                                      hide-details
                                      label="PK"
                                      @input="newColumn.altered = newColumn.altered || 2"
                                    >
                                      <template #label>
                                        <span class="caption font-weight-bold">PK</span>
                                      </template>
                                    </v-checkbox>
                                  </div>
                                </template>
                                <span>Primary Key</span>
                              </v-tooltip>

                              <v-tooltip bottom z-index="99999">
                                <template #activator="{on}">
                                  <div v-on="on">
                                    <v-checkbox

                                      v-model="newColumn.ai"
                                      :disabled="sqlUi.colPropUNDisabled(newColumn) || !sqlUi.columnEditable(newColumn)"
                                      class="mr-2 mt-0"
                                      dense
                                      hide-details
                                      label="AI"
                                      @input="newColumn.altered = newColumn.altered || 2"
                                    >
                                      <template #label>
                                        <span class="caption font-weight-bold">AI</span>
                                      </template>
                                    </v-checkbox>
                                  </div>
                                </template>
                                <span>Auto Increment</span>
                              </v-tooltip>

                              <v-tooltip bottom z-index="99999">
                                <template #activator="{on}">
                                  <div v-on="on">
                                    <v-checkbox
                                      v-model="newColumn.un"
                                      class="mr-2 mt-0"
                                      dense
                                      hide-details
                                      label="UN"
                                      :disabled="sqlUi.colPropUNDisabled(newColumn) || !sqlUi.columnEditable(newColumn)"
                                      @input="newColumn.altered = newColumn.altered || 2"
                                    >
                                      <template #label>
                                        <span class="caption font-weight-bold">UN</span>
                                      </template>
                                    </v-checkbox>
                                  </div>
                                </template>
                                <span>Unsigned</span>
                              </v-tooltip>

                              <v-tooltip bottom z-index="99999">
                                <template #activator="{on}">
                                  <div v-on="on">
                                    <v-checkbox
                                      v-model="newColumn.au"
                                      class="mr-2 mt-0"
                                      dense
                                      hide-details
                                      label="UN"
                                      :disabled=" sqlUi.colPropAuDisabled(newColumn) || !sqlUi.columnEditable(newColumn)"
                                      @input="newColumn.altered = newColumn.altered || 2"
                                    >
                                      <template #label>
                                        <span class="caption font-weight-bold">AU</span>
                                      </template>
                                    </v-checkbox>
                                  </div>
                                </template>
                                <span>Auto Update Timestamp</span>
                              </v-tooltip>
                            </div>
                          </v-col>
                          <v-col cols="12">
                            <v-autocomplete
                              v-model="newColumn.dt"
                              hide-details
                              class="caption data-type"
                              label="Type in Database"
                              dense
                              outlined
                              :items="dataTypes"
                              @change="onDataTypeChange"
                            />
                          </v-col>

                          <v-col :cols="sqlUi.showScale(newColumn) && !isSelect ? 6 : 12">
                            <v-text-field
                              v-if="!isSelect"
                              v-model="newColumn.dtxp"
                              dense
                              :disabled="sqlUi.getDefaultLengthIsDisabled(newColumn.dt) || !sqlUi.columnEditable(newColumn)"
                              class="caption"
                              label="Length / Values"
                              outlined
                              hide-details
                              @input="newColumn.altered = newColumn.altered || 2"
                            />
                          </v-col>
                          <v-col v-if="sqlUi.showScale(newColumn)" :cols="isSelect ?12 : 6">
                            <v-text-field
                              v-model="newColumn.dtxs"
                              dense
                              :disabled=" !sqlUi.columnEditable(newColumn)"
                              class="caption"
                              label="Scale"
                              outlined
                              hide-details
                              @input="newColumn.altered = newColumn.altered || 2"
                            />
                          </v-col>

                          <v-col cols="12">
                            <v-textarea
                              v-model="newColumn.cdf"
                              label="Default value"
                              :hint="sqlUi.getDefaultValueForDatatype(newColumn.dt)"
                              persistent-hint
                              rows="3"
                              outlined
                              dense
                              class="caption"
                              @input="newColumn.altered = newColumn.altered || 2"
                            />
                          </v-col>
                        </v-row>
                      </v-container>
                    </v-col>
                  </template>
                </template>
                <template v-else>
                  <v-col cols="12">
                    <formula-options
                      ref="formula"
                      :column="newColumn"
                      :nodes="nodes"
                      :meta="meta"
                      :is-s-q-lite="isSQLite"
                      :alias="newColumn.cn"
                      :is-m-s-s-q-l="isMSSQL"
                      :sql-ui="sqlUi"
                      v-on="$listeners"
                    />

                    <!--                  <v-autocomplete
                      label="Formula"
                      hide-details
                      class="caption formula-type"
                      outlined
                      dense
                      :items="formulas"
                    >
                      <template #item="{item}">
                        <span class="green&#45;&#45;text text&#45;&#45;darken-2 caption font-weight-regular">{{ item }}</span>
                      </template>
                    </v-autocomplete>-->
                  </v-col>
                </template>
              </template>

              <div class="disabled-info" :class="{'d-none':!isEditDisabled}">
                <v-alert dense type="warning" icon="info" class="caption mx-2" outlined>
                  This spreadsheet is connected to an SQLite DB.<br>
                  For production please see <a
                    href="https://github.com/nocodb/nocodb#production-setup"
                    target="_blank"
                  >here</a>.
                </v-alert>
              </div>
            </v-row>
          </v-container>
        </v-row>
      </v-container>
    </v-form>
    <dlg-label-submit-cancel
      v-if="relationDeleteDlg"
      type="primary"
      :dialog-show="relationDeleteDlg"
      :actions-mtd="deleteRelation"
      heading="Click Submit to Delete the Relation"
    />
  </v-card>
</template>

<script>
import RollupOptions from './editColumn/rollupOptions'
import FormulaOptions from '@/components/project/spreadsheet/components/editColumn/formulaOptions'
import LookupOptions from '@/components/project/spreadsheet/components/editColumn/lookupOptions'
import { uiTypes } from '@/components/project/spreadsheet/helpers/uiTypes'
import CustomSelectOptions from '@/components/project/spreadsheet/components/editColumn/customSelectOptions'
import RelationOptions from '@/components/project/spreadsheet/components/editColumn/relationOptions'
import DlgLabelSubmitCancel from '@/components/utils/dlgLabelSubmitCancel'
import LinkedToAnotherOptions from '@/components/project/spreadsheet/components/editColumn/linkedToAnotherOptions'
import { SqliteUi, MssqlUi } from '@/helpers/sqlUi'

export default {
  name: 'EditColumn',
  components: {
    RollupOptions,
    FormulaOptions,
    LookupOptions,
    LinkedToAnotherOptions,
    DlgLabelSubmitCancel,
    RelationOptions,
    CustomSelectOptions
  },
  props: {
    nodes: Object,
    sqlUi: [Object, Function],
    meta: Object,
    editColumn: Boolean,
    column: Object,
    columnIndex: Number,
    value: Boolean
  },
  data: () => ({
    valid: false,
    relationDeleteDlg: false,
    newColumn: {},
    uiTypes
  }),
  computed: {
    isEditDisabled() {
      return this.editColumn && this.sqlUi === SqliteUi
    },
    isSQLite() {
      return this.sqlUi === SqliteUi
    },
    isMSSQL() {
      return this.sqlUi === MssqlUi
    },
    dataTypes() {
      return this.sqlUi.getDataTypeListForUiType(this.newColumn)
    },
    isSelect() {
      return this.newColumn && (this.newColumn.uidt === 'MultiSelect' ||
        this.newColumn.uidt === 'SingleSelect')
    },
    isRelation() {
      return this.newColumn && this.newColumn.uidt === 'ForeignKey'
    },
    isLinkToAnotherRecord() {
      return this.newColumn && this.newColumn.uidt === 'LinkToAnotherRecord'
    },
    isLookup() {
      return this.newColumn && this.newColumn.uidt === 'Lookup'
    },
    isRollup() {
      return this.newColumn && this.newColumn.uidt === 'Rollup'
    },
    relation() {
      return this.meta && this.column && this.meta.belongsTo && this.meta.belongsTo.find(bt => bt.cn === this.column.cn)
    },
    isVirtual() {
      return this.isLinkToAnotherRecord || this.isLookup || this.isRollup
    }
  },
  watch: {
    column() {
      this.genColumnData()
    }
  },
  async created() {
    this.genColumnData()
    // await this.loadDataTypes();
  },
  mounted() {
    this.focusInput()
  },
  methods: {
    onRelColumnSelect(colMeta) {
      Object.assign(this.newColumn, {
        dt: colMeta.dt,
        dtxp: colMeta.dtxp,
        dtxs: colMeta.dtxs,
        un: colMeta.un
      })
    },
    genColumnData() {
      this.newColumn = this.column ? { ...this.column } : this.sqlUi.getNewColumn([...this.meta.columns, ...(this.meta.v || [])].length + 1)
      this.newColumn.cno = this.newColumn.cn
    },
    /*
      async loadDataTypes() {
          try {
            const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            }, 'getKnexDataTypes', {}])

            this.dataTypes = result.data.list;
          } catch (e) {
            this.$toast.error('Error loading datatypes :' + e).goAway(4000);
            throw e;
          }
        },
        */
    close() {
      this.$emit('close')
      this.newColumn = {}
    },
    async save() {
      if (!this.$refs.form.validate()) {
        return
      }
      try {
        // if (this.newColumn.uidt === 'Formula') {
        //   return this.$toast.info('Coming Soon...').goAway(3000)
        // }

        if (this.isLinkToAnotherRecord && this.$refs.relation) {
          await this.$refs.relation.saveRelation()
          return this.$emit('saved')
        }
        if (this.isLookup && this.$refs.lookup) {
          return await this.$refs.lookup.save()
        }
        if (this.isRollup && this.$refs.rollup) {
          return await this.$refs.rollup.save()
        }
        if (this.newColumn.uidt === 'Formula' && this.$refs.formula) {
          return await this.$refs.formula.save()
        }

        this.newColumn.tn = this.nodes.tn
        this.newColumn._cn = this.newColumn.cn

        const columns = [...this.meta.columns]

        if (columns.length) {
          columns[0].tn = this.nodes.tn
        }

        if (this.editColumn) {
          columns[this.columnIndex] = this.newColumn
        } else {
          columns.push(this.newColumn)
        }

        await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableUpdate', {
          tn: this.nodes.tn,
          _tn: this.meta._tn,
          originalColumns: this.meta.columns,
          columns
        }])

        if (this.isRelation && this.$refs.relation) {
          await this.$refs.relation.saveRelation()
        }

        this.$emit('saved', this.newColumn._cn)
      } catch (e) {
        console.log(e)
      }

      this.$emit('close')
    },
    onDataTypeChange() {
      this.newColumn.rqd = false
      this.newColumn.pk = false
      this.newColumn.ai = false
      this.newColumn.cdf = null
      this.newColumn.un = false
      this.newColumn.dtxp = this.sqlUi.getDefaultLengthForDatatype(this.newColumn.dt)
      this.newColumn.dtxs = this.sqlUi.getDefaultScaleForDatatype(this.newColumn.dt)

      this.newColumn.dtx = 'specificType'

      // this.$set(this.newColumn, 'uidt', this.sqlUi.getUIType(this.newColumn));

      this.newColumn.altered = this.newColumn.altered || 2
    },
    onUiTypeChange() {
      const colProp = this.sqlUi.getDataTypeForUiType(this.newColumn)
      this.newColumn = {
        ...this.newColumn,
        rqd: false,
        pk: false,
        ai: false,
        cdf: null,
        un: false,
        dtx: 'specificType',
        ...colProp
      }

      this.newColumn.dtxp = this.sqlUi.getDefaultLengthForDatatype(this.newColumn.dt)
      this.newColumn.dtxs = this.sqlUi.getDefaultScaleForDatatype(this.newColumn.dt)

      this.newColumn.altered = this.newColumn.altered || 2
    },
    focusInput() {
      setTimeout(() => {
        if (this.$refs.column && this.$refs.column.$el) {
          this.$refs.column.$el.querySelector('input').focus()
        }
      }, 100)
    },
    async deleteRelation(action = '', column) {
      try {
        if (action === 'showDialog') {
          this.relationDeleteDlg = true
        } else if (action === 'hideDialog') {
          this.relationDeleteDlg = false
        } else {
          const result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            this.relation.type === 'virtual' ? 'xcVirtualRelationDelete' : 'relationDelete',
            {
              childColumn: this.relation.cn,
              childTable: this.nodes.tn,
              parentTable: this.relation
                .rtn,
              parentColumn: this.relation
                .rcn
            }
          ])
          console.log('relationDelete result ', result)
          // await this.loadColumnList();
          this.relationDeleteDlg = false
          this.relation = null
          this.$toast.success('Foreign Key deleted successfully').goAway(3000)
          this.$emit('onRelationDelete')
        }
      } catch (e) {
        console.log(e)
        this.$toast.error('Foreign key relation delete failed' + e).goAway(3000)
        throw e
      }
    }
  }

}
</script>

<style scoped lang="scss">

::v-deep {
  .wrapper {
    border: solid 2px #7f828b33;
    border-radius: 4px;
  }

  .v-input__slot {
    min-height: auto !important;
  }

  .v-input:not(.v-input--is-focused) fieldset {
    border-color: #7f828b33 !important;
  }

  .data-type, .ui-type, .formula-type {
    .v-input__append-inner {
      margin-top: 4px !important;
    }
  }

  .ui-type input {
    height: 24px;
  }

  .v-input--selection-controls__input > i {
    transform: scale(.83);
  }

  label {
    font-size: 0.75rem !important
  }

  .v-text-field--outlined.v-input--dense .v-label:not(.v-label--active) {
    top: 6px;
  }
}

.card {
  border: solid 2px #7f828b33;
}

.wrapper {
  border: solid 2px #7f828b33;
  border-radius: 4px;
}

.editDisabled {
  position: relative;

  .disabled-info {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    bottom: 0;
    background: var(--v-backgroundColor-base);
    opacity: .9;

    & > * {
      opacity: 1;
    }
  }
}

</style>
