<template>
  <div>
    <v-container fluid class="wrapper">
      <v-row>
        <v-col cols="6">
          <v-autocomplete
            ref="input"
            v-model="rollup.table"
            outlined
            class="caption nc-rollup-table"
            hide-details="auto"
            :label="$t('labels.childTable')"
            :full-width="false"
            :items="refTables"
            item-text="title"
            :item-value="v => v"
            :rules="[v => !!v || 'Required']"
            dense
          >
            <template #item="{item}">
              <span class="caption"><span class="font-weight-bold"> {{
                item.title || item.table_name
              }}</span> <small>({{ relationNames[item.col.type] }})
              </small></span>
            </template>
          </v-autocomplete>
        </v-col>
        <v-col cols="6">
          <v-autocomplete
            ref="input"
            v-model="rollup.column"
            outlined
            class="caption  nc-rollup-column"
            hide-details="auto"
            :label="$t('labels.childColumn')"
            :full-width="false"
            :items="columnList"
            item-text="title"
            dense
            :loading="loadingColumns"
            :item-value="v => v"
            :rules="[v => !!v || 'Required']"
          />
        </v-col>
        <v-col cols="12">
          <v-autocomplete
            ref="aggrInput"
            v-model="rollup.fn"
            outlined
            class="caption  nc-rollup-fn"
            hide-details="auto"
            label="Aggregate function"
            :full-width="false"
            :items="aggrFunctionsList"
            dense
            :loading="loadingColumns"
            :rules="[v => !!v || 'Required']"
          />
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>

import { isSystemColumn, UITypes } from 'nocodb-sdk'

export default {
  name: 'RollupOptions',
  props: ['nodes', 'column', 'meta', 'isSQLite', 'alias'],
  data: () => ({
    rollup: {},
    loadingColumns: false,
    tables: [],
    relationNames: {
      mm: 'Many To Many',
      hm: 'Has Many'
      // bt: 'Belongs To'
    },
    aggrFunctionsList: [
      { text: 'count', value: 'count' },
      { text: 'min', value: 'min' },
      { text: 'max', value: 'max' },
      { text: 'avg', value: 'avg' },
      { text: 'min', value: 'min' },
      { text: 'sum', value: 'sum' },
      { text: 'countDistinct', value: 'countDistinct' },
      { text: 'sumDistinct', value: 'sumDistinct' },
      { text: 'avgDistinct', value: 'avgDistinct' }
    ]
  }),
  computed: {
    refTables() {
      if (!this.tables || !this.tables.length) { return [] }

      const refTables = this.meta.columns.filter(c =>
        c.uidt === UITypes.LinkToAnotherRecord && c.colOptions.type !== 'bt' && !c.system
      ).map(c => ({
        col: c.colOptions,
        ...this.tables.find(t => t.id === c.colOptions.fk_related_model_id)
      }))

      return refTables
    },
    columnList() {
      return ((
        this.rollup &&
        this.rollup.table &&
        this.$store.state.meta.metas &&
        this.$store.state.meta.metas[this.rollup.table.table_name] &&
        this.$store.state.meta.metas[this.rollup.table.table_name].columns
      ) || []).filter(col => ![UITypes.Lookup, UITypes.Rollup, UITypes.LinkToAnotherRecord].includes(col.uidt) && !isSystemColumn(col))
    }
  },
  async mounted() {
    await this.loadTablesList()
  },
  methods: {
    async loadTablesList() {
      const result = (await this.$api.dbTable.list(this.$store.state.project.projectId, this.$store.state.project.project.bases[0].id))

      this.tables = result.list
    },
    async onTableChange() {
      this.loadingColumns = true
      if (this.rollup.table) {
        try {
          await this.$store.dispatch('meta/ActLoadMeta', {
            dbAlias: this.nodes.dbAlias,
            env: this.nodes.env,
            id: this.rollup.table.id
          })
        } catch (e) {
          // ignore
        }
      }

      this.loadingColumns = false
    },
    async save() {
      try {
        const rollupCol = {
          title: this.alias,
          fk_relation_column_id: this.rollup.table.col.fk_column_id,
          fk_rollup_column_id: this.rollup.column.id,
          uidt: UITypes.Rollup,
          rollup_function: this.rollup.fn
        }

        await this.$api.dbTableColumn.create(this.meta.id, rollupCol)

        return this.$emit('saved', this.alias)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }
}
</script>

<style scoped>

</style>
