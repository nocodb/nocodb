<script lang="ts" setup>
const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isMobileMode } = useGlobal()

const onClick = () => {
  if (!isLeftSidebarOpen.value) return

  isLeftSidebarOpen.value = !isLeftSidebarOpen.value
}
</script>

<template>
  <div v-if="isMobileMode || isLeftSidebarOpen" v-e="['c:leftSidebar:hideToggle']">
    <NcTooltip
      placement="topLeft"
      hide-on-click
      class="transition-all duration-150"
      :class="{
        'opacity-0 w-0 pointer-events-none': !isMobileMode && !isLeftSidebarOpen,
        'opacity-100 max-w-10': isMobileMode || isLeftSidebarOpen,
      }"
      :disabled="!!isMobileMode"
    >
      <template #title>
        {{ isLeftSidebarOpen ? `${$t('title.hideSidebar')}` : `${$t('title.showSidebar')}` }}
      </template>
      <NcButton
        :type="isMobileMode ? 'secondary' : 'text'"
        :size="isMobileMode ? 'medium' : 'small'"
        class="nc-sidebar-left-toggle-icon !text-nc-content-gray-subtle2 !hover:text-nc-content-gray w-8"
        @click="onClick"
      >
        <div class="flex items-center text-inherit">
          <GeneralIcon v-if="isMobileMode" icon="close" />
          <GeneralIcon
            v-else
            icon="doubleLeftArrow"
            class="duration-150 transition-all !text-lg -mt-0.5 !text-nc-content-gray-muted bg-opacity-50"
            :class="{
              'transform rotate-180': !isLeftSidebarOpen,
            }"
          />
        </div>
      </NcButton>
    </NcTooltip>
  </div>
</template>
