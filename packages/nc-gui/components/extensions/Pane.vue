<script setup lang="ts">
import { Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const {
  extensionList,
  isPanelExpanded,
  isDetailsVisible,
  detailsExtensionId,
  detailsFrom,
  isMarketVisible,
  extensionPanelSize,
  toggleExtensionPanel,
} = useExtensions()

const isReady = ref(false)

const searchQuery = ref<string>('')

const filteredExtensionList = computed(() =>
  (extensionList.value || []).filter((ext) => ext.title.toLowerCase().includes(searchQuery.value.toLowerCase())),
)

const toggleMarket = () => {
  isMarketVisible.value = !isMarketVisible.value
}

const normalizePaneMaxWidth = computed(() => {
  if (isReady.value) {
    return 60
  } else {
    return extensionPanelSize.value
  }
})

defineExpose({
  onReady: () => {
    isReady.value = true
  },
})

watch(isPanelExpanded, (newValue) => {
  if (newValue && !isReady.value) {
    setTimeout(() => {
      isReady.value = true
    }, 300)
  }
})
</script>

<template>
  <Pane
    v-if="isPanelExpanded"
    :size="extensionPanelSize"
    min-size="10%"
    max-size="60%"
    class="nc-extension-pane"
    :style="{
      minWidth: isReady ? '300px' : `${normalizePaneMaxWidth}%`,
      maxWidth: `${normalizePaneMaxWidth}%`,
    }"
  >
    <div class="flex justify-between items-center px-4 pt-3">
      <div class="flex items-center gap-3 font-weight-700 text-brand-500 text-base">
        <GeneralIcon icon="puzzle" class="h-5 w-5" /> Extensions
      </div>
      <NcTooltip class="flex" hide-on-click placement="topRight">
        <template #title> Hide extensions </template>
        <NcButton
          size="xxsmall"
          type="text"
          class="!text-gray-700 !hover:text-gray-800 !hover:bg-gray-200"
          @click="toggleExtensionPanel"
        >
          <div class="flex items-center justify-center">
            <GeneralIcon icon="doubleRightArrow" class="flex-none !text-gray-500/75" />
          </div>
        </NcButton>
      </NcTooltip>
    </div>
    <template v-if="extensionList.length === 0">
      <div class="flex items-center flex-col gap-4 w-full nc-scrollbar-md text-center px-4">
        <div class="w-[180px] h-[180px] bg-[#d9d9d9] rounded-3xl mt-[100px]"></div>
        <div class="font-weight-700 text-base">No extensions added</div>
        <div>Add Extensions from the community extensions marketplace</div>
        <NcButton size="small" @click="toggleMarket">
          <div class="flex items-center gap-2 font-weight-600">
            <GeneralIcon icon="plus" />
            Add Extension
          </div>
        </NcButton>
      </div>
    </template>
    <template v-else>
      <div class="flex w-full items-center justify-between px-4">
        <div class="flex flex-grow items-center mr-2">
          <a-input
            v-model:value="searchQuery"
            type="text"
            class="!h-8 !px-3 !py-1 !rounded-lg"
            placeholder="Search Extension"
            allow-clear
          >
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
            </template>
          </a-input>
        </div>
        <NcButton type="ghost" size="small" class="!text-primary !bg-white children:children:max-w-full" @click="toggleMarket">
          <div class="flex items-center gap-1 text-xs max-w-full">
            <GeneralIcon icon="plus" />
            <NcTooltip
              class="max-w-[calc(100%_-_16px)] truncate"
              show-on-truncate-only
              overlay-class-name="children:-ml-2"
              modifier-key=""
            >
              <template #title> Add Extension </template>
              Add Extension
            </NcTooltip>
          </div>
        </NcButton>
      </div>
      <div
        class="nc-extension-list-wrapper flex items-center flex-col gap-3 w-full nc-scrollbar-md"
        :class="{
          'h-full': searchQuery && !filteredExtensionList.length && extensionList.length,
        }"
      >
        <ExtensionsWrapper v-for="ext in filteredExtensionList" :key="ext.id" :extension-id="ext.id" />

        <div
          v-if="searchQuery && !filteredExtensionList.length && extensionList.length"
          class="w-full h-full flex-1 flex items-center justify-center"
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
    </template>
    <ExtensionsMarket v-if="isMarketVisible" v-model="isMarketVisible" />
    <ExtensionsDetails
      v-if="isDetailsVisible && detailsExtensionId"
      v-model="isDetailsVisible"
      :extension-id="detailsExtensionId"
      :from="detailsFrom"
    />
  </Pane>
</template>

<style lang="scss" scoped>
.nc-extension-list-wrapper {
  &:last-child {
    @apply pb-3;
  }
}

.nc-extension-pane{
  @apply flex flex-col gap-3 bg-gray-50 rounded-l-xl border-1 border-gray-200 z-30;

  box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.16), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
}
</style>
