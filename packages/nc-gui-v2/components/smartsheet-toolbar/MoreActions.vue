<script lang="ts" setup>
import MdiFlashIcon from "~icons/mdi/flash-outline";
import MdiMenuDownIcon from "~icons/mdi/menu-down";
import MdiDownloadIcon from "~icons/mdi/download-outline";
import MdiUploadIcon from "~icons/mdi/upload-outline";
import MdiHookIcon from "~icons/mdi/hook";
import MdiViewListIcon from "~icons/mdi/view-list-outline";
</script>

<template>
  <a-dropdown>
    <a-button v-t="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
      <div class="flex gap-1 align-center">
        <MdiFlashIcon class="text-grey" />
        <!-- More -->
        {{ $t("general.more") }}
        <MdiMenuDownIcon class="text-grey" />
      </div>
    </a-button>
    <template #overlay>
      <div class=" bg-white shadow">
        <div>
          <div class="nc-menu-item" @click.stop>
            <MdiDownloadIcon />
            <!-- Download as CSV -->
            {{ $t("activity.downloadCSV") }}
          </div>
          <div class="nc-menu-item"  @click.stop>
            <MdiUploadIcon />
            <!-- Upload CSV -->
            {{ $t("activity.uploadCSV") }}
          </div>
          <div class="nc-menu-item"  @click.stop>
            <MdiViewListIcon />
            <!-- Shared View List -->
            {{ $t("activity.listSharedView") }}
          </div>
          <div class="nc-menu-item"  @click.stop>
            <MdiHookIcon />
            <!-- todo: i18n -->
            Webhook
          </div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>
