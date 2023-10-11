<script lang="ts" setup>
const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isMobileMode } = useGlobal()

const onClick = () => {
  if (isLeftSidebarOpen.value) return

  isLeftSidebarOpen.value = !isLeftSidebarOpen.value
}
</script>

<template>
  <NcTooltip
    v-e="['c:leftSidebar:hideToggle']"
    placement="topLeft"
    hide-on-click
    class="transition-all duration-150"
    :class="{
      'opacity-0 w-0 pointer-events-none': !isMobileMode && isLeftSidebarOpen,
      'opacity-100 max-w-10': isMobileMode || !isLeftSidebarOpen,
    }"
  >
    <template #title>
      {{ isLeftSidebarOpen ? `${$t('title.hideSidebar')}` : `${$t('title.showSidebar')}` }}
    </template>
    <NcButton
      :type="isMobileMode ? 'secondary' : 'text'"
      :size="isMobileMode ? 'medium' : 'small'"
      class="nc-sidebar-left-toggle-icon !text-gray-600 !hover:text-gray-800 w-8"
      @click="onClick"
    >
      <div class="flex items-center text-inherit">
        <GeneralIcon v-if="isMobileMode" icon="menu" class="text-lg -mt-0.25" />
        <GeneralIcon v-else icon="doubleRightArrow" class="duration-150 transition-all !text-lg -mt-0.25" />
      </div>
    </NcButton>
  </NcTooltip>
</template>
