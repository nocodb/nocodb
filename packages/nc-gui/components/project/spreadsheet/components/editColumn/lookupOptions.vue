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
            item-text="_ltn"
            :item-value="v => v"
            :rules="[v => !!v || 'Required']"
            dense
          >
            <template #item="{item}">
              <span class="caption"><span class="font-weight-bold"> {{
                item._ltn
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
            item-text="_lcn"
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
            ...(this.meta.belongsTo || []).map(({ rtn, _rtn, rcn, tn, cn }) => ({
              type: 'bt',
              rtn,
              _rtn,
              rcn,
              tn,
              cn,
              ltn: rtn,
              _ltn: _rtn
            })),
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
              ltn: tn,
              _ltn: _tn
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
              ltn: rtn,
              _ltn: _rtn
            }))
          ]
        : []
    },
    columnList() {
      return ((
        this.lookup &&
        this.lookup.table &&
        this.$store.state.meta.metas &&
        this.$store.state.meta.metas[this.lookup.table.ltn] &&
        this.$store.state.meta.metas[this.lookup.table.ltn].columns
      ) || []).map(({ cn, _cn }) => ({
        lcn: cn,
        _lcn: _cn
      }))
    }
  },
  methods: {
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
            tn: this.lookup.table.ltn
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
          lk: {
            ...this.lookup.table,
            ...this.lookup.column
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
