<script lang="ts" setup>
const { openedViewsTab, activeView } = storeToRefs(useViewsStore())

const { isUIAllowed } = useRoles()

const { onViewsTabChange } = useViewsStore()

const onClickDetails = () => {
  if (isUIAllowed('fieldAdd')) {
    onViewsTabChange('field')
  } else {
    onViewsTabChange('relation')
  }
}
</script>

<template>
  <div class="flex flex-row p-1 bg-gray-200 rounded-lg gap-x-0.5 nc-view-sidebar-tab">
    <div
      v-e="['c:project:mode:data']"
      class="tab"
      :class="{
        active: openedViewsTab === 'view',
      }"
      @click="onViewsTabChange('view')"
    >
      <GeneralViewIcon v-if="activeView?.type" :meta="{ type: activeView?.type }" class="tab-icon" ignore-color />
      <GeneralLoader v-else class="tab-icon" />
      <div class="tab-title nc-tab">{{ $t('general.data') }}</div>
    </div>
    <div
      v-e="['c:project:mode:details']"
      class="tab"
      :class="{
        active: openedViewsTab !== 'view',
      }"
      @click="onClickDetails"
    >
      <GeneralIcon
        icon="ncErd"
        class="tab-icon"
        :class="{}"
        :style="{
          fontWeight: 500,
        }"
      />
      <div class="tab-title nc-tab">{{ $t('general.details') }}</div>
    </div>
  </div>
</template>

<style scoped>
.tab {
  @apply flex flex-row items-center h-6 justify-center px-2 py-1 rounded-md gap-x-2 text-gray-600 hover:text-black cursor-pointer transition-all duration-300 select-none;
}

.tab-icon {
  font-size: 1rem !important;
  @apply w-4;
}
.tab .tab-title {
  @apply min-w-0;
  word-break: keep-all;
  white-space: nowrap;
  display: inline;
  line-height: 0.95;
}

.active {
  @apply bg-white text-brand-600 hover:text-brand-600;

  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
}
</style>
