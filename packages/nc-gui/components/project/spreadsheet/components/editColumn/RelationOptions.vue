<template>
  <v-container fluid class="wrapper">
    <v-row>
      <v-col cols="6">
        <v-autocomplete
          v-model="relation.parentTable"
          :rules="[v=>!!v || 'Reference Table required']"
          outlined
          class="caption"
          hide-details
          :loading="isRefTablesLoading"
          label="Reference Table"
          :full-width="false"
          :items="refTables"
          item-text="title"
          item-value="table_name"
          required
          dense
          @change="loadColumnList"
        />
      </v-col>
      <v-col cols="6">
        <v-autocomplete
          ref="parentColumnRef"
          v-model="relation.parentColumn"
          :rules="[v=>!!v || 'Reference Column required']"
          outlined
          class="caption"
          hide-details
          :loading="isRefColumnsLoading"
          label="Reference Column"
          :full-width="false"
          :items="refColumns"
          item-text="title"
          item-value="column_name"
          required
          dense
          @change="onColumnSelect"
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="6">
        <v-autocomplete
          v-model="relation.onUpdate"
          outlined
          class="caption"
          hide-details
          label="On Update"
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
          label="On Delete"
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
          :disabled="isSQLite"
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
  </v-container>
</template>

<script>
export default {
  name: 'RelationOptions',
  props: ['nodes', 'column', 'isSQLite', 'isMSSQL', 'alias'],
  data: () => ({
    refTables: [],
    refColumns: [],
    relation: {},
    isRefTablesLoading: false,
    isRefColumnsLoading: false
  }),
  computed: {

    onUpdateDeleteOptions() {
      if (this.isMSSQL) {
        return [
          'NO ACTION']
      }
      return [
        'NO ACTION',
        'CASCADE',
        'RESTRICT',
        'SET NULL',
        'SET DEFAULT'
      ]
    }
  },
  watch: {
    'column.column_name'(c) {
      this.$set(this.relation, 'childColumn', c)
    },
    isSQLite(v) {
      this.$set(this.relation, 'type', v ? 'virtual' : 'real')
    }
  },
  async created() {
    await this.loadTablesList()
    this.relation = {
      childColumn: this.column.column_name,
      childTable: this.nodes.table_name,
      parentTable: this.column.rtn || '',
      parentColumn: this.column.rcn || '',
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION',
      updateRelation: !!this.column.rtn,
      type: this.isSQLite ? 'virtual' : 'real'
    }
  },
  mounted() {
    this.$set(this.relation, 'type', this.isSqlite ? 'virtual' : 'real')
  },
  methods: {
    async loadColumnList() {
      if (!this.relation.parentTable) { return }
      this.isRefColumnsLoading = true

      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'columnList', { table_name: this.relation.parentTable }])

      const columns = result.data.list
      this.refColumns = JSON.parse(JSON.stringify(columns))

      if (this.relation.updateRelation && !this.relationColumnChanged) {
        // only first time when editing add defaault value to this field
        this.relation.parentColumn = this.column.rcn
        this.relationColumnChanged = true
      } else {
        // find pk column and assign to parentColumn
        const pkKeyColumns = this.refColumns.filter(el => el.pk)
        this.relation.parentColumn = (pkKeyColumns[0] || {}).column_name || ''
      }
      this.onColumnSelect()

      this.isRefColumnsLoading = false
    },
    async loadTablesList() {
      this.isRefTablesLoading = true

      const result = await this.$store.dispatch('sqlMgr/ActSqlOp', [{
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      }, 'tableList'])

      this.refTables = result.data.list.map(({ table_name, title }) => ({ table_name, title }))
      this.isRefTablesLoading = false
    },
    async saveRelation() {
      // try {
      await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
        {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        },
        this.relation.type === 'real' && !this.isSQLite ? 'relationCreate' : 'xcVirtualRelationCreate',
        { alias: this.alias, ...this.relation }
      ])
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
