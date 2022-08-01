<script lang="ts" setup>
import { ExportTypes } from 'nocodb-sdk'
import { useToast } from 'vue-toastification'
import FileSaver from 'file-saver'
import { useNuxtApp } from '#app'
import { useProject } from '#imports'
import { ActiveViewInj, MetaInj } from '~/context'
import { extractSdkResponseErrorMsg } from '~/utils'
import MdiFlashIcon from '~icons/mdi/flash-outline'
import MdiMenuDownIcon from '~icons/mdi/menu-down'
import MdiDownloadIcon from '~icons/mdi/download-outline'
import MdiUploadIcon from '~icons/mdi/upload-outline'
import MdiHookIcon from '~icons/mdi/hook'
import MdiViewListIcon from '~icons/mdi/view-list-outline'

// todo : replace with inject
const publicViewId = null
const { project } = useProject()

const { $api } = useNuxtApp()
const toast = useToast()

const meta = inject(MetaInj)
const selectedView = inject(ActiveViewInj)

const exportCsv = async () => {
  let offset = 0
  let c = 1

  try {
    while (!isNaN(offset) && offset > -1) {
      let res
      if (publicViewId) {
        /* res = await this.$api.public.csvExport(this.publicViewId, ExportTypes.CSV, {
          responseType: 'blob',
          query: {
            fields:
              this.queryParams &&
              this.queryParams.fieldsOrder &&
              this.queryParams.fieldsOrder.filter(c => this.queryParams.showFields[c]),
            offset,
            sortArrJson: JSON.stringify(
              this.reqPayload &&
              this.reqPayload.sorts &&
              this.reqPayload.sorts.map(({ fk_column_id, direction }) => ({
                direction,
                fk_column_id,
              }))
            ),
            filterArrJson: JSON.stringify(this.reqPayload && this.reqPayload.filters),
          },
          headers: {
            'xc-password': this.reqPayload && this.reqPayload.password,
          },
        });
   */
      } else {
        res = await $api.dbViewRow.export(
          'noco',
          project?.value.title as string,
          meta?.value.title as string,
          selectedView?.value.title as string,
          ExportTypes.CSV,
          {
            responseType: 'blob',
            query: {
              offset,
            },
          } as any,
        )
      }
      const { data } = res

      offset = +res.headers['nc-export-offset']
      const blob = new Blob([data], { type: 'text/plain;charset=utf-8' })
      FileSaver.saveAs(blob, `${meta?.value.title}_exported_${c++}.csv`)
      if (offset > -1) {
        toast.info('Downloading more files')
      } else {
        toast.success('Successfully exported all table data')
      }
    }
  } catch (e: any) {
    toast.error(extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <a-dropdown>
    <a-button v-t="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
      <div class="flex gap-1 align-center">
        <MdiFlashIcon class="text-grey" />
        <!-- More -->
        {{ $t('general.more') }}
        <MdiMenuDownIcon class="text-grey" />
      </div>
    </a-button>
    <template #overlay>
      <div class="bg-white shadow">
        <div>
          <div class="nc-menu-item" @click.stop="exportCsv">
            <MdiDownloadIcon />
            <!-- Download as CSV -->
            {{ $t('activity.downloadCSV') }}
          </div>
          <div class="nc-menu-item" @click.stop>
            <MdiUploadIcon />
            <!-- Upload CSV -->
            {{ $t('activity.uploadCSV') }}
          </div>
          <div class="nc-menu-item" @click.stop>
            <MdiViewListIcon />
            <!-- Shared View List -->
            {{ $t('activity.listSharedView') }}
          </div>
          <div class="nc-menu-item" @click.stop>
            <MdiHookIcon />
            <!-- todo: i18n -->
            Webhook
          </div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>
