<script setup lang="ts">
import MdiFlashOutlineIcon from '~icons/mdi/flash-outline'
import MdiDownloadOutlineIcon from '~icons/mdi/download-outline'
import MdiUploadOutlineIcon from '~icons/mdi/upload-outline'
import MdiViewListOutlineIcon from '~icons/mdi/view-list-outline'
import MdiHookIcon from '~icons/mdi/hook'

const { isUIAllowed } = useUIPermission()
// TODO:: identify based on meta
const isView = ref(false)

function exportCsv() {
  // TODO
}

function importCsv() {
  // TODO
}

function openSharedViewModal() {
  // TODO:
}

function openWebhookModal() {
  // TODO:
}
</script>

<template>
  <a-menu offset-y transition="slide-y-transition" mode="horizontal">
    <a-sub-menu key="sub1">
      <template #icon>
        <setting-outlined />
      </template>
      <template #title>
        <span class="flex items-center gap-2">
          <MdiFlashOutlineIcon />
          {{ $t('general.more') }}
        </span>
      </template>
      <a-menu-item key="action:downloadCSV" v-t="['c:actions']" @click="exportCsv">
        <span class="flex items-center gap-2">
          <MdiDownloadOutlineIcon class="text-primary" />
          <!-- Download as CSV -->
          {{ $t('activity.downloadCSV') }}
        </span>
      </a-menu-item>

      <a-menu-item
        v-if="isUIAllowed('csvImport') && !isView"
        key="action:uploadCSV"
        v-t="['a:actions:upload-csv']"
        @click="importCsv"
      >
        <span class="flex items-center gap-2">
          <MdiUploadOutlineIcon class="text-primary" />
          <!-- Upload CSV -->
          {{ $t('activity.uploadCSV') }}
        </span>
      </a-menu-item>

      <a-menu-item
        v-if="isUIAllowed('SharedViewList') && !isView"
        key="action:listSharedView"
        v-t="['a:actions:shared-view-list']"
        @click="openSharedViewModal"
      >
        <span class="flex items-center gap-2">
          <MdiViewListOutlineIcon class="text-primary" />
          <!-- Shared View List -->
          {{ $t('activity.listSharedView') }}
        </span>
      </a-menu-item>

      <a-menu-item
        v-if="isUIAllowed('webhook') && !isView"
        key="action:webhooks"
        v-t="['c:actions:webhook']"
        @click="openWebhookModal"
      >
        <span class="flex items-center gap-2">
          <MdiHookIcon class="text-primary" />
          <!-- TODO: i18n -->
          Webhooks
        </span>
      </a-menu-item>
    </a-sub-menu>
  </a-menu>
</template>

<style scoped></style>
