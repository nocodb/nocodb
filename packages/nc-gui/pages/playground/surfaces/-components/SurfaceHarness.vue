<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import { seedPlaygroundStores, unmockedRequests } from '../../views/-helper/install'
import { MOCK_BASE_ID } from '../../views/-helper/mock-data'
import { SURFACE_KIND, SURFACE_VIEW_ID, installSurfaceMocks } from '../-helper/mocks'
import { UseDetachedLongTextProvider } from '~/components/smartsheet/grid/canvas/composables/useDetachedLongText'

/**
 * Smartsheet providers for the mock grid table (same set as views/ViewHarness),
 * so real toolbar / field / details components can mount anywhere in the slot.
 */

// normally installed by the route middleware; repeated for HMR remounts
installSurfaceMocks()
seedPlaygroundStores()

const { metas } = useMetas()

const basesStore = useBases()

const { activeView } = storeToRefs(useViewsStore())

const meta = computed<TableType | undefined>(() => metas.value[`${MOCK_BASE_ID}:${SURFACE_KIND}`])

const { isForm, isLocked, xWhere, eventBus } = useProvideSmartsheetStore(activeView, meta)

useViewRowColorProvider({ view: activeView, eventBus })

useProvideExpandedFormPanel()

const reloadViewDataEventHook = createEventHook()

const reloadViewMetaEventHook = createEventHook<void | boolean>()

const activeSource = computed(() => basesStore.bases.get(MOCK_BASE_ID)?.sources?.[0])

useProvideKanbanViewStore(meta, activeView)
useProvideMapViewStore(meta, activeView)
useProvideCalendarViewStore(meta, activeView, false, xWhere)
useProvideListViewStore(meta, activeView)
useProvideTimelineViewStore(meta, activeView, false, xWhere)
useProvideGanttViewStore(meta, activeView, false, xWhere)

provide(MetaInj, meta)
provide(ActiveViewInj, activeView)
provide(IsLockedInj, isLocked)
provide(ReloadViewDataHookInj, reloadViewDataEventHook)
provide(ReloadViewMetaHookInj, reloadViewMetaEventHook)
provide(OpenNewRecordFormHookInj, createEventHook<void>())
provide(IsFormInj, isForm)
provide(IsTimelineInj, ref(false))
provide(IsGanttInj, ref(false))
provide(TabMetaInj, ref({ id: SURFACE_KIND, title: meta.value?.title, type: TabType.TABLE } as TabItem))
provide(ActiveSourceInj, activeSource)
provide(ReloadAggregateHookInj, createEventHook())
provide(ReadonlyInj, ref(false))

useExpandedFormDetachedProvider()
UseDetachedLongTextProvider()

useProvideViewColumns(activeView, meta, () => reloadViewDataEventHook?.trigger())

useProvideViewGroupBy(activeView, meta, xWhere)

useProvideSmartsheetLtarHelpers(meta)

const isReady = computed(() => !!meta.value && activeView.value?.id === SURFACE_VIEW_ID)
</script>

<template>
  <div class="nc-pg-surface-harness">
    <div
      v-if="unmockedRequests.length"
      class="mb-4 px-3 py-2 rounded-lg border-1 border-nc-border-orange bg-nc-orange-50 text-captionSm"
    >
      <div class="text-captionSmBold text-nc-content-orange-dark mb-1">{{ unmockedRequests.length }} unmocked requests</div>
      <div
        v-for="req in unmockedRequests"
        :key="`${req.method}${req.url}${req.operation}`"
        class="text-captionXs font-mono text-nc-content-gray-subtle"
      >
        {{ req.method }} {{ req.url }}<span v-if="req.operation">?operation={{ req.operation }}</span>
      </div>
    </div>
    <slot v-if="isReady" :meta="meta!" :view="activeView!" />
    <div v-else class="py-24 flex items-center justify-center">
      <GeneralLoader size="xlarge" />
    </div>
  </div>
</template>
