<script setup lang="ts">
import { Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const { extensionList, isPanelExpanded, isDetailsVisible, detailsExtensionId, detailsFrom, isMarketVisible, extensionPanelSize } =
  useExtensions()

const toggleMarket = () => {
  isMarketVisible.value = !isMarketVisible.value
}
</script>

<template>
  <Pane v-if="isPanelExpanded" :size="extensionPanelSize" min-size="20%" max-size="50%" class="flex flex-col gap-3 bg-[#F0F3FF]">
    <div class="flex items-center gap-3 px-4 pt-3 font-weight-700 text-brand-500 text-base">
      <GeneralIcon icon="puzzle" class="h-5 w-5" /> Extensions
    </div>
    <template v-if="extensionList.length === 0">
      <div class="flex items-center flex-col gap-4 w-full nc-scrollbar-md text-center px-4">
        <div class="w-[180px] h-[180px] bg-[#d9d9d9] rounded-3xl mt-[100px]"></div>
        <div class="font-weight-700 text-base">No extensions added</div>
        <div>Add Extensions from the community extensions marketplace</div>
        <NcButton @click="toggleMarket" size="small">
          <div class="flex items-center gap-2 font-weight-600">
            Add Extension
            <GeneralIcon icon="plus" />
          </div>
        </NcButton>
      </div>
    </template>
    <template v-else>
      <div class="flex w-full items-center justify-between px-4">
        <div class="flex flex-grow items-center mr-2">
          <a-input type="text" class="!h-8 !px-3 !py-1 !rounded-lg" placeholder="Search Extension">
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
            </template>
          </a-input>
        </div>
        <NcButton type="ghost" size="small" class="!text-primary !bg-white" @click="toggleMarket">
          <div class="flex items-center gap-1 px-1 text-xs">
            <GeneralIcon icon="plus" />
            Add Extension
          </div>
        </NcButton>
      </div>
      <div class="nc-extension-list-wrapper flex items-center flex-col gap-3 w-full nc-scrollbar-md">
        <ExtensionsWrapper v-for="ext in extensionList" :key="ext.id" :extension-id="ext.id" />
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
</style>
