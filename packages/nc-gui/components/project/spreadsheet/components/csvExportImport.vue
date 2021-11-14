<template>
  <div>
    <v-menu
      open-on-hover
      bottom
      offset-y
    >
      <template #activator="{on}">
        <v-btn
          outlined
          class="nc-actions-menu-btn caption"
          small
          text
          v-on="on"
        >
          <v-icon small color="#777">
            mdi-flash-outline
          </v-icon>
          Actions

          <v-icon small color="#777">
            mdi-menu-down
          </v-icon>
        </v-btn>
      </template>

      <v-list dense>
        <v-list-item
          dense
          @click="exportCsv"
        >
          <v-list-item-title>
            <v-icon small class="mr-1">
              mdi-download-outline
            </v-icon>
            <span class="caption">
              Download as CSV
            </span>
          </v-list-item-title>
        </v-list-item>
        <v-list-item
          dense
          @click="importModal = true"
        >
          <v-list-item-title>
            <v-icon small class="mr-1" color="">
              mdi-upload-outline
            </v-icon>
            <span class="caption ">
              Upload CSV
            </span>
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <drop-or-select-file-modal v-model="importModal" accept=".csv" text="CSV" @file="onCsvFileSelection" />
    <column-mapping-modal
      v-if="columnMappingModal && meta"
      v-model="columnMappingModal"
      :meta="meta"
      :import-data-columns="parsedCsv.columns"
      @import="importData"
    />
  </div>
</template>

<script>

import FileSaver from 'file-saver'
import DropOrSelectFileModal from '~/components/import/dropOrSelectFileModal'
import CSVTemplateAdapter from '~/components/import/CSVTemplateAdapter'
import ColumnMappingModal from '~/components/project/spreadsheet/components/columnMappingModal'

export default {
  name: 'CsvExportImport',
  components: { ColumnMappingModal, DropOrSelectFileModal },
  props: {
    meta: Object,
    nodes: Object,
    selectedView: Object,
    publicViewId: String,
    queryParams: Object
  },
  data() {
    return {
      importModal: false,
      columnMappingModal: false,
      parsedCsv: {}
    }
  },

  methods: {
    async onCsvFileSelection(file) {
      const reader = new FileReader()

      reader.onload = (e) => {
        const templateGenerator = new CSVTemplateAdapter(file.name, e.target.result)
        templateGenerator.parseData()
        this.parsedCsv.columns = templateGenerator.getColumns()
        this.parsedCsv.data = templateGenerator.getData()
        this.columnMappingModal = true
        this.importModal = false
      }

      reader.readAsText(file)
    },

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
      // const fields = this.availableColumns.map(c => c._cn)
      // const blob = new Blob([Papaparse.unparse(await this.extractCsvData())], { type: 'text/plain;charset=utf-8' })

      let offset = 0
      let c = 1

      try {
        while (!isNaN(offset) && offset > -1) {
          const res = await this.$store.dispatch('sqlMgr/ActSqlOp', [
            this.publicViewId
              ? null
              : {
                  dbAlias: this.nodes.dbAlias,
                  env: '_noco'
                },
            this.publicViewId ? 'sharedViewExportAsCsv' : 'xcExportAsCsv',
            {
              query: { offset },
              localQuery: this.queryParams || {},
              ...(this.publicViewId
                ? {
                    view_id: this.publicViewId
                  }
                : {
                    view_name: this.selectedView.title,
                    model_name: this.meta.tn
                  })
            },
            null,
            {
              responseType: 'blob'
            },
            null,
            true
          ])
          const data = res.data
          offset = +res.headers['nc-export-offset']
          const blob = new Blob([data], { type: 'text/plain;charset=utf-8' })
          FileSaver.saveAs(blob, `${this.meta._tn}_exported_${c++}.csv`)
          if (offset > -1) {
            this.$toast.info('Downloading more files').goAway(3000)
          } else {
            this.$toast.success('Successfully exported all table data').goAway(3000)
          }
        }
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    },
    async importData(columnMappings) {
      try {
        const api = this.$ncApis.get({
          table: this.meta.tn
        })
        const data = this.parsedCsv.data
        for (let i = 0, progress = 0; i < data.length; i += 500) {
          this.$store.commit('loader/MutMessage', `Importing data : ${progress}/${data.length}`)
          this.$store.commit('loader/MutProgress', Math.round(progress && 100 * progress / data.length))

          const batchData = data.slice(i, i + 500).map(row => columnMappings.reduce((res, col) => {
            if (col.enabled) {
              res[col.destCn] = row[col.sourceCn]
            }
            return res
          }, {}))
          await api.insertBulk(batchData)
          progress += batchData.length
        }
        this.columnMappingModal = false
        this.$store.commit('loader/MutClear')
        this.$toast.success('Successfully imported table data').goAway(3000)
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }

}
</script>

<style scoped>

</style>
