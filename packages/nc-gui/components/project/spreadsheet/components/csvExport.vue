<template>
  <v-btn
    outlined
    class="caption"
    small
    text
    @click="exportCsv"
  >
    Export
  </v-btn>
</template>

<script>

import Papaparse from 'papaparse'
import FileSaver from 'file-saver'

export default {
  name: 'CsvExport',
  props: {
    data: Array,
    meta: Object,
    nodes: Object,
    availableColumns: Array
  },

  methods: {
    async extractCsvData() {
      return Promise.all(this.data.map(async(r) => {
        const row = {}
        for (const col of this.availableColumns) {
          if (col.virtual) {
            let prop, cn
            if (col.mm || (col.lk && col.lk.type === 'mm')) {
              const tn = col.mm ? col.mm.rtn : col.lk.ltn
              const _tn = col.mm ? col.mm._rtn : col.lk._ltn
              await this.$store.dispatch('meta/ActLoadMeta', {
                env: this.nodes.env,
                dbAlias: this.nodes.dbAlias,
                tn
              })

              prop = `${_tn}MMList`
              cn = col.lk
                ? col.lk._lcn
                : (this.$store.state.meta.metas[tn].columns.find(c => c.pv) || this.$store.state.meta.metas[tn].columns.find(c => c.pk) || {})._cn

              row[col._cn] = r.row[prop] && r.row[prop].map(r => cn && r[cn])
            } else if (col.hm || (col.lk && col.lk.type === 'hm')) {
              const tn = col.hm ? col.hm.tn : col.lk.ltn
              const _tn = col.hm ? col.hm._tn : col.lk._ltn

              await this.$store.dispatch('meta/ActLoadMeta', {
                env: this.nodes.env,
                dbAlias: this.nodes.dbAlias,
                tn
              })

              prop = `${_tn}List`
              cn = col.lk
                ? col.lk._lcn
                : (this.$store.state.meta.metas[tn].columns.find(c => c.pv) ||
                this.$store.state.meta.metas[tn].columns.find(c => c.pk))._cn
              row[col._cn] = r.row[prop] && r.row[prop].map(r => cn && r[cn])
            } else if (col.bt || (col.lk && col.lk.type === 'bt')) {
              const tn = col.bt ? col.bt.rtn : col.lk.ltn
              const _tn = col.bt ? col.bt._rtn : col.lk._ltn
              await this.$store.dispatch('meta/ActLoadMeta', {
                env: this.nodes.env,
                dbAlias: this.nodes.dbAlias,
                tn
              })

              prop = `${_tn}Read`
              cn = col.lk
                ? col.lk._lcn
                : (this.$store.state.meta.metas[tn].columns.find(c => c.pv) ||
                this.$store.state.meta.metas[tn].columns.find(c => c.pk) || {})._cn
              row[col._cn] = r.row[prop] &&
                r.row[prop] && cn && r.row[prop][cn]
            } else {
              row[col._cn] = r.row[col._cn]
            }
          } else if (col.uidt === 'Attachment') {
            let data = []
            try {
              if (typeof r.row[col._cn] === 'string') {
                data = JSON.parse(r.row[col._cn])
              } else if (r.row[col._cn]) {
                data = r.row[col._cn]
              }
            } catch {
            }
            row[col._cn] = (data || []).map(a => `${a.title}(${a.url})`)
          } else {
            row[col._cn] = r.row[col._cn]
          }
        }
        return row
      }))
    },
    async exportCsv() {
      const blob = new Blob([Papaparse.unparse(await this.extractCsvData())], { type: 'text/plain;charset=utf-8' })
      FileSaver.saveAs(blob, `${this.meta._tn}_exported.csv`)
    }
  }

}
</script>

<style scoped>

</style>
