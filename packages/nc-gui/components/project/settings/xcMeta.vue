<template>
  <div class="mt-5">
    <!--    <h3 class="text-center mb-5 grey&#45;&#45;text text&#45;&#45;darken-2">
      &lt;!&ndash; Metadata Operations &ndash;&gt;
      {{ $t('title.metaOperations') }}
    </h3>-->

    <v-simple-table class="ma-2 meta-table text-center mx-auto">
      <tbody>
        <tr>
          <td>
            <!-- Export project meta to zip file and download. -->
            {{ $t('msg.info.exportZip') }}
          </td>
          <td>
            <v-btn
              v-t="['proj-meta:export-zip:trigger']"
              min-width="150"
              color="primary"
              small
              outlined
              :loading="loading === 'export-zip'"
              @click="exportMetaZip()"
            >
              <v-icon small>
                mdi-export
              </v-icon>&nbsp;
              <!-- Export zip -->
              {{ $t('activity.exportZip') }}
            </v-btn>
          </td>
        </tr>
        <tr>
          <td>
            <!-- Import project meta zip file and restart. -->
            {{ $t('msg.info.importZip') }}
          </td>
          <td>
            <v-btn
              v-t="['proj-meta:import-zip']"
              min-width="150"
              :loading="loading === 'import-zip'"
              color="info"
              small
              outlined
              @click="$refs.importFile.click()"
            >
              <v-icon small>
                mdi-import
              </v-icon>&nbsp;

              <!-- Import Zip -->
              {{ $t('activity.importZip') }}
            </v-btn>

            <input
              v-show="false"
              ref="importFile"
              type="file"
              accept=".zip"
              @change="importMetaZip"
            >
          </td>
        </tr>
      <!--        <tr>-->
      <!--          <td>-->
      <!--            &lt;!&ndash; Clear all metadata from meta tables. &ndash;&gt;-->
      <!--            {{ $t('tooltip.clearMetadata') }}-->
      <!--          </td>-->
      <!--          <td>-->
      <!--            <v-btn-->
      <!--              :loading="loading === 'reset-metadata'"-->
      <!--              min-width="150"-->
      <!--              color="error"-->
      <!--              small-->
      <!--              outlined-->
      <!--              @click="resetMeta"-->
      <!--            >-->
      <!--              <v-icon small>-->
      <!--                mdi-delete-variant-->
      <!--              </v-icon>&nbsp;-->
      <!--              &lt;!&ndash; Reset &ndash;&gt;-->
      <!--              {{ $t('general.reset') }}-->
      <!--            </v-btn>-->
      <!--          </td>-->
      <!--        </tr>-->
      </tbody>
    </v-simple-table>

    <dlg-label-submit-cancel
      v-if="dialogShow"
      type="primary"
      :actions-mtd="confirmAction"
      :dialog-show="dialogShow"
      :heading="confirmMessage"
    />

    <!--    <import-template-->
    <!--      :nodes="{dbAlias: 'db'}"-->
    <!--    />-->
  </div>
</template>

<script>
import DlgLabelSubmitCancel from '@/components/utils/dlgLabelSubmitCancel'
// import ImportTemplate from '~/components/project/settings/importTemplate'

