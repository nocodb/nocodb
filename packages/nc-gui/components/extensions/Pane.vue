<script setup lang="ts">
import { Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import Draggable from 'vuedraggable'
import type { ExtensionType } from '#imports'

const {
  extensionList,
  isPanelExpanded,
  isDetailsVisible,
  detailsExtensionId,
  detailsFrom,
  isMarketVisible,
  extensionPanelSize,
  updateExtension,
} = useExtensions()

const { $e } = useNuxtApp()

const isReady = ref(false)

const searchExtensionRef = ref<HTMLInputElement>()

const extensionHeaderRef = ref<HTMLDivElement>()

const searchQuery = ref<string>('')

const showSearchBox = ref(false)

const panelSize = computed(() => {
  if (isPanelExpanded.value) {
    return extensionPanelSize.value
  }
  return 0
})

const { width } = useElementSize(extensionHeaderRef)

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

onClickOutside(searchExtensionRef, () => {
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
    :size="panelSize"
    max-size="60%"
    class="nc-extension-pane"
    :style="
      !isReady
        ? {
            maxWidth: `${extensionPanelSize}%`,
          }
        : {}
    "
  >
    <Transition name="layout" :duration="150">
      <div v-if="isPanelExpanded" class="flex flex-col">
        <div
          ref="extensionHeaderRef"
          class="h-[var(--toolbar-height)] flex items-center gap-3 px-4 py-2 border-b-1 border-gray-200 bg-white"
        >
          <div
            class="flex items-center gap-3 font-weight-700 text-gray-700 text-base"
            :class="{
              'flex-1': !isOpenSearchBox,
            }"
          >
            <GeneralIcon icon="ncPuzzleSolid" class="h-5 w-5 text-gray-700 opacity-85" />
            <span v-if="!isOpenSearchBox || width >= 507">{{ $t('general.extensions') }}</span>
          </div>
          <div
            class="flex justify-end"
            :class="{
              'flex-1': isOpenSearchBox,
            }"
          >
            <NcButton v-if="!isOpenSearchBox" size="xs" type="text" class="!px-1" @click="handleShowSearchInput">
              <GeneralIcon icon="search" class="flex-none !text-gray-500" />
            </NcButton>
            <div v-else class="flex flex-grow items-center justify-end !max-w-[300px]">
              <a-input
                ref="searchExtensionRef"
                v-model:value="searchQuery"
                type="text"
                class="nc-input-border-on-value !h-7 !px-3 !py-1 !rounded-lg"
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
            <div class="flex items-center gap-1 text-xs max-w-full -ml-3px">
              <GeneralIcon icon="plus" />
              {{ $t('general.add') }}
            </div>
          </NcButton>
        </div>
        <template v-if="extensionList.length === 0">
          <div class="flex items-center flex-col gap-4 w-full nc-scrollbar-md text-center p-4">
            <GeneralIcon icon="ncPuzzleSolid" class="h-12 w-12 flex-none mt-[120px] text-gray-500 !stroke-transparent" />

            <div class="font-weight-700 text-base">No extensions added</div>
            <div class="text-sm text-gray-700">Add Extensions from the community extensions marketplace</div>
            <NcButton size="small" @click="toggleMarket">
              <div class="flex items-center gap-1 -ml-3px">
                <GeneralIcon icon="plus" />
                {{ $t('general.add') }} {{ $t('general.extension') }}
              </div>
            </NcButton>
            <!-- Todo: add docs link  -->
            <NcButton size="small" type="secondary">
              <div class="flex items-center gap-1.5">
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
            <template v-if="searchQuery && !filteredExtensionList.length && extensionList.length" #header>
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
      </div>
    </Transition>
  </Pane>
</template>

<style lang="scss" scoped>
.nc-extension-list-wrapper {
  &:last-child {
    @apply pb-3;
  }
}

.nc-extension-pane {
  @apply flex flex-col bg-gray-50 rounded-l-xl border-1 border-gray-200 z-30 -mt-1px;

  box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.16), 0px 8px 8px -4px rgba(0, 0, 0, 0.04);
}
</style>
