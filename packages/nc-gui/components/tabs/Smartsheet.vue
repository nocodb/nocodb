<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isLinksOrLTAR } from 'nocodb-sdk'

import {
  ActiveViewInj,
  FieldsInj,
  IsFormInj,
  IsLockedInj,
  MetaInj,
  OpenNewRecordFormHookInj,
  ReadonlyInj,
  ReloadViewDataHookInj,
  ReloadViewMetaHookInj,
  TabMetaInj,
  computed,
  createEventHook,
  provide,
  ref,
  toRef,
  useMetas,
  useProvideKanbanViewStore,
  useProvideSmartsheetStore,
  useRoles,
  useSqlEditor,
} from '#imports'
import type { TabItem } from '#imports'

const props = defineProps<{
  activeTab: TabItem
}>()

const { isUIAllowed } = useRoles()

const { metas, getMeta } = useMetas()

useSidebar('nc-right-sidebar')

const activeTab = toRef(props, 'activeTab')

const fields = ref<ColumnType[]>([])

const route = useRoute()

const meta = computed<TableType | undefined>(() => {
  const viewId = route.params.viewId as string
  return viewId && metas.value[viewId]
})

const { handleSidebarOpenOnMobileForNonViews } = useConfigStore()
const { activeTableId } = storeToRefs(useTablesStore())

const { activeView, openedViewsTab, activeViewTitleOrId } = storeToRefs(useViewsStore())
const { isGallery, isGrid, isForm, isKanban, isLocked, isMap } = useProvideSmartsheetStore(activeView, meta)

useSqlEditor()

const reloadEventHook = createEventHook<void | boolean>()

const reloadViewMetaEventHook = createEventHook<void | boolean>()

const openNewRecordFormHook = createEventHook<void>()

useProvideKanbanViewStore(meta, activeView)
useProvideMapViewStore(meta, activeView)

// todo: move to store
provide(MetaInj, meta)
provide(ActiveViewInj, activeView)
provide(IsLockedInj, isLocked)
provide(ReloadViewDataHookInj, reloadEventHook)
provide(ReloadViewMetaHookInj, reloadViewMetaEventHook)
provide(OpenNewRecordFormHookInj, openNewRecordFormHook)
provide(FieldsInj, fields)
provide(IsFormInj, isForm)
provide(TabMetaInj, activeTab)
provide(
  ReadonlyInj,
  computed(() => !isUIAllowed('dataEdit')),
)

useProvideViewColumns(activeView, meta, () => reloadEventHook?.trigger())

const grid = ref()

const onDrop = async (event: DragEvent) => {
  event.preventDefault()
  try {
    // Access the dropped data
    const data = JSON.parse(event.dataTransfer!.getData('text/json'))
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
</script>

<template>
  <div class="nc-container flex flex-col h-full" @drop="onDrop" @dragover.prevent>
    <LazySmartsheetTopbar />
    <div style="height: calc(100% - var(--topbar-height))">
      <div v-if="openedViewsTab === 'view'" class="flex flex-col h-full flex-1 min-w-0">
        <LazySmartsheetToolbar v-if="!isForm" />
        <div class="flex flex-row w-full" style="height: calc(100% - var(--topbar-height))">
          <Transition name="layout" mode="out-in">
            <template v-if="meta">
              <div class="flex flex-1 min-h-0 w-3/4">
                <div v-if="activeView" class="h-full flex-1 min-w-0 min-h-0 bg-white">
                  <LazySmartsheetGrid v-if="isGrid" ref="grid" />

                  <LazySmartsheetGallery v-else-if="isGallery" />

                  <LazySmartsheetForm v-else-if="isForm && !$route.query.reload" />

                  <LazySmartsheetKanban v-else-if="isKanban" />

                  <LazySmartsheetMap v-else-if="isMap" />
                </div>
              </div>
            </template>
          </Transition>
        </div>
      </div>
      <SmartsheetDetails v-else />
    </div>
    <LazySmartsheetExpandedFormDetached />
  </div>
</template>

<style scoped>
:deep(.nc-right-sidebar.ant-layout-sider-collapsed) {
  @apply !w-0 !max-w-0 !min-w-0 overflow-x-hidden;
}
</style>
