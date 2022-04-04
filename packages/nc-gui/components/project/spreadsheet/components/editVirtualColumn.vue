<template>
  <v-card
    min-width="300px"
    max-width="400px"
    max-height="95vh"
    style="overflow: auto"
    class=" card nc-col-create-or-edit-card"
  >
    <v-form v-model="valid">
      <v-container fluid @click.stop.prevent>
        <v-row>
          <v-col cols="12">
            <v-text-field
              ref="column"
              v-model="newColumn.title"
              hide-details="auto"
              color="primary"
              class="caption nc-column-name-input"
              :label="$t('labels.columnName')"
              :rules="[
                v => !!v || 'Required',
                v => !meta || !meta.columns || !column ||meta.columns.every(c => column === c || (v !== c.title)) || 'Duplicate column name',
                validateColumnName
              ]"
              dense
              outlined
            />
          </v-col>
          <v-col v-if="newColumn && newColumn.uidt === UITypes.Formula" cols="12">
            <formula-options
              ref="formula"
              v-model="newColumn.formula_raw"
              :column="column"
              :new-column="newColumn"
              :nodes="nodes"
              :meta="meta"
              :alias="newColumn.title"
              :sql-ui="sqlUi"
            />
          </v-col>
          <v-col cols="12" class="d-flex pt-0">
            <v-spacer />
            <v-btn
              x-small
              outlined
              @click="close"
            >
              <!-- Cancel -->
              {{ $t('general.cancel') }}
            </v-btn>
            <v-btn
              v-t="['virtual:column:edit']"
              x-small
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
  </v-card>
</template>

<script>
import { UITypes, substituteColumnIdWithAliasInFormula } from 'nocodb-sdk'
import FormulaOptions from '@/components/project/spreadsheet/components/editColumn/formulaOptions'
import { validateColumnName } from '~/helpers'

export default {
  name: 'EditVirtualColumn',
  components: { FormulaOptions },
  props: {
    nodes: Object,
    meta: Object,
    value: Boolean,
    column: Object,
    sqlUi: [Function, Object]
  },
  data: () => ({
    valid: false,
    newColumn: {},
    UITypes
  }),
  watch: {
    column(c) {
      const { colOptions, ...rest } = c
      this.newColumn = rest

      if (rest.uidt === UITypes.Formula) {
        this.newColumn.formula_raw = substituteColumnIdWithAliasInFormula(colOptions.formula, this.meta.columns, colOptions.formula_raw)
      }
    }
  },
  async created() {
  },
  mounted() {
    const { colOptions, ...rest } = this.column
    this.newColumn = rest

    if (rest.uidt === UITypes.Formula) {
      this.newColumn.formula_raw = substituteColumnIdWithAliasInFormula(colOptions.formula, this.meta.columns, colOptions.formula_raw)
    }
  },
  methods: {
    close() {
      this.$emit('input', false)
      this.newColumn = {}
    },
    async save() {
      // todo: rollup update
      try {
        await this.$api.dbTableColumn.update(this.meta.id, this.column.id, this.newColumn)
      } catch (e) {
        console.log(this._extractSdkResponseErrorMsg(e))
        this.$toast.error('Failed to update column alias').goAway(3000)
      }
      this.$emit('saved', this.newColumn.title, this.column.title)
      this.$emit('input', false)
    },

    focusInput() {
      setTimeout(() => {
        if (this.$refs.column && this.$refs.column.$el) {
          this.$refs.column.$el.querySelector('input').focus()
        }
      }, 100)
    },
    validateColumnName(v) {
      if (this.column.hm || this.column.mm || this.column.bt || this.column.lk) { return true }

      return validateColumnName(v, this.$store.getters['project/GtrProjectIsGraphql'])
    }
  }
}
</script>

<style scoped lang="scss">

::v-deep {

  .v-input__slot {
    min-height: auto !important;
  }

  .v-input:not(.v-input--is-focused) fieldset {
    border-color: #7f828b33 !important;
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

</style>
