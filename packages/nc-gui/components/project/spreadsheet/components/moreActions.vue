<template>
  <div>
    <v-menu
      open-on-hover
      bottom
      offset-y
    >
      <template #activator="{on}">
        <v-btn
          v-t="['actions:trigger']"
          outlined
          class="nc-actions-menu-btn caption px-2 nc-remove-border font-weight-medium"
          small
          text
          v-on="on"
        >
          <v-icon small color="#777">
            mdi-flash-outline
          </v-icon>
          <!--More-->
          {{ $t('general.more') }}

          <v-icon small color="#777">
            mdi-menu-down
          </v-icon>
        </v-btn>
      </template>

      <v-list dense>
        <v-list-item
          v-t="['actions:download-csv']"
          dense
          @click="exportCsv"
        >
          <v-list-item-title>
            <v-icon small class="mr-1">
              mdi-download-outline
            </v-icon>
            <span class="caption">
              <!-- Download as CSV -->
              {{ $t('activity.downloadCSV') }}
            </span>
          </v-list-item-title>
        </v-list-item>
        <v-list-item
          v-if="_isUIAllowed('csvImport') && !isView"
          v-t="['actions:upload-csv']"
          dense
          @click="importModal = true"
        >
          <v-list-item-title>
            <v-icon small class="mr-1" color="">
              mdi-upload-outline
            </v-icon>
            <span class="caption ">
              <!-- Upload CSV -->
              {{ $t('activity.uploadCSV') }}
            </span>

            <span class="caption grey--text">(<x-icon small color="grey lighten-2">
              mdi-alpha
            </x-icon> version)</span>
          </v-list-item-title>
        </v-list-item>
        <v-list-item
          v-if="_isUIAllowed('csvImport') && !isView"
          v-t="['actions:shared-view-list']"
          dense
          @click="$emit('showAdditionalFeatOverlay', 'shared-views')"
        >
          <v-list-item-title>
            <v-icon small class="mr-1" color="">
              mdi-view-list-outline
            </v-icon>
            <span class="caption ">
              <!-- Shared View List -->
              {{ $t('activity.listSharedView') }}
            </span>
          </v-list-item-title>
        </v-list-item>
        <v-list-item
          v-if="_isUIAllowed('csvImport') && !isView"
          v-t="['actions:webhook:trigger']"
          dense
          @click="$emit('webhook')"
        >
          <v-list-item-title>
            <v-icon small class="mr-1" color="">
              mdi-hook
            </v-icon>
            <span class="caption ">
              Webhooks
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
      :parsed-csv="parsedCsv"
      @import="importData"
    />
  </div>
</template>

<script>

import FileSaver from 'file-saver'
import { ExportTypes } from 'nocodb-sdk'
import DropOrSelectFileModal from '~/components/import/dropOrSelectFileModal'
import ColumnMappingModal from '~/components/project/spreadsheet/components/importExport/columnMappingModal'
import CSVTemplateAdapter from '~/components/import/templateParsers/CSVTemplateAdapter'
import { UITypes } from '~/components/project/spreadsheet/helpers/uiTypes'

