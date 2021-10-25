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
          console.log(col)
          if (col.virtual) {
            let prop, primCol
            if (col.mm) {
              await this.$store.dispatch('meta/ActLoadMeta', {
                env: this.nodes.env,
                dbAlias: this.nodes.dbAlias,
                tn: col.mm.rtn
              })

              prop = `${col.mm._rtn}MMList`
              primCol = this.$store.state.meta.metas[col.mm.rtn].columns.find(c => c.pv) ||
                this.$store.state.meta.metas[col.mm.rtn].columns.find(c => c.pk)

              row[col._cn] = r.row[prop] && r.row[prop].map(r => primCol && primCol._cn && r[primCol._cn])
            } else if (col.hm) {
              await this.$store.dispatch('meta/ActLoadMeta', {
                env: this.nodes.env,
                dbAlias: this.nodes.dbAlias,
                tn: col.hm.tn
              })

              prop = `${col.hm._tn}List`
              primCol = this.$store.state.meta.metas[col.hm.tn].columns.find(c => c.pv) ||
                this.$store.state.meta.metas[col.hm.tn].columns.find(c => c.pk)
              row[col._cn] = r.row[prop] && r.row[prop].map(r => primCol && primCol._cn && r[primCol._cn])
            } else if (col.bt) {
              await this.$store.dispatch('meta/ActLoadMeta', {
                env: this.nodes.env,
                dbAlias: this.nodes.dbAlias,
                tn: col.bt.rtn
              })

              prop = `${col.bt._rtn}Read`
              primCol = this.$store.state.meta.metas[col.bt.rtn].columns.find(c => c.pv) ||
                this.$store.state.meta.metas[col.bt.rtn].columns.find(c => c.pk)
              row[col._cn] = r.row[prop] &&
                r.row[prop] && primCol && primCol._cn && r.row[prop][primCol._cn]
            } else if (col.lk) {
              // todo:
              row[col._cn] = r.row[col._cn]
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
