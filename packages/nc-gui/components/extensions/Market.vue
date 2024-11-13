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

const searchWrapperRef = ref<HTMLDivElement>()

const searchRef = ref<HTMLInputElement>()

const searchQuery = ref<string>('')

const showSearchBox = ref<boolean>(true)

const activeTab = ref<TabKeysType>('extensions')

const focusSearchInput = () => {
  if (activeTab.value === 'build-an-extension') return

  nextTick(() => {
    searchRef.value?.focus()
  })
}

const handleShowSearchInput = () => {
  showSearchBox.value = true

  focusSearchInput()
}

const handleSetActiveTab = (tab: TabItem) => {
  if (tab.isDisabled) return

  searchQuery.value = ''
  activeTab.value = tab.tabKey

  handleShowSearchInput()
}

onClickOutside(searchWrapperRef, () => {
  if (searchQuery.value) {
    return
  }

  showSearchBox.value = false
})

onMounted(() => {
  focusSearchInput()
})
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
      <div class="nc-extension-market-header flex items-center gap-3 px-4 py-3 border-b-1 border-gray-200">
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
          <div v-if="activeTab !== 'build-an-extension'" ref="searchWrapperRef" class="flex-1 flex max-w-[290px] justify-end">
            <NcButton v-if="!searchQuery && !showSearchBox" class="!px-1" type="text" size="small" @click="handleShowSearchInput">
              <GeneralIcon icon="search" class="h-4 w-4 text-current" />
            </NcButton>

            <a-input
              v-if="searchQuery || showSearchBox"
              ref="searchRef"
              v-model:value="searchQuery"
              type="text"
              class="nc-input-border-on-value !h-8 !px-3 !py-1 !rounded-lg"
              :placeholder="`Search for ${activeTab === 'extensions' ? 'an extension' : 'a script'}`"
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

      <div class="flex flex-col h-[calc(100%_-_57px)]">
        <ExtensionsMarketExtensionsTab
          v-if="activeTab === 'extensions'"
          v-model:is-open="vModel"
          v-model:search-query="searchQuery"
        />

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