export default {
  name: 'ExportImport',
  components: {
    ColumnMappingModal,
    DropOrSelectFileModal
  },
  props: {
    meta: Object,
    nodes: Object,
    selectedView: Object,
    publicViewId: String,
    queryParams: Object,
    isView: Boolean,
    reqPayload: Object
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
      reader.onload = async(e) => {
        const templateGenerator = new CSVTemplateAdapter(file.name, e.target.result)
        await templateGenerator.init()
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
              const title = col.mm ? col.mm._rtn : col.lk._ltn
              await this.$store.dispatch('meta/ActLoadMeta', {
                env: this.nodes.env,
                dbAlias: this.nodes.dbAlias,
                tn
              })

              prop = `${title}MMList`
              cn = col.lk
                ? col.lk._lcn
                : (this.$store.state.meta.metas[tn].columns.find(c => c.pv) || this.$store.state.meta.metas[tn].columns.find(c => c.pk) || {}).title

              row[col.title] = r.row[prop] && r.row[prop].map(r => cn && r[cn])
            } else if (col.hm || (col.lk && col.lk.type === 'hm')) {
              const tn = col.hm ? col.hm.table_name : col.lk.ltn
              const title = col.hm ? col.hm.title : col.lk._ltn

              await this.$store.dispatch('meta/ActLoadMeta', {
                env: this.nodes.env,
                dbAlias: this.nodes.dbAlias,
                tn
              })

              prop = `${title}List`
              cn = col.lk
                ? col.lk._lcn
                : (this.$store.state.meta.metas[tn].columns.find(c => c.pv) ||
                  this.$store.state.meta.metas[tn].columns.find(c => c.pk)).title
              row[col.title] = r.row[prop] && r.row[prop].map(r => cn && r[cn])
            } else if (col.bt || (col.lk && col.lk.type === 'bt')) {
              const tn = col.bt ? col.bt.rtn : col.lk.ltn
              const title = col.bt ? col.bt._rtn : col.lk._ltn
              await this.$store.dispatch('meta/ActLoadMeta', {
                env: this.nodes.env,
                dbAlias: this.nodes.dbAlias,
                tn
              })

              prop = `${title}Read`
              cn = col.lk
                ? col.lk._lcn
                : (this.$store.state.meta.metas[tn].columns.find(c => c.pv) ||
                  this.$store.state.meta.metas[tn].columns.find(c => c.pk) || {}).title
              row[col.title] = r.row[prop] &&
                r.row[prop] && cn && r.row[prop][cn]
            } else {
              row[col.title] = r.row[col.title]
            }
          } else if (col.uidt === 'Attachment') {
            let data = []
            try {
              if (typeof r.row[col.title] === 'string') {
                data = JSON.parse(r.row[col.title])
              } else if (r.row[col.title]) {
                data = r.row[col.title]
              }
            } catch {
            }
            row[col.title] = (data || []).map(a => `${a.title}(${a.url})`)
          } else {
            row[col.title] = r.row[col.title]
          }
        }
        return row
      }))
    },
    async exportCsv() {
      let offset = 0
      let c = 1

      try {
        while (!isNaN(offset) && offset > -1) {
          let res
          if (this.publicViewId) {
            res = await this.$api.public.csvExport(this.publicViewId, ExportTypes.CSV, this.reqPayload, {
              responseType: 'blob',
              query: {
                offset
              }
            })
          } else {
            res = await this.$api.data.csvExport(this.selectedView.id, ExportTypes.CSV, {
              responseType: 'blob',
              query: {
                offset
              }
            })
          }
          const { data } = res

          offset = +res.headers['nc-export-offset']
          const blob = new Blob([data], { type: 'text/plain;charset=utf-8' })
          FileSaver.saveAs(blob, `${this.meta.title}_exported_${c++}.csv`)
          if (offset > -1) {
            this.$toast.info('Downloading more files').goAway(3000)
          } else {
            this.$toast.success('Successfully exported all table data').goAway(3000)
          }
        }
      } catch (e) {
        console.log(e)
        this.$toast.error(e.message).goAway(3000)
      }
    },
    async importData(columnMappings) {
      try {
        const api = this.$ncApis.get({
          table: this.meta.table_name
        })

        const data = this.parsedCsv.data
        for (let i = 0, progress = 0; i < data.length; i += 500) {
          const batchData = data.slice(i, i + 500).map(row => columnMappings.reduce((res, col) => {
            // todo: parse data
            if (col.enabled && col.destCn) {
              const v = this.meta && this.meta.columns.find(c => c.title === col.destCn)
              let input = row[col.sourceCn]
              // parse potential boolean values
              if (v.uidt == UITypes.Checkbox) {
                input = input.replace(/["']/g, '').toLowerCase().trim()
                if (input == 'false' || input == 'no' || input == 'n') {
                  input = '0'
                } else if (input == 'true' || input == 'yes' || input == 'y') {
                  input = '1'
                }
              } else if (v.uidt === UITypes.Number) {
                if (input == "") input = null
              }
              res[col.destCn] = input
            }
            return res
          }, {}))
          await api.insertBulk(batchData)
          progress += batchData.length
          this.$store.commit('loader/MutMessage', `Importing data : ${progress}/${data.length}`)
          this.$store.commit('loader/MutProgress', Math.round((100 * progress / data.length)))
        }
        this.columnMappingModal = false
        this.$store.commit('loader/MutClear')
        this.$emit('reload')
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
