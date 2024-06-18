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
  <div class="flex flex-row p-1 mx-3 mt-3 mb-3 bg-gray-100 rounded-lg gap-x-0.5 nc-view-sidebar-tab">
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
        icon="erd"
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
  @apply flex flex-row items-center h-7.5 justify-center px-2 py-1 bg-gray-100 rounded-lg gap-x-1.5 text-gray-500 hover:text-black cursor-pointer transition-all duration-300 select-none;
}

.tab-icon {
  font-size: 1.1rem !important;
  @apply w-4.5;
}
.tab .tab-title {
  @apply min-w-0;
  word-break: keep-all;
  white-space: nowrap;
  display: inline;
  line-height: 0.95;
}

.active {
  @apply bg-white shadow text-brand-500 hover:text-brand-500;
}
</style>
