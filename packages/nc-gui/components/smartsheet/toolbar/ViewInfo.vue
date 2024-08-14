<script setup lang="ts">
const { isMobileMode } = useGlobal()

const { activeView, openedViewsTab } = storeToRefs(useViewsStore())

const { base, isSharedBase } = storeToRefs(useBase())

const { activeTable } = storeToRefs(useTablesStore())

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())
</script>

<template>
  <div
    class="ml-0.25 flex flex-row items-center border-gray-50 transition-all duration-100 select-none"
    :class="{
      'min-w-36/100 max-w-36/100': !isMobileMode && isLeftSidebarOpen,
      'min-w-39/100 max-w-39/100': !isMobileMode && !isLeftSidebarOpen,
      'w-2/3 text-base ml-1.5': isMobileMode,
      '!max-w-3/4': isSharedBase && !isMobileMode,
    }"
  >
    <template v-if="!isMobileMode">
      <SmartsheetTopbarProjectListDropdown v-if="activeTable">
        <template #default="{ isOpen }">
          <div
            class="rounded-lg h-8 px-2 text-gray-700 font-weight-500 hover:(bg-gray-100 text-gray-800) flex items-center gap-2 cursor-pointer max-w-1/3"
            :class="{
              '!max-w-none': isSharedBase && !isMobileMode,
              '-ml-2': !isMobileMode && isLeftSidebarOpen,
              'bg-gray-100 !text-gray-800': isOpen,
            }"
          >
            <GeneralProjectIcon
              :type="base?.type"
              class="!grayscale min-w-4"
              :style="{
                filter: 'grayscale(100%) brightness(115%)',
              }"
            />
            <NcTooltip class="truncate nc-active-base-title max-w-full !leading-5" show-on-truncate-only :disabled="isOpen">
              <template #title>
                <span class="capitalize">
                  {{ base?.title }}
                </span>
              </template>

              <span
                class="text-ellipsis capitalize"
                :style="{
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                  display: 'inline',
                }"
              >
                {{ base?.title }}
              </span>
            </NcTooltip>
            <GeneralIcon
              icon="chevronDown"
              class="!text-gray-600 flex-none transform transition-transform duration-25"
              :class="{ '!rotate-180': isOpen }"
            />
          </div>
        </template>
      </SmartsheetTopbarProjectListDropdown>
      <div class="nc-topbar-breadcrum-divider">/</div>
    </template>
    <template v-if="!(isMobileMode && !activeView?.is_default)">
      <SmartsheetTopbarTableListDropdown v-if="activeTable">
        <template #default="{ isOpen }">
          <div
            class="rounded-lg h-8 px-2 text-gray-700 font-weight-500 hover:(bg-gray-100 text-gray-800) flex items-center gap-2 cursor-pointer"
            :class="{
              'max-w-1/2': isMobileMode,
              'max-w-1/4': !isSharedBase && !isMobileMode,
              'max-w-none': isSharedBase && !isMobileMode,
              'bg-gray-100 !text-gray-800': isOpen,
            }"
          >
            <LazyGeneralEmojiPicker v-if="isMobileMode" :emoji="activeTable?.meta?.icon" readonly size="xsmall">
              <template #default>
                <GeneralIcon
                  icon="table"
                  class="min-w-5"
                  :class="{
                    '!text-gray-500': !isMobileMode,
                    '!text-gray-700': isMobileMode,
                  }"
                />
              </template>
            </LazyGeneralEmojiPicker>

            <NcTooltip class="truncate nc-active-table-title max-w-full !leading-5" show-on-truncate-only :disabled="isOpen">
              <template #title>
                {{ activeTable?.title }}
              </template>
              <span
                class="text-ellipsis"
                :style="{
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                  display: 'inline',
                }"
              >
                {{ activeTable?.title }}
              </span>
            </NcTooltip>
            <GeneralIcon
              icon="chevronDown"
              class="!text-gray-600 flex-none transform transition-transform duration-25"
              :class="{ '!rotate-180': isOpen }"
            />
          </div>
        </template>
      </SmartsheetTopbarTableListDropdown>
    </template>

    <div v-if="!isMobileMode" class="nc-topbar-breadcrum-divider">/</div>

    <template v-if="!(isMobileMode && activeView?.is_default)">
      <!-- <SmartsheetToolbarOpenedViewAction /> -->

      <SmartsheetTopbarViewListDropdown>
        <template #default="{ isOpen }">
          <div
            class="rounded-lg h-8 px-2 text-gray-800 font-semibold hover:(bg-gray-100 text-gray-800) flex items-center gap-2 cursor-pointer"
            :class="{
              'max-w-1/2': isMobileMode,
              'max-w-1/4': !isSharedBase && !isMobileMode,
              'max-w-none': isSharedBase && !isMobileMode,
              'bg-gray-100 !text-gray-800': isOpen,
            }"
          >
            <LazyGeneralEmojiPicker v-if="isMobileMode" :emoji="activeView?.meta?.icon" readonly size="xsmall">
              <template #default>
                <GeneralViewIcon :meta="{ type: activeView?.type }" class="min-w-4.5 text-lg flex" />
              </template>
            </LazyGeneralEmojiPicker>

            <NcTooltip class="truncate nc-active-view-title max-w-full !leading-5" show-on-truncate-only :disabled="isOpen">
              <template #title>
                {{ activeView?.title }}
              </template>
              <span
                class="text-ellipsis"
                :style="{
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                  display: 'inline',
                }"
              >
                {{ activeView?.title }}
              </span>
            </NcTooltip>
            <GeneralIcon
              icon="chevronDown"
              class="!text-gray-600 flex-none transform transition-transform duration-25"
              :class="{ '!rotate-180': isOpen }"
            />
          </div>
        </template>
      </SmartsheetTopbarViewListDropdown>

      <LazySmartsheetToolbarReload v-if="openedViewsTab === 'view' && !isMobileMode" />

    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-topbar-breadcrum-divider {
  @apply w-4 flex-none flex justify-center text-gray-500;
}
</style>
