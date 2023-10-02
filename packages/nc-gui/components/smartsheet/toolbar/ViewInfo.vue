<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'

const { isMobileMode } = useGlobal()

const { openedViewsTab, activeView } = storeToRefs(useViewsStore())

const { base } = storeToRefs(useBase())

const { activeTable } = storeToRefs(useTablesStore())

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())
</script>

<template>
  <div
    class="flex flex-row font-medium items-center border-gray-50 mt-0.5 transition-all duration-100"
    :class="{
      'min-w-36/100 max-w-36/100': !isMobileMode && activeView?.type !== ViewTypes.KANBAN && isLeftSidebarOpen,
      'min-w-39/100 max-w-39/100': !isMobileMode && activeView?.type !== ViewTypes.KANBAN && !isLeftSidebarOpen,
      'min-w-1/4 max-w-1/4': !isMobileMode && activeView?.type === ViewTypes.KANBAN,
      'w-2/3 text-base ml-1.5': isMobileMode,
    }"
  >
    <template v-if="!isMobileMode">
      <NcTooltip class="ml-0.75 max-w-1/4">
        <template #title>
          {{ base?.title }}
        </template>
        <div class="flex flex-row items-center gap-x-1.5">
          <GeneralProjectIcon
            :meta="{ type: base?.type }"
            class="!grayscale"
            :style="{
              filter: 'grayscale(100%) brightness(115%)',
            }"
          />
          <div class="hidden !2xl:(flex truncate ml-1)">
            <span class="truncate text-gray-700">
              {{ base?.title }}
            </span>
          </div>
        </div>
      </NcTooltip>
      <div class="px-1.5 text-gray-500">/</div>
    </template>
    <template v-if="!(isMobileMode && !activeView?.is_default)">
      <LazyGeneralEmojiPicker v-if="isMobileMode" :emoji="activeTable?.meta?.icon" readonly size="xsmall">
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
      <NcTooltip
        class="truncate nc-active-table-title"
        :class="{
          'max-w-1/2': isMobileMode || activeView?.is_default,
          'max-w-20/100': !isMobileMode && !activeView?.is_default,
        }"
      >
        <template #title>
          {{ activeTable?.title }}
        </template>
        <span
          class="text-ellipsis overflow-hidden text-gray-500 xs:ml-2"
          :class="{
            'text-gray-500': !isMobileMode,
            'text-gray-700 font-medium': isMobileMode || activeView?.is_default,
          }"
          :style="{
            wordBreak: 'keep-all',
            whiteSpace: 'nowrap',
            display: 'inline',
          }"
        >
          {{ activeTable?.title }}
        </span>
      </NcTooltip>
    </template>

    <div v-if="!isMobileMode" class="px-1 text-gray-500">/</div>

    <template v-if="!(isMobileMode && activeView?.is_default)">
      <LazyGeneralEmojiPicker v-if="isMobileMode" :emoji="activeView?.meta?.icon" readonly size="xsmall">
        <template #default>
          <GeneralViewIcon :meta="{ type: activeView?.type }" class="min-w-4.5 text-lg flex" />
        </template>
      </LazyGeneralEmojiPicker>

      <NcTooltip
        class="truncate nc-active-view-title"
        :class="{
          'max-w-2/5': !isMobileMode && activeView?.is_default,
          'max-w-3/5': !isMobileMode && !activeView?.is_default,
          'max-w-1/2': isMobileMode,
        }"
      >
        <template #title>
          {{ activeView?.is_default ? $t('title.defaultView') : activeView?.title }}
        </template>
        <span
          class="truncate xs:pl-1.25"
          :class="{
            'max-w-28/100': !isMobileMode,
            'text-gray-500': activeView?.is_default,
            'text-gray-800 font-medium': !activeView?.is_default,
          }"
        >
          {{ activeView?.is_default ? $t('title.defaultView') : activeView?.title }}
        </span>
      </NcTooltip>
    </template>

    <LazySmartsheetToolbarReload v-if="openedViewsTab === 'view' && !isMobileMode" />
  </div>
</template>
