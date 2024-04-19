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
  <Pane v-if="isPanelExpanded" :size="extensionPanelSize" class="flex flex-col bg-orange-50">
    <div class="flex items-center pl-3 pt-3 font-weight-800 text-orange-500">Extensions</div>
    <template v-if="extensionList.length === 0">
      <div class="flex items-center flex-col gap-2 w-full nc-scrollbar-md">
        <div class="w-[100px] h-[100px] bg-gray-200 rounded-lg mt-[100px]"></div>
        <div class="font-weight-700">No extensions added</div>
        <div>Add Extensions from the community extensions marketplace</div>
        <NcButton @click="toggleMarket">
          <div class="flex items-center gap-2 font-weight-600">
            <GeneralIcon icon="plus" />
            Add Extension
          </div>
        </NcButton>
      </div>
    </template>
    <template v-else>
      <div class="flex w-full items-center justify-between py-2 px-2 bg-orange-50">
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
      <div class="flex items-center flex-col w-full nc-scrollbar-md">
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

<style lang="scss"></style>
