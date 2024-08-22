<script setup lang="ts">
import type { ExtensionType } from '#imports'
import { Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import Draggable from 'vuedraggable'

const {
  extensionList,
  isPanelExpanded,
  isDetailsVisible,
  detailsExtensionId,
  detailsFrom,
  isMarketVisible,
  extensionPanelSize,
  toggleExtensionPanel,
  updateExtension,
} = useExtensions()

const { $e } = useNuxtApp()

const isReady = ref(false)

const searchExtensionRef = ref<HTMLInputElement>()

const searchExtensionWrapperRef = ref<HTMLDivElement>()

const searchQuery = ref<string>('')

const showSearchBox = ref(false)

const isOpenSearchBox = computed(() => {
  return !!(searchQuery.value || showSearchBox.value)
})

const handleShowSearchInput = () => {
  showSearchBox.value = true

  nextTick(() => {
    searchExtensionRef.value?.focus()
  })
}

const handleCloseSearchbox = () => {
  showSearchBox.value = false
  searchQuery.value = ''
}

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

const onMove = async (_event: { moved: { newIndex: number; oldIndex: number; element: ExtensionType } }) => {
  let {
    moved: { newIndex = 0, oldIndex = 0, element },
  } = _event

  element = extensionList.value?.find((ext) => ext.id === element.id) || element

  if (!element?.id) return

  newIndex = extensionList.value.findIndex((ext) => ext.id === filteredExtensionList.value[newIndex].id)

  oldIndex = extensionList.value.findIndex((ext) => ext.id === filteredExtensionList.value[oldIndex].id)

  let nextOrder: number

  // set new order value based on the new order of the items
  if (extensionList.value.length - 1 === newIndex) {
    // If moving to the end, set nextOrder greater than the maximum order in the list
    nextOrder = Math.max(...extensionList.value.map((item) => item?.order ?? 0)) + 1
  } else if (newIndex === 0) {
    // If moving to the beginning, set nextOrder smaller than the minimum order in the list
    nextOrder = Math.min(...extensionList.value.map((item) => item?.order ?? 0)) / 2
  } else {
    nextOrder =
      (parseFloat(String(extensionList.value[newIndex - 1]?.order ?? 0)) +
        parseFloat(String(extensionList.value[newIndex + 1]?.order ?? 0))) /
      2
  }

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  await updateExtension(element.id, {
    order: _nextOrder,
  })

  $e('a:extension:reorder')
}

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

onClickOutside(searchExtensionWrapperRef, () => {
  if (searchQuery.value) {
    return
  }

  showSearchBox.value = false
})

onMounted(() => {
  if (searchQuery.value && !showSearchBox.value) {
    showSearchBox.value = true
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
    <div class="h-[var(--toolbar-height)] flex items-center gap-3 px-4 py-2 border-b-1 border-gray-200 bg-white">
      <NcTooltip v-if="false" class="flex" hide-on-click placement="topRight">
        <template #title> Hide extensions </template>
        <NcButton
          size="xs"
          type="text"
          class="!text-gray-700 !hover:text-gray-800 !hover:bg-gray-200"
          @click="toggleExtensionPanel"
        >
          <div class="flex items-center justify-center">
            <GeneralIcon icon="doubleRightArrow" class="flex-none !text-gray-500/75" />
          </div>
        </NcButton>
      </NcTooltip>
      <div
        class="flex items-center gap-3 font-weight-700 text-gray-700 text-base"
        :class="{
          'flex-1': !isOpenSearchBox,
        }"
      >
        <GeneralIcon icon="ncPuzzleSolid" class="h-6 w-6" />
        <span v-if="!isOpenSearchBox">Extensions</span>
      </div>
      <div
        ref="searchExtensionWrapperRef"
        :class="{
          'flex-1': isOpenSearchBox,
        }"
      >
        <NcButton v-if="!isOpenSearchBox" size="xs" type="text" class="!px-1" @click="handleShowSearchInput">
          <GeneralIcon icon="search" class="flex-none !text-gray-500" />
        </NcButton>
        <div v-else class="flex flex-grow items-center justify-end">
          <a-input
            ref="searchExtensionRef"
            v-model:value="searchQuery"
            type="text"
            class="nc-input-border-on-value !h-7 !px-3 !py-1 !rounded-lg !max-w-[350px]"
            placeholder="Search Extension"
            allow-clear
            @keydown.esc="handleCloseSearchbox"
          >
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
            </template>
          </a-input>
        </div>
      </div>
      <NcButton type="secondary" size="xs" @click="toggleMarket">
        <div class="flex items-center gap-1 text-xs max-w-full">
          <GeneralIcon icon="plus" />
          Add
        </div>
      </NcButton>
    </div>
    <template v-if="extensionList.length === 0">
      <div class="flex items-center flex-col gap-4 w-full nc-scrollbar-md text-center p-4">
        <GeneralIcon icon="ncPuzzleSolid" class="h-12 w-12 flex-none mt-[120px] text-gray-500 !stroke-transparent" />

        <div class="font-weight-700 text-base">No extensions added</div>
        <div class="text-sm text-gray-700">Add Extensions from the community extensions marketplace</div>
        <NcButton size="small" @click="toggleMarket">
          <div class="flex items-center gap-2 font-weight-600">
            <GeneralIcon icon="plus" />
            Add Extension
          </div>
        </NcButton>
        <!-- Todo: add docs link  -->
        <NcButton size="small" type="secondary">
          <div class="flex items-center gap-2 font-weight-600">
            <GeneralIcon icon="externalLink" />
            {{ $t('activity.goToDocs') }}
          </div>
        </NcButton>
      </div>
    </template>
    <template v-else>
      <Draggable
        :model-value="filteredExtensionList"
        draggable=".nc-extension-item"
        item-key="id"
        handle=".nc-extension-drag-handler"
        ghost-class="ghost"
        class="nc-extension-list-wrapper flex items-center flex-col gap-3 w-full nc-scrollbar-md py-4"
        :class="{
          'h-full': searchQuery && !filteredExtensionList.length && extensionList.length,
        }"
        @start="(e) => e.target.classList.add('grabbing')"
        @end="(e) => e.target.classList.remove('grabbing')"
        @change="onMove($event)"
      >
        <template #item="{ element: ext }">
          <div class="nc-extension-item w-full">
            <ExtensionsWrapper :extension-id="ext.id" />
          </div>
        </template>
        <template #header v-if="searchQuery && !filteredExtensionList.length && extensionList.length">
          <div class="w-full h-full flex-1 flex items-center justify-center">
            <div class="pb-6 text-gray-500 flex flex-col items-center gap-6 text-center">
              <img
                src="~assets/img/placeholder/no-search-result-found.png"
                class="!w-[164px] flex-none"
                alt="No search results found"
              />

              {{ $t('title.noResultsMatchedYourSearch') }}
            </div>
          </div>
        </template>
      </Draggable>
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

.nc-extension-pane {
  @apply flex flex-col bg-gray-50 rounded-tl-xl border-1 border-gray-200 z-30;

  box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.16), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
}
</style>
