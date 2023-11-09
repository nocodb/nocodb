<script setup lang="ts">
const { isMobileMode } = useGlobal()

const { openedViewsTab, activeView } = storeToRefs(useViewsStore())

const { base, isSharedBase } = storeToRefs(useBase())
const { baseUrl } = useBase()

const { activeTable } = storeToRefs(useTablesStore())
const { tableUrl } = useTablesStore()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const openedBaseUrl = computed(() => {
  if (!base.value) return ''

  return `${window.location.origin}/#${baseUrl({
    id: base.value.id!,
    type: 'database',
  })}`
})
</script>

<template>
  <div
    class="ml-0.25 flex flex-row font-medium items-center border-gray-50 transition-all duration-100"
    :class="{
      'min-w-36/100 max-w-36/100': !isMobileMode && isLeftSidebarOpen,
      'min-w-39/100 max-w-39/100': !isMobileMode && !isLeftSidebarOpen,
      'w-2/3 text-base ml-1.5': isMobileMode,
      '!max-w-3/4': isSharedBase && !isMobileMode,
    }"
  >
    <template v-if="!isMobileMode">
      <NuxtLink
        class="!hover:(text-black underline-gray-600) !underline-transparent ml-0.75 max-w-1/4"
        :class="{
          '!max-w-none': isSharedBase && !isMobileMode,
          '!text-gray-500': activeTable,
          '!text-gray-700': !activeTable,
        }"
        :to="openedBaseUrl"
      >
        <NcTooltip class="!text-inherit">
          <template #title>
            <span class="capitalize">
              {{ base?.title }}
            </span>
          </template>
          <div class="flex flex-row items-center gap-x-1.5">
            <GeneralProjectIcon
              :meta="{ type: base?.type }"
              class="!grayscale min-w-4"
              :style="{
                filter: 'grayscale(100%) brightness(115%)',
              }"
            />
            <div
              class="hidden !2xl:(flex truncate ml-1)"
              :class="{
                '!flex': isSharedBase && !isMobileMode,
              }"
            >
              <span class="truncate !text-inherit capitalize">
                {{ base?.title }}
              </span>
            </div>
          </div>
        </NcTooltip>
      </NuxtLink>
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
      <div
        v-if="activeTable"
        :class="{
          'max-w-1/2': isMobileMode || activeView?.is_default,
          'max-w-20/100': !isSharedBase && !isMobileMode && !activeView?.is_default,
          'max-w-none': isSharedBase && !isMobileMode,
        }"
      >
        <NcTooltip class="truncate nc-active-table-title max-w-full">
          <template #title>
            {{ activeTable?.title }}
          </template>
          <span
            class="text-ellipsis overflow-hidden text-gray-500 xs:ml-2"
            :class="{
              'text-gray-500': !isMobileMode,
              'text-gray-800 font-medium': isMobileMode || activeView?.is_default,
            }"
            :style="{
              wordBreak: 'keep-all',
              whiteSpace: 'nowrap',
              display: 'inline',
            }"
          >
            <template v-if="activeView?.is_default">
              {{ activeTable?.title }}
            </template>
            <NuxtLink
              v-else
              class="!text-inherit !underline-transparent !hover:(text-black underline-gray-600)"
              :to="tableUrl({ table: activeTable, completeUrl: true })"
            >
              {{ activeTable?.title }}
            </NuxtLink>
          </span>
        </NcTooltip>
      </div>
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
          'max-w-2/5': !isSharedBase && !isMobileMode && activeView?.is_default,
          'max-w-3/5': !isSharedBase && !isMobileMode && !activeView?.is_default,
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
