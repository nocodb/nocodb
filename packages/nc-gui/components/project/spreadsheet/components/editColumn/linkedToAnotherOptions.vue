<template>
  <div>
    <v-container fluid class="wrapper mb-3">
      <v-row>
        <v-col>
          <v-radio-group
            v-model="type"
            row
            hide-details
            dense
            class="pt-0 mt-0"
            @change="$refs.input.validate()"
          >
            <v-radio value="hm" label="Has Many" />
            <v-radio value="mm" label="Many To Many" />
          </v-radio-group>
        </v-col>
        <v-col cols="12">
          <v-autocomplete
            ref="input"
            v-model="relation.childId"
            outlined
            class="caption"
            hide-details="auto"
            :loading="isRefTablesLoading"
            :label="$t('labels.childTable')"
            :full-width="false"
            :items="refTables"
            item-text="title"
            item-value="id"
            required
            dense
            :rules="tableRules"
          />
        </v-col>
      </v-row>
    </v-container>
    <v-container fluid class=" mb-3">
      <v-row>
        <v-col cols="12" class="pt-0" :class="{'pb-0': advanceOptions}">
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
      </v-row>
    </v-container>

    <v-container v-show="advanceOptions" fluid class="wrapper">
      <v-row>
      </v-row>
      <template v-if="!isSQLite">
        <v-row>
          <v-col cols="6">
            <v-autocomplete
              v-model="relation.onUpdate"
              outlined
              class="caption"
              hide-details
              :label="$t('labels.onUpdate')"
              :full-width="false"
              :items="onUpdateDeleteOptions"
              required
              dense
              :disabled="relation.type !== 'real'"
            />
          </v-col>
          <v-col cols="6">
            <v-autocomplete
              v-model="relation.onDelete"
              outlined
              class="caption"
              hide-details
              :label="$t('labels.onDelete')"
              :full-width="false"
              :items="onUpdateDeleteOptions"
              required
              dense
              :disabled="relation.type !== 'real'"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-checkbox
              v-model="relation.type"
              false-value="real"
              true-value="virtual"
              label="Virtual Relation"
              :full-width="false"
              required
              class="mt-0"
              dense
            />
          </v-col>
        </v-row>
      </template>
    </v-container>
  </div>
</template>

<script>
import { ModelTypes, UITypes } from 'nocodb-sdk'

export default {
  name: 'LinkedToAnotherOptions',
  props: ['nodes', 'column', 'meta', 'isSQLite', 'alias'],
  data: () => ({
    type: 'hm',
    refTables: [],
    refColumns: [],
    relation: {},
    isRefTablesLoading: false,
    isRefColumnsLoading: false,
    advanceOptions: false
  }),
  computed: {
    onUpdateDeleteOptions() {
      if (this.isMSSQL) {
        return ['NO ACTION']
      }
      return [
        'NO ACTION',
        'CASCADE',
        'RESTRICT',
        'SET NULL',
        'SET DEFAULT'
      ]
    },
    tableRules() {
      return []
    }
  },
  async created() {
    await this.loadTablesList()
    this.relation = {
      parentId: null,
      childID: null,
      childColumn: `${this.meta.table_name}_id`,
      childTable: this.nodes.table_name,
      parentTable: this.column.rtn || '',
      parentColumn: this.column.rcn || '',
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION',
      updateRelation: !!this.column.rtn,
      relationType: 'real'
    }
  },
  methods: {
    async loadTablesList() {
      this.isRefTablesLoading = true

      const result = (await this.$api.dbTable.list(this.$store.state.project.projectId, this.$store.state.project.project.bases[0].id))
        .list.filter(t => t.type === ModelTypes.TABLE)

      this.refTables = result // .data.list.map(({ table_name, title }) => ({ table_name, title }))
      this.isRefTablesLoading = false
    },
    async saveRelation() {
      await this.$api.dbTableColumn.create(this.meta.id, {
        ...this.relation,
        parentId: this.meta.id,
        uidt: UITypes.LinkToAnotherRecord,
        title: this.alias,
        type: this.type
      })

      await this.$store.dispatch('meta/ActLoadMeta', { id: this.relation.childId, force: true })
    },
    onColumnSelect() {
      const col = this.refColumns.find(c => this.relation.parentColumn === c.column_name)
      this.$emit('onColumnSelect', col)
    }
  }

}
</script>

<style scoped>

.wrapper {
  border: solid 2px #7f828b33;
  border-radius: 4px;
}

/deep/ .v-input__append-inner {
  margin-top: 4px !important;
}
</style>
