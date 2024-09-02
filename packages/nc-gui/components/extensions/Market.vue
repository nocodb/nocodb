<script lang="ts" setup>
interface Prop {
  modelValue?: boolean
}

type TabKeysType = 'extensions' | 'scripts' | 'build-an-extension'

interface TabItem {
  title: string
  tabKey: TabKeysType
  icon: keyof typeof iconMap
  isDisabled?: boolean
}

const props = defineProps<Prop>()

const emit = defineEmits(['update:modelValue'])

const tabs = [
  {
    title: 'Extensions',
    tabKey: 'extensions',
    icon: 'ncPuzzleOutline',
  },
  {
    title: 'Scripts',
    tabKey: 'scripts',
    icon: 'ncScript',
    isDisabled: true,
  },
  {
    title: 'Build an extension',
    tabKey: 'build-an-extension',
    icon: 'ncSpanner',
    isDisabled: true,
  },
] as TabItem[]

const vModel = useVModel(props, 'modelValue', emit)

const { availableExtensions, addExtension, getExtensionAssetsUrl, showExtensionDetails } = useExtensions()

const searchQuery = ref<string>('')

const activeTab = ref<TabKeysType>('extensions')

const filteredAvailableExtensions = computed(() =>
  (availableExtensions.value || []).filter(
    (ext) =>
      ext.title.toLowerCase().includes(searchQuery.value.toLowerCase()?.trim()) ||
      ext.subTitle.toLowerCase().includes(searchQuery.value.toLowerCase()?.trim()),
  ),
)

const onExtensionClick = (extensionId: string) => {
  showExtensionDetails(extensionId)
  vModel.value = false
}

const onAddExtension = (ext: any) => {
  addExtension(ext)
  vModel.value = false
}

const handleSetActiveTab = (tab: TabItem) => {
  if (tab.isDisabled) return

  searchQuery.value = ''
  activeTab.value = tab.tabKey
}
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    :footer="null"
    size="lg"
    wrap-class-name="nc-modal-extension-market"
  >
    <div class="h-full">
      <div class="nc-extension-market-header flex items-center gap-3 p-4 border-b-1 border-gray-200">
        <div
          class="flex items-center gap-3 flex-none"
          :style="{
            width: 'calc(\(100% - 358px - 24px\) / 2)',
          }"
        >
          <GeneralIcon icon="ncPuzzleSolid" class="h-6 w-6 flex-none text-gray-700" />
          <div class="flex-1 font-semibold text-xl">Marketplace</div>
        </div>
        <div class="flex bg-nc-bg-gray-medium rounded-lg p-1">
          <div class="flex items-center">
            <NcTooltip
              v-for="(tab, idx) of tabs"
              :key="idx"
              :disabled="tab.tabKey === 'extensions'"
              class="nc-extension-market-header-tab-item"
              :class="{
                'selected ': activeTab === tab.tabKey,
              }"
            >
              <template #title> {{ $t('msg.toast.futureRelease') }}</template>
              <div
                class="px-3 py-1 flex items-center gap-2 text-xs rounded-md select-none"
                :class="{
                  'bg-white text-nc-content-gray-emphasis': activeTab === tab.tabKey,
                  'text-nc-content-gray-subtle2': activeTab !== tab.tabKey,
                  'cursor-not-allowed opacity-60': tab.isDisabled,
                  'cursor-pointer': !tab.isDisabled,
                }"
                @click="handleSetActiveTab(tab)"
              >
                <GeneralIcon :icon="tab.icon" class="h-4 w-4 flex-none !stroke-transparent opacity-75" />
                {{ tab.title }}
              </div>
            </NcTooltip>
          </div>
        </div>
        <div class="flex-1 flex gap-3 justify-end">
          <div class="flex-1 flex max-w-[290px]">
            <a-input
              v-model:value="searchQuery"
              type="text"
              class="nc-input-border-on-value !h-8 !px-3 !py-1 !rounded-lg"
              placeholder="Search for an extension or script"
              allow-clear
            >
              <template #prefix>
                <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
              </template>
            </a-input>
          </div>
          <NcButton size="small" type="text" @click="vModel = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>

      <div class="flex flex-col h-[calc(100%_-_65px)]">
        <div v-if="activeTab === 'extensions'" class="h-full py-4">
          <div class="h-full flex flex-col gap-6 flex-1 pt-2 px-6 max-w-[900px] w-full mx-auto">
            <div v-if="searchQuery" class="text-base text-nc-content-gray-subtle">Search result for ‘{{ searchQuery }}’</div>
            <div
              class="flex flex-wrap gap-4 overflow-auto nc-scrollbar-thin pb-2"
              :class="{
                'h-full': searchQuery && !filteredAvailableExtensions.length && availableExtensions.length,
              }"
            >
              <template v-for="ext of filteredAvailableExtensions" :key="ext.id">
                <div
                  class="nc-market-extension-item w-full md:w-[calc(50%_-_8px)] flex items-center gap-3 border-1 rounded-xl p-3 cursor-pointer hover:bg-gray-50 transition-all"
                  @click="onExtensionClick(ext.id)"
                >
                  <div class="h-[60px] w-[60px] overflow-hidden m-auto flex-none">
                    <img :src="getExtensionAssetsUrl(ext.iconUrl)" alt="icon" class="w-full h-full object-contain" />
                  </div>
                  <div class="flex-1 flex flex-grow flex-col gap-1">
                    <div class="font-weight-600 text-base line-clamp-1">
                      {{ ext.title }}
                    </div>

                    <div class="max-h-[32px] text-xs text-gray-500 line-clamp-2">{{ ext.subTitle }}</div>
                  </div>
                  <NcButton size="small" type="secondary" class="flex-none !px-7px" @click.stop="onAddExtension(ext)">
                    <div class="flex items-center gap-1 -ml-3px text-small">
                      <GeneralIcon icon="plus" />
                      {{ $t('general.add') }}
                    </div>
                  </NcButton>
                </div>
              </template>

              <div
                v-if="searchQuery && !filteredAvailableExtensions.length && availableExtensions.length"
                class="w-full h-full flex items-center justify-center"
              >
                <div class="pb-6 text-gray-500 flex flex-col items-center gap-6 text-center">
                  <img
                    src="~assets/img/placeholder/no-search-result-found.png"
                    class="!w-[164px] flex-none"
                    alt="No search results found"
                  />

                  {{ $t('title.noResultsMatchedYourSearch') }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <template v-else-if="activeTab === 'scripts'">
          <!-- Coming soon  -->
        </template>
        <template v-else-if="activeTab === 'build-an-extension'">
          <!-- Coming soon  -->
        </template>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-market-extension-item {
  &:hover {
    box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);
  }
}

