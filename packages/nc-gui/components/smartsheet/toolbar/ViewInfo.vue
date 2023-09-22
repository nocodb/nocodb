<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'
import { ActiveViewInj, inject } from '#imports'

const selectedView = inject(ActiveViewInj)
const { openedViewsTab } = storeToRefs(useViewsStore())

const { activeTable } = storeToRefs(useTablesStore())
</script>

<template>
  <div
    class="flex flex-row font-medium items-center border-gray-50 mt-0.5"
    :class="{
      'min-w-2/5 max-w-2/5': selectedView?.type !== ViewTypes.KANBAN,
      'min-w-1/4 max-w-1/4': selectedView?.type === ViewTypes.KANBAN,
    }"
  >
    <LazyGeneralEmojiPicker :emoji="activeTable?.meta?.icon" readonly size="xsmall">
      <template #default>
        <MdiTable
          class="min-w-5 !text-gray-500"
          :class="{
            '!text-gray-500': !selectedView?.is_default,
            '!text-gray-800 mr-0.25': selectedView?.is_default,
          }"
        />
      </template>
    </LazyGeneralEmojiPicker>
    <span
      class="text-ellipsis overflow-hidden pl-1 max-w-1/2"
      :class="{
        'text-gray-500': !selectedView?.is_default,
        'text-gray-700': selectedView?.is_default,
      }"
      :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
    >
      {{ activeTable?.title }}
    </span>

    <div class="px-2 text-gray-300">/</div>
    <LazyGeneralEmojiPicker :emoji="selectedView?.meta?.icon" readonly size="xsmall">
      <template #default>
        <GeneralViewIcon :meta="{ type: selectedView?.type }" class="min-w-4.5 text-lg flex" />
      </template>
    </LazyGeneralEmojiPicker>

    <span class="truncate pl-1.25 text-gray-700 max-w-28/100">
      {{ selectedView?.title }}
    </span>

    <LazySmartsheetToolbarReload v-if="openedViewsTab === 'view'" />
  </div>
</template>
