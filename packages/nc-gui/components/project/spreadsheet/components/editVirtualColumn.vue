<template>
  <v-card
    min-width="300px"
    max-width="400px"
    max-height="95vh"
    style="overflow: auto"
    class="elevation-0 card nc-col-create-or-edit-card"
  >
    <v-form v-model="valid">
      <v-container fluid @click.stop.prevent>
        <v-row>
          <v-col cols="12" class="d-flex pb-0">
            <v-spacer />
            <v-btn x-small outlined @click="close">
              Cancel
            </v-btn>
            <v-btn x-small color="primary" :disabled="!valid" @click="save">
              Save
            </v-btn>
          </v-col>
          <v-col cols="12">
            <v-text-field
              ref="column"
              v-model="newColumn._cn"
              hide-details="auto"
              color="primary"
              class="caption nc-column-name-input"
              label="Column name"
              :rules="[
                v => !!v || 'Required',
                v => !meta || !meta.columns || !column ||meta.columns.every(c => v !== c.cn ) && meta.v.every(c => column && c._cn === column._cn || v !== c._cn ) || 'Duplicate column name'
              ]"
              dense
              outlined
            />
          </v-col>

          <v-col v-if="column.formula" cols="12">
            <formula-options
              ref="formula"
              :value="column.formula"
              :column="column"
              :new-column="newColumn"
              :nodes="nodes"
              :meta="meta"
              :alias="newColumn._cn"
              :sql-ui="sqlUi"
            />
          </v-col>
        </v-row>
      </v-container>
    </v-form>
  </v-card>
</template>

<script>
import FormulaOptions from '@/components/project/spreadsheet/components/editColumn/formulaOptions'

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
    newColumn: {}
  }),
  watch: {
    column(c) {
      this.newColumn = { ...c }
    }
  },
  async created() {
  },
  mounted() {
    this.newColumn = { ...this.column }
  },
  methods: {
    close() {
      this.$emit('input', false)
      this.newColumn = {}
    },
    async save() {
      // todo: rollup update
      try {
        if (this.column.formula) {
          await this.$refs.formula.update()
        } else {
          await this.$store.dispatch('sqlMgr/ActSqlOp', [{
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          }, 'xcUpdateVirtualKeyAlias', {
            tn: this.nodes.tn,
            oldAlias: this.column._cn,
            newAlias: this.newColumn._cn
          }])

          this.$toast.success('Successfully updated alias').goAway(3000)
        }
      } catch (e) {
        console.log(e)
        this.$toast.error('Failed to update column alias').goAway(3000)
      }
      this.$emit('saved', this.newColumn._cn)
      this.$emit('input', false)
    },

    focusInput() {
      setTimeout(() => {
        if (this.$refs.column && this.$refs.column.$el) {
          this.$refs.column.$el.querySelector('input').focus()
        }
      }, 100)
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
  border: solid 2px #7f828b33;
}

</style>