.tab {
  @apply flex flex-row items-center gap-x-2;
}

:deep(.ant-tabs-nav) {
  @apply !pl-0;
}
:deep(.ant-tabs-tab) {
  @apply pt-2 pb-3;
}
:deep(.ant-tabs-content) {
  @apply nc-content-max-w;
}
:deep(.ant-tabs-content-top) {
  @apply !h-full;
}
.tab-info {
  @apply flex pl-1.25 px-1.5 py-0.75 rounded-md text-xs;
}
.tab-title {
  @apply flex flex-row items-center gap-x-2 py-[1px];
}
</style>

<style lang="scss">
.nc-modal-extension-market {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 864px);
    max-height: min(calc(100vh - 100px), 864px) !important;

    .nc-edit-or-add-integration-left-panel {
      @apply w-full p-6 flex-1 flex justify-center;
    }
    .nc-edit-or-add-integration-right-panel {
      @apply p-5 w-[320px] border-l-1 border-gray-200 flex flex-col gap-4 bg-gray-50 rounded-br-2xl;
    }
  }

  .nc-extension-market-header {
    .nc-extension-market-header-tab-item {
      @apply relative;

      // Add vertical line to all items except the last one
      &:not(:last-child)::after {
        @apply absolute right-0 top-[4px] h-[16px] w-[1px] bg-nc-bg-gray-dark; // Use WindiCSS utilities for line

        content: '';
        transform: scaleY(0); // Hide by default
        transition: transform 0.18s;
      }

      // Handle lines visibility based on selection
      &.selected {
        box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
      }

      // Ensure lines are shown between non-selected items
      &:not(.selected)::after {
        transform: scaleY(1);
      }

      // If supported, this will hide the line to the right of the selected item
      &:has(+ .selected)::after {
        transform: scaleY(0); // Hide the line on the right of the selected item
      }
    }
  }
}
</style>
