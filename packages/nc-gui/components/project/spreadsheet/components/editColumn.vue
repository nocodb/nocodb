<template>
  <v-card
    min-width="300px"
    max-width="400px"
    max-height="95vh"
    style="overflow: auto"
    class=" card nc-col-create-or-edit-card "
  >
    <v-form ref="form" v-model="valid">
      <v-container fluid @click.stop.prevent>
        <v-row>
          <v-col cols="12" class="mt-2">
            <v-text-field
              ref="column"
              v-model="newColumn.column_name"
              hide-details="auto"
              color="primary"
              :rules="[
                v => !!v || 'Required',
                v => !meta || !meta.columns || meta.columns.every(c => column && (c.column_name || '').toLowerCase() === (column.column_name || '').toLowerCase() ||(
                  (v||'').toLowerCase() !== (c.column_name||'').toLowerCase() && (v||'').toLowerCase() !== (c.title||'').toLowerCase())) || 'Duplicate column name' ,// && meta.v.every(c => v !== c.title ) || 'Duplicate column name',
                validateColumnName
              ]"
              class="caption nc-column-name-input"
              :label="$t('labels.columnName')"
              dense
              outlined
              @input="newColumn.altered = newColumn.altered || 8"
              @keyup.enter="save"
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
                  <!--label: Column Type-->
                  <v-autocomplete
                    v-model="newColumn.uidt"
                    hide-details
                    item-value="name"
                    item-text="name"
                    class="caption ui-type nc-ui-dt-dropdown"
                    :class="{'primary lighten-5' : newColumn.uidt }"
                    :label="$t('labels.columnType')"
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

                  <v-alert
                    v-if="column && newColumn.uidt === 'SingleSelect' && column.uidt === 'MultiSelect'"
                    dense
                    type="warning"
                    class="caption warning--text mt-2 mb-n4 pa-1"
                    outlined
                  >
                    <template #prepend>
                      <v-icon small class="mx-2" color="warning">
                        mdi-alert-outline
                      </v-icon>
                    </template>
                    Changing MultiSelect to SingleSelect can lead to errors when there are multiple values associated
                    with a cell
                  </v-alert>
                </v-col>

                <v-col v-if="isSelect" cols="12">
                  <custom-select-options
                    v-model="newColumn.dtxp"
                    @input="newColumn.altered = newColumn.altered || 2"
                  />
                </v-col>
                <v-col v-if="accordion" cols="12" class="pt-0" :class="{'pb-0': advanceOptions}">
                  <div
                    class="pointer grey--text text-right caption nc-more-options"
                    @click="advanceOptions = !advanceOptions"
                  >
                    {{ advanceOptions ? $t('general.hideAll') : $t('general.showMore') }}
                    <v-icon x-small color="grey">
                      mdi-{{ advanceOptions ? 'minus' : 'plus' }}-circle-outline
                    </v-icon>
                  </div>
                </v-col>

                <v-col v-show="advanceOptions || !accordion" cols="12">
                  <v-row>
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
                          :alias="newColumn.column_name"
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
                          :alias="newColumn.column_name"
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
                          :alias="newColumn.column_name"
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
                          :alias="alias"
                          :column="newColumn"
                          :nodes="nodes"
                          :is-m-s-s-q-l="isMSSQL"
                          :is-s-q-lite="isSQLite"
                          @onColumnSelect="onRelColumnSelect"
                        />
                      </v-col>

                      <template v-if="newColumn.column_name && newColumn.uidt && !isVirtual">
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
                                          @change="newColumn.altered = newColumn.altered || 2"
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
                                          @change="newColumn.altered = newColumn.altered || 2"
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
                                          @change="newColumn.altered = newColumn.altered || 2"
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
                                          @change="newColumn.altered = newColumn.altered || 2"
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
                                          @change="newColumn.altered = newColumn.altered || 2"
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
                                <!--label="Type in Database"-->
                                <v-autocomplete
                                  v-model="newColumn.dt"
                                  hide-details
                                  class="caption data-type"
                                  :label="$t('labels.databaseType')"
                                  dense
                                  outlined
                                  :items="dataTypes"
                                  @change="onDataTypeChange"
                                />
                              </v-col>

                              <v-col :cols="sqlUi.showScale(newColumn) && !isSelect ? 6 : 12">
                                <!--label="Length / Values"-->
                                <v-text-field
                                  v-if="!isSelect"
                                  v-model="newColumn.dtxp"
                                  dense
                                  :disabled="sqlUi.getDefaultLengthIsDisabled(newColumn.dt) || !sqlUi.columnEditable(newColumn)"
                                  class="caption"
                                  :label="$t('labels.lengthValue')"
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
                                  :label="$t('placeholder.defaultValue')"
                                  :hint="sqlUi.getDefaultValueForDatatype(newColumn.dt)"
                                  persistent-hint
                                  rows="3"
                                  outlined
                                  dense
                                  class="caption"
                                  @input="(newColumn.altered = newColumn.altered || 2); (newColumn.cdf = newColumn.cdf || null);"
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
                          :alias="newColumn.column_name"
                          :is-m-s-s-q-l="isMSSQL"
                          :sql-ui="sqlUi"
                          v-on="$listeners"
                        />
                      </v-col>
                    </template>
                  </v-row>
                </v-col>
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
          <v-col cols="12" class="d-flex pt-0">
            <v-spacer />
            <v-btn
              small
              outlined
              @click="close"
            >
              <!-- Cancel -->
              {{ $t('general.cancel') }}
            </v-btn>
            <v-btn
              small
              color="primary"
              :disabled="!valid"
              @click="save"
            >
              <!-- Save -->
              {{ $t('general.save') }}
            </v-btn>
          </v-col>
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
import { MssqlUi, SqliteUi } from 'nocodb-sdk'
import { UITypes, uiTypes } from '../helpers/uiTypes'
import RollupOptions from './editColumn/rollupOptions'
import FormulaOptions from '@/components/project/spreadsheet/components/editColumn/formulaOptions'
import LookupOptions from '@/components/project/spreadsheet/components/editColumn/lookupOptions'
import CustomSelectOptions from '@/components/project/spreadsheet/components/editColumn/customSelectOptions'
import RelationOptions from '@/components/project/spreadsheet/components/editColumn/relationOptions'
import DlgLabelSubmitCancel from '@/components/utils/dlgLabelSubmitCancel'
import LinkedToAnotherOptions from '@/components/project/spreadsheet/components/editColumn/linkedToAnotherOptions'
import { validateColumnName } from '~/helpers'

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
    advanceOptions: false
  }),
  computed: {
    accordion() {
      return ![UITypes.LinkToAnotherRecord, UITypes.Lookup, UITypes.Rollup, UITypes.SpecificDBType, UITypes.Formula].includes(this.newColumn && this.newColumn.uidt)
    },
    uiTypes() {
      return uiTypes.filter(t => !this.editColumn || !t.virtual)
    },
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
      return this.meta && this.column && this.meta.belongsTo && this.meta.belongsTo.find(bt => bt.column_name === this.column.column_name)
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
  },
  mounted() {
    this.focusInput()
  },
  methods: {
    validateColumnName(v) {
      return validateColumnName(v, this.$store.getters['project/GtrProjectIsGraphql'])
    },
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
      this.newColumn.cno = this.newColumn.column_name
    },
    close() {
      this.$emit('close')
      this.newColumn = {}
    },
    async save() {
      if (!this.$refs.form.validate()) {
        return
      }
      try {
        if (this.newColumn.uidt === 'Formula') {
          await this.$refs.formula.save()
          return this.$emit('saved')
          // return this.$toast.info('Coming Soon...').goAway(3000)
        }

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

        this.newColumn.table_name = this.nodes.table_name
        this.newColumn.title = this.newColumn.column_name

        if (this.editColumn) {
          await this.$api.dbTableColumn.update(this.meta.id, this.column.id, this.newColumn)
        } else {
          await this.$api.dbTableColumn.create(this.meta.id, this.newColumn)
        }

        this.$emit('saved', this.newColumn.title, this.editColumn ? this.meta.columns[this.columnIndex].title : null)
      } catch (e) {
        console.log(e)
      }

      this.$emit('close')

      this.$tele.emit(`column:edit:save:${this.newColumn.uidt}`)
    },
    onDataTypeChange() {
      this.newColumn.rqd = false
      if (this.newColumn.uidt !== UITypes.ID) {
        this.newColumn.primaryKey = false
      }
      this.newColumn.ai = false
      this.newColumn.cdf = null
      this.newColumn.un = false
      this.newColumn.dtxp = this.sqlUi.getDefaultLengthForDatatype(this.newColumn.dt)
      this.newColumn.dtxs = this.sqlUi.getDefaultScaleForDatatype(this.newColumn.dt)

      this.newColumn.dtx = 'specificType'

      const selectTypes = [UITypes.MultiSelect, UITypes.SingleSelect]
      if (this.column && selectTypes.includes(this.newColumn.uidt) && selectTypes.includes(this.column.uidt)) {
        this.newColumn.dtxp = this.column.dtxp
      }

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

      const selectTypes = [UITypes.MultiSelect, UITypes.SingleSelect]
      if (this.column && selectTypes.includes(this.newColumn.uidt) && selectTypes.includes(this.column.uidt)) {
        this.newColumn.dtxp = this.column.dtxp
      }

      this.newColumn.altered = this.newColumn.altered || 2
    },
    focusInput() {
      setTimeout(() => {
        if (this.$refs.column && this.$refs.column.$el) {
          const el = this.$refs.column.$el.querySelector('input')
          el.focus()
          el.select()
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
              childColumn: this.relation.column_name,
              childTable: this.nodes.table_name,
              parentTable: this.relation
                .rtn,
              parentColumn: this.relation
                .rcn
            }
          ])
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
  //border: solid 2px #7f828b33;
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
