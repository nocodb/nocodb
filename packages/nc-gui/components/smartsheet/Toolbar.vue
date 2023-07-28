<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'
import {
  IsPublicInj,
  inject,
  ref,
  useSharedView,
  useSidebar,
  useSmartsheetStoreOrThrow,
  useUIPermission,
  useViewsStore,
} from '#imports'

const { isGrid, isForm, isGallery, isKanban, isMap, isSqlView } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isViewsLoading } = storeToRefs(useViewsStore())

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useUIPermission()

const { allowCSVDownload } = useSharedView()
</script>

<template>
  <div
    class="nc-table-toolbar h-20 py-1 flex gap-2 items-center pr-2 pl-2.5 border-b border-gray-75 overflow-hidden"
    :class="{ 'nc-table-toolbar-mobile': isMobileMode, 'h-[var(--topbar-height)]': !isMobileMode }"
    style="z-index: 7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <LazySmartsheetToolbarViewInfo v-if="!isPublic" />

      <div v-if="!isMobileMode" class="flex-1" />

      <LazySmartsheetToolbarMappedBy v-if="isMap" />

      <GeneralApiLoader />

      <LazySmartsheetToolbarStackedBy v-if="isKanban" />

      <LazySmartsheetToolbarFieldsMenu v-if="isGrid || isGallery || isKanban || isMap" :show-system-fields="false" />

      <LazySmartsheetToolbarColumnFilterMenu v-if="isGrid || isGallery || isKanban || isMap" />

      <LazySmartsheetToolbarGroupByMenu v-if="isGrid || isGallery || isKanban || isMap" />

      <LazySmartsheetToolbarSortListMenu v-if="isGrid || isGallery || isKanban" />

      <LazySmartsheetToolbarRowHeight v-if="isGrid" />

      <LazySmartsheetToolbarQrScannerButton v-if="isMobileMode && (isGrid || isKanban || isGallery)" />

      <LazySmartsheetToolbarExport v-if="(!isPublic && !isUIAllowed('dataInsert')) || (isPublic && allowCSVDownload)" />

      <LazySmartsheetToolbarSearchData v-if="(isGrid || isGallery || isKanban) && !isPublic" class="shrink" />

      <LazyGeneralShareProject v-if="(isForm || isGrid || isKanban || isGallery || isMap) && !isPublic" is-view-toolbar />

      <LazySmartsheetToolbarViewActions
        v-if="(isGrid || isGallery || isKanban || isMap) && !isPublic && isUIAllowed('dataInsert')"
        :show-system-fields="false"
      />
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
