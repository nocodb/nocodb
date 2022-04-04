<template>
  <div>
    <v-container fluid class="wrapper">
      <v-row>
        <v-col cols="6">
          <v-autocomplete
            ref="input"
            v-model="lookup.table"
            outlined
            class="caption"
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
            v-model="lookup.column"
            outlined
            class="caption"
            hide-details="auto"
            :label="$t('labels.childColumn')"
            :full-width="false"
            :items="columnList"
            item-text="title"
            dense
            :loading="loadingColumns"
            :item-value="v => v"
            :rules="[v => !!v || 'Required',checkLookupExist]"
          />
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>

import { isSystemColumn, UITypes } from 'nocodb-sdk'

export default {
  name: 'LookupOptions',
  props: ['nodes', 'column', 'meta', 'isSQLite', 'alias'],
  data: () => ({
    lookup: {},
    loadingColumns: false,
    relationNames: {
      mm: 'Many To Many',
      hm: 'Has Many',
      bt: 'Belongs To'
    },
    tables: []
  }),
  computed: {
    refTables() {
      if (!this.tables || !this.tables.length) {
        return []
      }

      const refTables = this.meta.columns.filter(c =>
        c.uidt === UITypes.LinkToAnotherRecord && !c.system
      ).map(c => ({
        col: c.colOptions,
        ...this.tables.find(t => t.id === c.colOptions.fk_related_model_id)
      }))

      return refTables

    },
    columnList() {
      return ((
        this.lookup &&
        this.lookup.table &&
        this.$store.state.meta.metas &&
        this.$store.state.meta.metas[this.lookup.table.id] &&
        this.$store.state.meta.metas[this.lookup.table.id].columns
      ) || []).filter(c => !isSystemColumn(c))
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
    checkLookupExist(v) {
      return (this.lookup.table && (this.meta.v || []).every(c => !(
        c.lk &&
        c.lk.type === this.lookup.table.type &&
        c.lk.ltn === this.lookup.table.ltn &&
        c.lk.lcn === v.lcn
      ))) || 'Lookup already exist'
    },
    async onTableChange() {
      this.loadingColumns = true
      if (this.lookup.table) {
        try {
          await this.$store.dispatch('meta/ActLoadMeta', {
            dbAlias: this.nodes.dbAlias,
            env: this.nodes.env,
            id: this.lookup.table.id
          })
        } catch (e) {
          // ignore
        }
      }

      this.loadingColumns = false
    },
    async save() {
      try {
        const lookupCol = {
          title: this.alias,
          fk_relation_column_id: this.lookup.table.col.fk_column_id,
          fk_lookup_column_id: this.lookup.column.id,
          uidt: UITypes.Lookup
        }

        await this.$api.dbTableColumn.create(this.meta.id, lookupCol)

        return this.$emit('saved', this.alias)
      } catch (e) {
        console.log(e)
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }
}
</script>

<style scoped>

</style>
