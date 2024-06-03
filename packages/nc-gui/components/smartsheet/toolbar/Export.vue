<script lang="ts" setup>
const { sharedView, meta, nestedFilters } = useSharedView()

const { isLocked, xWhere } = useProvideSmartsheetStore(sharedView, meta, true, ref([]), nestedFilters)

const reloadEventHook = createEventHook()

provide(ReadonlyInj, ref(true))
provide(MetaInj, meta)
provide(ActiveViewInj, sharedView)
provide(IsPublicInj, ref(true))
provide(IsLockedInj, isLocked)

useProvideViewColumns(sharedView, meta, () => reloadEventHook?.trigger(), true)
useProvideViewGroupBy(sharedView, meta, xWhere, true)
</script>

<template>
  <a-dropdown :trigger="['click']" overlay-class-name="nc-dropdown-actions-menu">
    <NcButton v-e="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn" size="xs" type="secondary">
      <div class="flex gap-2 items-center">
        <component :is="iconMap.download" class="group-hover:text-accent text-gray-500" />
        <span class="text-capitalize !text-sm font-medium text-gray-500">{{ $t('general.download') }}</span>
        <component :is="iconMap.arrowDown" class="text-grey" />
      </div>
    </NcButton>

    <template #overlay>
      <a-menu class="ml-6 !text-sm !px-0 !py-2 !rounded">
        <LazySmartsheetToolbarExportSubActions />
      </a-menu>
    </template>
  </a-dropdown>
</template>