export default {
  name: 'XcMeta',
  components: {
    // ImportTemplate,
    DlgLabelSubmitCancel
  },
  data: () => ({
    loading: null,
    dialogShow: false,
    confirmAction: null,
    confirmMessage: ''
  }),
  methods: {
    async exportMeta() {
      this.dialogShow = true
      // this.confirmMessage = 'Do you want to export metadata from meta tables?'
      this.confirmMessage = `${this.$t('msg.info.exportMetadata')}`
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          this.loading = 'export-file'
          try {
            // todo: set env based on `nodes` prop
            await this.$store.dispatch('sqlMgr/ActSqlOp', [
              {
                // dbAlias: 'db',
                env: '_noco'
              },
              'xcMetaTablesExportDbToLocalFs'
            ])
            // this.$toast.success('Successfully exported metadata').goAway(3000)
            this.$toast.success(`${this.$t('msg.toast.exportMetadata')}`).goAway(3000)
          } catch (e) {
            this.$toast.error(e.message).goAway(3000)
          }
          this.dialogShow = false
          this.loading = null
        }
      }
    },
    async exportMetaZip() {
      this.dialogShow = true
      // this.confirmMessage = 'Do you want to export metadata from meta tables?'
      this.confirmMessage = `${this.$t('msg.info.exportMetadata')}`
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          this.loading = 'export-zip'
          let data
          try {
            data = await this.$store.dispatch('sqlMgr/ActSqlOp', [
              {
                // dbAlias: 'db',
                env: '_noco'
              },
              'xcMetaTablesExportDbToZip',
              null,
              null,
              {
                responseType: 'blob'
              }
            ])
            const url = window.URL.createObjectURL(new Blob([data], { type: 'application/zip' }))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', 'meta.zip') // or any other extension
            document.body.appendChild(link)
            link.click()
            // this.$toast.success('Successfully exported metadata').goAway(3000)
            this.$toast.success(`${this.$t('msg.toast.exportMetadata')}`).goAway(3000)
          } catch (e) {
            this.$toast.error(e.message).goAway(3000)
          }
          this.dialogShow = false
          this.loading = null
          this.$tele.emit('proj-meta:export-zip:submit')
        }
      }
    },
    async resetMeta() {
      this.dialogShow = true
      // this.confirmMessage = 'Do you want to clear metadata from meta tables?'
      this.confirmMessage = `${this.$t('msg.info.clearMetadata')}`
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          this.loading = 'reset-metadata'
          try {
            await this.$store.dispatch('sqlMgr/ActSqlOp', [
              {
                // dbAlias: 'db',
                env: '_noco'
              },
              'xcMetaTablesReset'
            ])
            // this.$toast.success('Metadata cleared successfully').goAway(3000)
            this.$toast.success(`${this.$t('msg.toast.clearMetadata')}`).goAway(3000)
          } catch (e) {
            this.$toast.error(e.message).goAway(3000)
          }
          this.dialogShow = false
          this.loading = null
        }
      }
    },

    async importMeta() {
      this.dialogShow = true
      // this.confirmMessage = 'Do you want to import metadata from meta directory?'
      this.confirmMessage = `${this.$t('msg.info.importMetadata')}`
      this.confirmAction = async(act) => {
        if (act === 'hideDialog') {
          this.dialogShow = false
        } else {
          this.loading = 'import-file'
          try {
            await this.$store.dispatch('sqlMgr/ActSqlOp', [
              {
                env: '_noco'
              },
              'xcMetaTablesImportLocalFsToDb'
            ])

            // this.$toast.success('Metadata imported successfully').goAway(3000)
            this.$toast.success(`${this.$t('msg.toast.importMetadata')}`).goAway(3000)
          } catch (e) {
            this.$toast.error(e.message).goAway(3000)
          }
          this.dialogShow = false
          this.loading = null
        }
      }
    },
    async importMetaZip() {
      if (this.$refs.importFile && this.$refs.importFile.files && this.$refs.importFile.files[0]) {
        const zipFile = this.$refs.importFile.files[0]
        this.loading = 'import-zip'
        try {
          this.$refs.importFile.value = ''
          await this.$store.dispatch('sqlMgr/ActUploadOld', [
            {
              env: '_noco'
            },
            'xcMetaTablesImportZipToLocalFsAndDb',
            {
              importsToCurrentProject: true
            },
            zipFile
          ])
          // this.$toast.success('Successfully imported metadata').goAway(3000)
          this.$toast.success(`${this.$t('msg.toast.importMetadata')}`).goAway(3000)
        } catch (e) {
          this.$toast.error(e.message).goAway(3000)
        }
        this.dialogShow = false
        this.loading = null
      }
    }
  }
}
</script>

<style scoped>
.meta-table {
  max-width: 700px;
}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->
