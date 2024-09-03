<script setup lang="ts">
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isLinksOrLTAR } from 'nocodb-sdk'

const props = defineProps<{
  activeTab: TabItem
}>()

const { isUIAllowed } = useRoles()

const { metas, getMeta } = useMetas()

useSidebar('nc-right-sidebar')

const { isMobileMode } = useGlobal()

const activeTab = toRef(props, 'activeTab')

const route = useRoute()

const meta = computed<TableType | undefined>(() => {
  const viewId = route.params.viewId as string
  return viewId && metas.value[viewId]
})

const { handleSidebarOpenOnMobileForNonViews } = useConfigStore()
const { activeTableId } = storeToRefs(useTablesStore())

const { activeView, openedViewsTab, activeViewTitleOrId } = storeToRefs(useViewsStore())
const { isGallery, isGrid, isForm, isKanban, isLocked, isMap, isCalendar, xWhere } = useProvideSmartsheetStore(activeView, meta)

useSqlEditor()

const reloadViewDataEventHook = createEventHook()

const reloadViewMetaEventHook = createEventHook<void | boolean>()

const openNewRecordFormHook = createEventHook<void>()

const { base } = storeToRefs(useBase())

const activeSource = computed(() => {
  return meta.value?.source_id && base.value && base.value.sources?.find((source) => source.id === meta.value?.source_id)
})

useProvideKanbanViewStore(meta, activeView)
useProvideMapViewStore(meta, activeView)
useProvideCalendarViewStore(meta, activeView)

// todo: move to store
provide(MetaInj, meta)
provide(ActiveViewInj, activeView)
provide(IsLockedInj, isLocked)
provide(ReloadViewDataHookInj, reloadViewDataEventHook)
provide(ReloadViewMetaHookInj, reloadViewMetaEventHook)
provide(OpenNewRecordFormHookInj, openNewRecordFormHook)
provide(IsFormInj, isForm)
provide(TabMetaInj, activeTab)
provide(ActiveSourceInj, activeSource)
provide(ReloadAggregateHookInj, createEventHook())

provide(
  ReadonlyInj,
  computed(
    () =>
      !isUIAllowed('dataEdit', {
        skipSourceCheck: true,
      }),
  ),
)
useExpandedFormDetachedProvider()

useProvideViewColumns(activeView, meta, () => reloadViewDataEventHook?.trigger())

useProvideViewGroupBy(activeView, meta, xWhere)

useProvideSmartsheetLtarHelpers(meta)

const grid = ref()

const extensionPaneRef = ref()

const onDrop = async (event: DragEvent) => {
  event.preventDefault()
  try {
    // Access the dropped data
    const data = JSON.parse(event.dataTransfer!.getData('text/json') || '{}')
    // Do something with the received data

    // if dragged item is not from the same source, return
    if (data.sourceId !== meta.value?.source_id) return

    // if dragged item or opened view is not a table, return
    if (data.type !== 'table' || meta.value?.type !== 'table') return

    const childMeta = await getMeta(data.id)
    const parentMeta = metas.value[meta.value.id!]

    if (!childMeta || !parentMeta) return

    const parentPkCol = parentMeta.columns?.find((c) => c.pk)
    const childPkCol = childMeta.columns?.find((c) => c.pk)

    // if already a link column exists, create a new Lookup column
    const relationCol = parentMeta.columns?.find((c: ColumnType) => {
      if (!isLinksOrLTAR(c)) return false

      const ltarOptions = c.colOptions as LinkToAnotherRecordType

      if (ltarOptions.type !== 'mm') {
        return false
      }

      if (c.system) return false

      if (ltarOptions.fk_related_model_id === childMeta.id) {
        return true
      }

      return false
    })

    if (relationCol) {
      const lookupCol = childMeta.columns?.find((c) => c.pv) ?? childMeta.columns?.[0]
      grid.value?.openColumnCreate({
        uidt: UITypes.Lookup,
        title: `${data.title} Lookup`,
        fk_relation_column_id: relationCol.id,
        fk_lookup_column_id: lookupCol?.id,
      })
    } else {
      if (!parentPkCol) {
        message.error('Parent table does not have a primary key column')
        return
      }

      if (!childPkCol) {
        message.error('Child table does not have a primary key column')
        return
      }

      grid.value?.openColumnCreate({
        uidt: UITypes.Links,
        title: `${data.title}List`,
        parentId: parentMeta.id,
        childId: childMeta.id,
        parentTable: parentMeta.title,
        parentColumn: parentPkCol.title,
        childTable: childMeta.title,
        childColumn: childPkCol?.title,
      })
    }
  } catch (e) {
    console.log('error', e)
  }
}

