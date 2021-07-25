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
            label="Child Table"
            :full-width="false"
            :items="refTables"
            item-text="_tn"
            :item-value="v => v"
            :rules="[v => !!v || 'Required']"
            dense
          >
            <template #item="{item}">
              <span class="caption"><span class="font-weight-bold"> {{
                item._tn
              }}</span> <small>({{ relationNames[item.type] }})
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
            label="Child column"
            :full-width="false"
            :items="columnList"
            item-text="_cn"
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
    }
  }),
  computed: {
    refTables() {
      return this.meta
        ? [
            ...(this.meta.belongsTo || []).map(bt => ({ type: 'bt', relation: bt, tn: bt.rtn, _tn: bt._rtn })),
            ...(this.meta.hasMany || []).map(hm => ({ type: 'hm', relation: hm, tn: hm.tn, _tn: hm._tn })),
            ...(this.meta.manyToMany || []).map(mm => ({ type: 'mm', relation: mm, tn: mm.rtn, _tn: mm._rtn }))
          ]
        : []
    },
    columnList() {
      return ((
        this.lookup &&
        this.lookup.table &&
        this.$store.state.meta.metas &&
        this.$store.state.meta.metas[this.lookup.table.tn] &&
        this.$store.state.meta.metas[this.lookup.table.tn].columns
      ) || []).map(({ cn, _cn }) => ({ cn, _cn }))
    }
  },
  methods: {
    checkLookupExist(v) {
      return (this.lookup.table && (this.meta.v || []).every(c => !(
        c.lookup &&
        c.type === this.lookup.table.type &&
        c.tn === this.lookup.table.tn &&
        c.cn === v.cn
      ))) || 'Lookup already exist'
    },
    async onTableChange() {
      this.loadingColumns = true
      if (this.lookup.table) {
        try {
          await this.$store.dispatch('meta/ActLoadMeta', {
            dbAlias: this.nodes.dbAlias,
            env: this.nodes.env,
            tn: this.lookup.table.tn
          })
        } catch (e) {
          // ignore
        }
      }

      this.loadingColumns = false
    },
    async save() {
      try {
        await this.$store.dispatch('meta/ActLoadMeta', {
          dbAlias: this.nodes.dbAlias,
          env: this.nodes.env,
          tn: this.meta.tn,
          force: true
        })
        const meta = JSON.parse(JSON.stringify(this.$store.state.meta.metas[this.meta.tn]))

        meta.v.push({
          // _cn: this.alias,
          lookup: true,
          ...this.lookup.table,
          ...this.lookup.column
        })

        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelSet', {
          tn: this.nodes.tn,
          meta
        }])

        return this.$emit('saved', `${this.lookup.column._cn} (from ${this.lookup.table._tn})`)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }
}
</script>

<style scoped>

</style>
