<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'

const { openedViewsTab, activeView } = storeToRefs(useViewsStore())

const { activeTable } = storeToRefs(useTablesStore())
</script>

<template>
  <div
    class="flex flex-row font-medium items-center border-gray-50 mt-0.5"
    :class="{
      'min-w-2/5 max-w-2/5': activeView?.type !== ViewTypes.KANBAN,
      'min-w-1/4 max-w-1/4': activeView?.type === ViewTypes.KANBAN,
    }"
  >
    <LazyGeneralEmojiPicker :emoji="activeTable?.meta?.icon" readonly size="xsmall">
      <template #default>
        <MdiTable class="min-w-5 !text-gray-500" />
      </template>
    </LazyGeneralEmojiPicker>
    <span
      class="text-ellipsis overflow-hidden pl-1 max-w-1/2 text-gray-500"
      :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
    >
      {{ activeTable?.title }}
    </span>

    <div class="px-2 text-gray-300">/</div>
    <LazyGeneralEmojiPicker :emoji="activeView?.meta?.icon" readonly size="xsmall">
      <template #default>
        <GeneralViewIcon :meta="{ type: activeView?.type }" class="min-w-4.5 text-lg flex" />
      </template>
    </LazyGeneralEmojiPicker>

    <span class="truncate pl-1.25 text-gray-700 max-w-28/100">
      {{ activeView?.is_default ? $t('title.defaultView') : activeView?.title }}
    </span>

    <LazySmartsheetToolbarReload v-if="openedViewsTab === 'view'" />
  </div>
</template>
