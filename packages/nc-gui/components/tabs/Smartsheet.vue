<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import {
  ActiveViewInj,
  FieldsInj,
  IsFormInj,
  IsLockedInj,
  MetaInj,
  OpenNewRecordFormHookInj,
  ReloadViewDataHookInj,
  ReloadViewMetaHookInj,
  TabMetaInj,
  computed,
  createEventHook,
  inject,
  provide,
  ref,
  toRef,
  useMetas,
  useProvideSmartsheetStore,
  useSidebar,
  watch,
} from '#imports'
import type { TabItem } from '~/lib'

const props = defineProps<{
  activeTab: TabItem
}>()

const { metas } = useMetas()

const activeTab = toRef(props, 'activeTab')

const activeView = ref()

const fields = ref<ColumnType[]>([])

const meta = computed<TableType | undefined>(() => metas.value[activeTab.value.id!])

const reloadEventHook = createEventHook()

const reloadViewMetaEventHook = createEventHook()

const openNewRecordFormHook = createEventHook()

const { isGallery, isGrid, isForm, isLocked } = useProvideSmartsheetStore(activeView, meta)

// provide the sidebar injection state
useSidebar('nc-right-sidebar', { useStorage: true, isOpen: true })

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

const treeViewIsLockedInj = inject('TreeViewIsLockedInj', ref(false))

watch(isLocked, (nextValue) => (treeViewIsLockedInj.value = nextValue), { immediate: true })
</script>

<template>
  <div class="nc-container flex h-full">
    <div class="flex flex-col h-full flex-1 min-w-0">
      <LazySmartsheetToolbar />

      <Transition name="layout" mode="out-in">
        <template v-if="meta">
          <div class="flex flex-1 min-h-0">
            <div v-if="activeView" class="h-full flex-1 min-w-0 min-h-0 bg-gray-50">
              <LazySmartsheetGrid v-if="isGrid" />

              <LazySmartsheetGallery v-else-if="isGallery" />

              <LazySmartsheetForm v-else-if="isForm && !$route.query.reload" />
            </div>
          </div>
        </template>
      </Transition>
    </div>

    <LazySmartsheetSidebar v-if="meta" class="nc-right-sidebar" />
  </div>
</template>

<style scoped>
:deep(.nc-right-sidebar.ant-layout-sider-collapsed) {
  @apply !w-0 !max-w-0 !min-w-0 overflow-x-hidden;
}
</style>