watch([activeViewTitleOrId, activeTableId], () => {
  handleSidebarOpenOnMobileForNonViews()
})

const { leftSidebarWidth, windowSize } = storeToRefs(useSidebarStore())

const { isPanelExpanded, extensionPanelSize } = useExtensions()

const contentSize = computed(() => {
  if (isPanelExpanded.value && extensionPanelSize.value) {
    return 100 - extensionPanelSize.value
  } else {
    return 100
  }
})

const contentMaxSize = computed(() => {
  if (!isPanelExpanded.value) {
    return 100
  } else {
    return ((windowSize.value - leftSidebarWidth.value - 300) / (windowSize.value - leftSidebarWidth.value)) * 100
  }
})

const onResize = (sizes: { min: number; max: number; size: number }[]) => {
  if (sizes.length === 2) {
    if (!sizes[1].size) return
    extensionPanelSize.value = sizes[1].size
  }
}

const onReady = () => {
  if (isPanelExpanded.value && extensionPaneRef.value) {
    // wait until extension pane animation complete
    setTimeout(() => {
      extensionPaneRef.value?.onReady()
    }, 300)
  }
}
</script>

<template>
  <div class="nc-container flex flex-col h-full" @drop="onDrop" @dragover.prevent>
    <LazySmartsheetTopbar />
    <div style="height: calc(100% - var(--topbar-height))">
      <Splitpanes
        v-if="openedViewsTab === 'view'"
        class="nc-extensions-content-resizable-wrapper"
        @ready="() => onReady()"
        @resized="onResize"
      >
        <Pane
          class="flex flex-col h-full min-w-0"
          :max-size="contentMaxSize"
          :size="contentSize"
        >
          <LazySmartsheetToolbar v-if="!isForm" />
          <div
            :style="{ height: isForm || isMobileMode ? '100%' : 'calc(100% - var(--toolbar-height))' }"
            class="flex flex-row w-full"
          >
            <Transition name="layout" mode="out-in">
              <div v-if="openedViewsTab === 'view'" class="flex flex-1 min-h-0 w-3/4">
                <div class="h-full flex-1 min-w-0 min-h-0 bg-white">
                  <LazySmartsheetGrid v-if="isGrid || !meta || !activeView" ref="grid" />

                  <template v-if="activeView && meta">
                    <LazySmartsheetGallery v-if="isGallery" />

                    <LazySmartsheetForm v-else-if="isForm && !$route.query.reload" />

                    <LazySmartsheetKanban v-else-if="isKanban" />

                    <LazySmartsheetCalendar v-else-if="isCalendar" />

                    <LazySmartsheetMap v-else-if="isMap" />
                  </template>
                </div>
              </div>
            </Transition>
          </div>
        </Pane>
        <ExtensionsPane ref="extensionPaneRef" />
      </Splitpanes>
      <SmartsheetDetails v-else />
    </div>
    <LazySmartsheetExpandedFormDetached />
  </div>
</template>

<style lang="scss">
:deep(.nc-right-sidebar.ant-layout-sider-collapsed) {
  @apply !w-0 !max-w-0 !min-w-0 overflow-x-hidden;
}

.nc-extensions-content-resizable-wrapper > {
  .splitpanes__splitter {
    @apply !w-0 relative overflow-visible z-40 -ml-1px;
  }
  .splitpanes__splitter:before {
    @apply bg-gray-200 absolute left-0 top-[12px] h-[calc(100%_-_24px)] rounded-full z-40;
    content: '';
  }

  .splitpanes__splitter:hover:before {
    @apply bg-scrollbar;
    width: 3px !important;
    left: 0px;
  }

  .splitpanes--dragging .splitpanes__splitter:before {
    @apply bg-scrollbar;
    width: 3px !important;
    left: 0px;
  }

  .splitpanes--dragging .splitpanes__splitter {
    @apply w-1 mr-0;
  }
}

.splitpanes__pane {
  transition: width 0.15s ease-in-out !important;
}

.splitpanes--dragging {
  cursor: col-resize;

  > .splitpanes__pane {
    transition: none !important;
  }
}
</style>
