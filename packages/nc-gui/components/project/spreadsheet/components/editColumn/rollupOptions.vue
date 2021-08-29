<template>
  <div>
    <v-container fluid class="wrapper">
      <v-row>
        <v-col cols="6">
          <v-autocomplete
            ref="input"
            v-model="rollup.table"
            outlined
            class="caption"
            hide-details="auto"
            label="Child Table"
            :full-width="false"
            :items="refTables"
            item-text="_rltn"
            :item-value="v => v"
            :rules="[v => !!v || 'Required']"
            dense
          >
            <template #item="{item}">
              <span class="caption"><span class="font-weight-bold"> {{
                item._rltn
              }}</span> <small>({{ relationNames[item.type] }})
              </small></span>
            </template>
          </v-autocomplete>
        </v-col>
        <v-col cols="6">
          <v-autocomplete
            ref="input"
            v-model="rollup.column"
            outlined
            class="caption"
            hide-details="auto"
            label="Child column"
            :full-width="false"
            :items="columnList"
            item-text="_rlcn"
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
            class="caption"
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

export default {
  name: 'RollupOptions',
  props: ['nodes', 'column', 'meta', 'isSQLite', 'alias'],
  data: () => ({
    rollup: {},
    loadingColumns: false,
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
      return this.meta
        ? [
          // ...(this.meta.belongsTo || []).map(({ rtn, _rtn, rcn, tn, cn }) => ({
          //   type: 'bt',
          //   rtn,
          //   _rtn,
          //   rcn,
          //   tn,
          //   cn,
          //   ltn: rtn,
          //   _ltn: _rtn
          // })),
            ...(this.meta.hasMany || []).map(({
              tn,
              _tn,
              cn,
              rcn,
              rtn
            }) => ({
              type: 'hm',
              tn,
              _tn,
              cn,
              rcn,
              rtn,
              rltn: tn,
              _rltn: _tn
            })),
            ...(this.meta.manyToMany || []).map(({ vtn, _vtn, vrcn, vcn, rtn, _rtn, rcn, tn, cn }) => ({
              type: 'mm',
              tn,
              cn,
              vtn,
              _vtn,
              vrcn,
              rcn,
              rtn,
              vcn,
              _rtn,
              rltn: rtn,
              _rltn: _rtn
            }))
          ]
        : []
    },
    columnList() {
      return ((
        this.rollup &&
        this.rollup.table &&
        this.$store.state.meta.metas &&
        this.$store.state.meta.metas[this.rollup.table.rltn] &&
        this.$store.state.meta.metas[this.rollup.table.rltn].columns
      ) || []).map(({ cn, _cn }) => ({
        rlcn: cn,
        _rlcn: _cn
      }))
    }
  },
  methods: {
    async onTableChange() {
      this.loadingColumns = true
      if (this.rollup.table) {
        try {
          await this.$store.dispatch('meta/ActLoadMeta', {
            dbAlias: this.nodes.dbAlias,
            env: this.nodes.env,
            tn: this.rollup.table.ltn
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
          _cn: this.alias,
          rollup: {
            ...this.rollup.table,
            ...this.rollup.column,
            fn: this.rollup.fn
          }
        })

        await this.$store.dispatch('sqlMgr/ActSqlOp', [{
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'xcModelSet', {
          tn: this.nodes.tn,
          meta
        }])

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
