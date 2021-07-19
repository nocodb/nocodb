<template>
  <div>
    <h3 class="text-center mb-5 grey--text text--darken-2">
      <!-- Metadata Operations -->
      {{ $t('management.meta.title') }}
    </h3>

    <v-simple-table class="ma-2 meta-table text-center mx-auto">
      <!--      <thead>-->
      <!--      <tr>-->
      <!--        <th colspan="2" class="text-center title pa-2">Metadata Operations</th>-->
      <!--      </tr>-->
      <!--      </thead>-->
      <tbody>
        <tr>
          <td>
            <!-- Export all metadata from the meta tables to meta directory. -->
            {{ $t('management.meta.export_to_file.desc') }}
          </td>
          <td>
            <v-btn
              min-width="150"
              color="primary"
              small
              outlined
              @click="exportMeta"
              :loading="loading === 'export-file'"
            >
              <v-icon small>mdi-export</v-icon>&nbsp;
              <!-- Export to file -->
              {{ $t('management.meta.export_to_file') }}
            </v-btn>
          </td>
        </tr>

        <tr>
          <td>
            <!-- Import all metadata from the meta directory to meta tables. -->
            {{ $t('management.meta.import.desc') }}
          </td>
          <td>
            <v-btn
              :loading="loading === 'import-file'"
              min-width="150"
              color="info"
              small
              outlined
              @click="importMeta"
            >
              <v-icon small>mdi-import</v-icon>&nbsp;

              <!-- Import -->
              {{ $t('management.meta.import') }}
            </v-btn>
          </td>
        </tr>

        <tr>
          <td>
            <!-- Export project meta to zip file and download. -->
            {{ $t('management.meta.export_to_zip.desc') }}
          </td>
          <td>
            <v-btn
              min-width="150"
              color="primary"
              small
              outlined
              :loading="loading === 'export-zip'"
              @click="exportMetaZip()"
            >
              <v-icon small>mdi-export</v-icon>&nbsp;
              <!-- Export zip -->
              {{ $t('management.meta.export_to_zip') }}
            </v-btn>
          </td>
        </tr>
        <tr>
          <td>
            <!-- Import project meta zip file and restart. -->
            {{ $t('management.meta.import_zip.desc') }}
          </td>
          <td>
            <v-btn
              min-width="150"
              :loading="loading === 'import-zip'"
              color="info"
              small
              outlined
              @click="$refs.importFile.click()"
            >
              <v-icon small>mdi-import</v-icon>&nbsp;

              <!-- Import Zip -->
              {{ $t('management.meta.import_zip') }}
            </v-btn>

            <input
              type="file"
              accept=".zip"
              @change="importMetaZip"
              v-show="false"
              ref="importFile"
            />
          </td>
        </tr>
        <tr>
          <td>
            <!-- Clear all metadata from meta tables. -->
            {{ $t('management.meta.reset.desc') }}
          </td>
          <td>
            <v-btn
              :loading="loading === 'reset-metadata'"
              min-width="150"
              color="error"
              small
              outlined
              @click="resetMeta"
            >
              <v-icon small>mdi-delete-variant</v-icon>&nbsp;
              <!-- Reset -->
              {{ $t('management.meta.reset') }}
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-simple-table>

    <dlg-label-submit-cancel
      type="primary"
      v-if="dialogShow"
      :actionsMtd="confirmAction"
      :dialogShow="dialogShow"
      :heading="confirmMessage"
    >
    </dlg-label-submit-cancel>
  </div>
</template>

<script>
import DlgLabelSubmitCancel from '@/components/utils/dlgLabelSubmitCancel';

