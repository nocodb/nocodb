<script lang="ts" setup>
import MdiFlashIcon from '~icons/mdi/flash-outline'
import MdiMenuDownIcon from '~icons/mdi/menu-down'
import MdiDownloadIcon from '~icons/mdi/download-outline'
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
      <div class="p-2 bg-white">
        <a-menu>
          <a-menu-item>
            <div class="text-xs flex align-center gap-2">
              <MdiDownloadIcon />
              <!-- Download as CSV -->
              {{ $t('activity.downloadCSV') }}
            </div>
          </a-menu-item>
        </a-menu>
      </div>
    </template>
  </a-dropdown>
  <!--  <div>
    <v-menu open-on-hover bottom offset-y transition="slide-y-transition">
      <template #activator="{ on }">
        <v-btn
          v-t="['c:actions']"
          outlined
          class="nc-actions-menu-btn caption px-2 nc-remove-border font-weight-medium"
          small
          text
          v-on="on"
        >
          <v-icon small color="#777"> mdi-flash-outline </v-icon>
          &lt;!&ndash; More &ndash;&gt;
          {{ $t('general.more') }}

          <v-icon small color="#777"> mdi-menu-down </v-icon>
        </v-btn>
      </template>

      <v-list dense>
        <v-list-item v-t="['a:actions:download-csv']" dense @click="exportCsv">
          <v-list-item-title>
            <v-icon small class="mr-1"> mdi-download-outline </v-icon>
            <span class="caption">
              &lt;!&ndash; Download as CSV &ndash;&gt;
              {{ $t('activity.downloadCSV') }}
            </span>
          </v-list-item-title>
        </v-list-item>
        <v-list-item v-if="_isUIAllowed('csvImport') && !isView" v-t="['a:actions:upload-csv']" dense @click="importModal = true">
          <v-list-item-title>
            <v-icon small class="mr-1" color=""> mdi-upload-outline </v-icon>
            <span class="caption">
              &lt;!&ndash; Upload CSV &ndash;&gt;
              {{ $t('activity.uploadCSV') }}
            </span>

            <span class="caption grey&#45;&#45;text">(<x-icon small color="grey lighten-2"> mdi-alpha </x-icon> version)</span>
          </v-list-item-title>
        </v-list-item>
        <v-list-item
          v-if="_isUIAllowed('SharedViewList') && !isView"
          v-t="['a:actions:shared-view-list']"
          dense
          @click="$emit('showAdditionalFeatOverlay', 'shared-views')"
        >
          <v-list-item-title>
            <v-icon small class="mr-1" color=""> mdi-view-list-outline </v-icon>
            <span class="caption">
              &lt;!&ndash; Shared View List &ndash;&gt;
              {{ $t('activity.listSharedView') }}
            </span>
          </v-list-item-title>
        </v-list-item>
        <v-list-item v-if="_isUIAllowed('webhook') && !isView" v-t="['c:actions:webhook']" dense @click="webhookModal = true">
          <v-list-item-title>
            <v-icon small class="mr-1" color=""> mdi-hook </v-icon>
            <span class="caption"> Webhooks </span>
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <DropOrSelectFileModal v-model="importModal" accept=".csv" text="CSV" @file="onCsvFileSelection" />
    <ColumnMappingModal
      v-if="columnMappingModal && meta"
      v-model="columnMappingModal"
      :meta="meta"
      :import-data-columns="parsedCsv.columns"
      :parsed-csv="parsedCsv"
      @import="importData"
    />
    &lt;!&ndash;    <webhook-modal v-if="webhookModal" v-model="webhookModal" :meta="meta" /> &ndash;&gt;
    <WebhookSlider v-model="webhookModal" :meta="meta" />
  </div> -->
</template>

<style scoped></style>
