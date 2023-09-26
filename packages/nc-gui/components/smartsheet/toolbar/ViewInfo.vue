<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'

const { isMobileMode } = useGlobal()

const { openedViewsTab, activeView } = storeToRefs(useViewsStore())

const { activeTable } = storeToRefs(useTablesStore())
</script>

<template>
  <div
    class="flex flex-row font-medium items-center border-gray-50 mt-0.5"
    :class="{
      'min-w-2/5 max-w-2/5': !isMobileMode && activeView?.type !== ViewTypes.KANBAN,
      'min-w-1/4 max-w-1/4': !isMobileMode && activeView?.type === ViewTypes.KANBAN,
      'w-2/3 text-base ml-1.5': isMobileMode,
    }"
  >
    <template v-if="!(isMobileMode && !activeView?.is_default)">
      <LazyGeneralEmojiPicker :emoji="activeTable?.meta?.icon" readonly size="xsmall">
        <template #default>
          <MdiTable
            class="min-w-5"
            :class="{
              '!text-gray-500': !isMobileMode,
              '!text-gray-700': isMobileMode,
            }"
          />
        </template>
      </LazyGeneralEmojiPicker>
      <span
        class="text-ellipsis overflow-hidden pl-1 text-gray-500"
        :class="{
          'text-gray-500': !isMobileMode,
          'text-gray-700 max-w-1/2': isMobileMode,
        }"
        :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
      >
        {{ activeTable?.title }}
      </span>
    </template>

    <div v-if="!isMobileMode" class="px-2 text-gray-300">/</div>

    <template v-if="!(isMobileMode && activeView?.is_default)">
      <LazyGeneralEmojiPicker :emoji="activeView?.meta?.icon" readonly size="xsmall">
        <template #default>
          <GeneralViewIcon :meta="{ type: activeView?.type }" class="min-w-4.5 text-lg flex" />
        </template>
      </LazyGeneralEmojiPicker>

      <span
        class="truncate pl-1.25 text-gray-700"
        :class="{
          'max-w-28/100': !isMobileMode,
        }"
      >
        {{ activeView?.is_default ? $t('title.defaultView') : activeView?.title }}
      </span>
    </template>

    <LazySmartsheetToolbarReload v-if="openedViewsTab === 'view' && !isMobileMode" />
  </div>
</template>