export default {
  name: 'xc-meta',
  components: {
    DlgLabelSubmitCancel,
  },
  data: () => ({
    loading: null,
    dialogShow: false,
    confirmAction: null,
    confirmMessage: '',
  }),
  methods: {
    async exportMeta() {
      this.dialogShow = true;
      this.confirmMessage = 'Do you want to export metadata from meta tables?';
      this.confirmAction = async act => {
        if (act === 'hideDialog') {
          this.dialogShow = false;
        } else {
          this.loading = 'export-file';
          try {
            await this.$store.dispatch('sqlMgr/ActSqlOp', [
              {
                // dbAlias: 'db',
                env: 'dev',
              },
              'xcMetaTablesExportDbToLocalFs',
            ]);
            this.$toast.success('Successfully exported metadata').goAway(3000);
          } catch (e) {
            this.$toast.error('Some internal error occurred').goAway(3000);
          }
          this.dialogShow = false;
          this.loading = null;
        }
      };
    },
    async exportMetaZip() {
      this.dialogShow = true;
      this.confirmMessage = 'Do you want to export metadata from meta tables?';
      this.confirmAction = async act => {
        if (act === 'hideDialog') {
          this.dialogShow = false;
        } else {
          this.loading = 'export-zip';
          let data;
          try {
            data = await this.$store.dispatch('sqlMgr/ActSqlOp', [
              {
                // dbAlias: 'db',
                env: 'dev',
              },
              'xcMetaTablesExportDbToZip',
              null,
              null,
              {
                responseType: 'blob',
              },
            ]);
            const url = window.URL.createObjectURL(new Blob([data], { type: 'application/zip' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'meta.zip'); //or any other extension
            document.body.appendChild(link);
            link.click();
            this.$toast.success('Successfully exported metadata').goAway(3000);
          } catch (e) {
            this.$toast.error('Some internal error occurred').goAway(3000);
          }
          this.dialogShow = false;
          this.loading = null;
        }
      };
    },
    async resetMeta() {
      this.dialogShow = true;
      this.confirmMessage = 'Do you want to clear metadata from meta tables?';
      this.confirmAction = async act => {
        if (act === 'hideDialog') {
          this.dialogShow = false;
        } else {
          this.loading = 'reset-metadata';
          try {
            await this.$store.dispatch('sqlMgr/ActSqlOp', [
              {
                // dbAlias: 'db',
                env: 'dev',
              },
              'xcMetaTablesReset',
            ]);
            this.$toast.success('Metadata cleared successfully').goAway(3000);
          } catch (e) {
            this.$toast.error('Some internal error occurred').goAway(3000);
          }
          this.dialogShow = false;
          this.loading = null;
        }
      };
    },

    async importMeta() {
      this.dialogShow = true;
      this.confirmMessage = 'Do you want to import metadata from meta directory?';
      this.confirmAction = async act => {
        if (act === 'hideDialog') {
          this.dialogShow = false;
        } else {
          this.loading = 'import-file';
          try {
            await this.$store.dispatch('sqlMgr/ActSqlOp', [
              {
                env: 'dev',
              },
              'xcMetaTablesImportLocalFsToDb',
            ]);

            this.$toast.success('Metadata imported successfully').goAway(3000);
          } catch (e) {
            this.$toast.error('Some internal error occurred').goAway(3000);
          }
          this.dialogShow = false;
          this.loading = null;
        }
      };
    },
    async importMetaZip() {
      if (this.$refs.importFile && this.$refs.importFile.files && this.$refs.importFile.files[0]) {
        const zipFile = this.$refs.importFile.files[0];
        this.loading = 'import-zip';
        try {
          this.$refs.importFile.value = '';
          await this.$store.dispatch('sqlMgr/ActUpload', [
            {
              // dbAlias: 'db',
              env: 'dev',
            },
            'xcMetaTablesImportZipToLocalFsAndDb',
            {},
            zipFile,
          ]);
          this.$toast.success('Successfully imported metadata').goAway(3000);
        } catch (e) {
          this.$toast.error('Some internal error occurred').goAway(3000);
        }
        this.dialogShow = false;
        this.loading = null;
      }
    },
  },
};
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
