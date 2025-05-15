<script lang="ts" setup>
const { sharedView, meta, nestedFilters } = useSharedView()

const { isLocked, xWhere } = useProvideSmartsheetStore(sharedView, meta, true, ref([]), nestedFilters)

const reloadEventHook = createEventHook()

provide(ReloadViewDataHookInj, reloadEventHook)

provide(ReadonlyInj, ref(true))

provide(MetaInj, meta)

provide(ActiveViewInj, sharedView)

provide(IsPublicInj, ref(true))

provide(IsLockedInj, isLocked)

useProvideViewColumns(sharedView, meta, () => reloadEventHook?.trigger(), true)

useProvideViewGroupBy(sharedView, meta, xWhere, true)

useProvideSmartsheetLtarHelpers(meta)

useProvideKanbanViewStore(meta, sharedView)

useProvideCalendarViewStore(meta, sharedView, true, nestedFilters)
</script>

<template>
  <NcDropdown :trigger="['click']" overlay-class-name="nc-dropdown-actions-menu">
    <NcButton v-e="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn" size="xs" type="secondary">
      <div class="flex gap-2 items-center text-gray-700">
        <component :is="iconMap.download" class="group-hover:text-accent" />
        <span class="text-capitalize !text-sm font-medium xs:hidden">{{ $t('general.download') }}</span>
        <component :is="iconMap.arrowDown" class="text-grey" />
      </div>
    </NcButton>

    <template #overlay>
      <NcMenu variant="small" class="ml-6 !text-sm !rounded-lg overflow-hidden">
        <LazySmartsheetToolbarExportSubActions />
      </NcMenu>
    </template>
  </NcDropdown>
</template>
