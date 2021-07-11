<template>
  <v-card min-width="300px" max-width="400px" max-height="95vh" style="overflow: auto"
          class="elevation-0 card">
    <v-form v-model="valid">
      <v-container fluid @click.stop.prevent>
        <v-row>
          <v-col cols="12" class="d-flex pb-0">

            <v-spacer></v-spacer>
            <v-btn x-small outlined @click="close">Cancel</v-btn>
            <v-btn x-small color="primary" @click="save" :disabled="!valid">Save</v-btn>
          </v-col>
          <v-col cols="12">
            <v-text-field
              ref="column"
              hide-details="auto"
              color="primary"
              v-model="newColumn._cn"
              class="caption"
              label="Column name"
              :rules="[
                    v => !!v  || 'Required',
                    v => !meta || !meta.columns || !column ||meta.columns.every(c => v !== c.cn ) && meta.v.every(c => column && c._cn === column._cn || v !== c._cn ) || 'Duplicate column name'
              ]"
              dense outlined></v-text-field>
          </v-col>


        </v-row>
      </v-container>
    </v-form>


  </v-card>
</template>

<script>
export default {
  name: "editVirtualColumn",
  components: {},
  props: {
    nodes: Object,
    meta: Object,
    value: Boolean,
    column: Object
  },
  data: () => ({
    valid: false,
    newColumn: {}
  }),
  async created() {
  },
  methods: {
    close() {
      this.$emit('input', false);
      this.newColumn = {};
    },
    async save() {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcUpdateVirtualKeyAlias', {
          tn: this.nodes.tn,
          oldAlias: this.column._cn,
          newAlias: this.newColumn._cn,
        }]);

        this.$toast.success('Successfully updated alias').goAway(3000);
      } catch (e) {
        console.log(e)
        this.$toast.error('Failed to update column alias').goAway(3000);
      }
      this.$emit('saved');
      this.$emit('input', false);
    },

    focusInput() {
      setTimeout(() => {
        if (this.$refs.column && this.$refs.column.$el) {
          this.$refs.column.$el.querySelector('input').focus()
        }
      }, 100);
    },

  }, mounted() {
    this.newColumn = {...this.column}
  }, watch: {
    column(c) {
      this.newColumn = {...c}
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
