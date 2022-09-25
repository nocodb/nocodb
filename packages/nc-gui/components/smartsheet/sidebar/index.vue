<script setup lang="ts">
import type { ViewType, ViewTypes } from 'nocodb-sdk'
import {
  ActiveViewInj,
  MetaInj,
  ViewListInj,
  computed,
  inject,
  provide,
  ref,
  useNuxtApp,
  useRoute,
  useRouter,
  useSidebar,
  useUIPermission,
  useViews,
  watch,
} from '#imports'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { views, loadViews } = useViews(meta)

const { isUIAllowed } = useUIPermission()

const router = useRouter()

const route = useRoute()

const { $e } = useNuxtApp()

provide(ViewListInj, views)

/** Sidebar visible */
const { isOpen } = useSidebar('nc-right-sidebar', { isOpen: true })

const sidebarCollapsed = computed(() => !isOpen.value)

/** Sidebar ref */
const sidebar = ref()

/** View type to create from modal */
let viewCreateType = $ref<ViewTypes>()

/** View title to create from modal (when duplicating) */
let viewCreateTitle = $ref('')

/** selected view id for copying view meta */
let selectedViewId = $ref('')

/** is view creation modal open */
let modalOpen = $ref(false)

/** Watch route param and change active view based on `viewTitle` */
watch(
  [views, () => route.params.viewTitle],
  ([nextViews, viewTitle]) => {
    if (viewTitle) {
      let view = nextViews.find((v) => v.title === viewTitle)
      if (view) {
        activeView.value = view
      } else {
        /** search with view id and if found replace with title */
        view = nextViews.find((v) => v.id === viewTitle)
        if (view) {
          router.replace({
            params: {
              viewTitle: view.title,
            },
          })
        }
      }
    }
    /** if active view is not found, set it to first view */
    if (!activeView.value && nextViews.length) {
      activeView.value = nextViews[0]
    }
  },
  { immediate: true },
)

/** Open view creation modal */
function openModal({ type, title = '', copyViewId }: { type: ViewTypes; title: string; copyViewId: string }) {
  modalOpen = true
  viewCreateType = type
  viewCreateTitle = title
  selectedViewId = copyViewId
}

/** Handle view creation */
function onCreate(view: ViewType) {
  views.value.push(view)
  router.push({ params: { viewTitle: view.title || '' } })
  modalOpen = false
  $e('a:view:create', { view: view.type })
}
</script>

<template>
  <a-layout-sider
    ref="sidebar"
    :collapsed="sidebarCollapsed"
    collapsiple
    collapsed-width="0"
    width="250"
    class="relative shadow-md h-full"
    theme="light"
  >
    <LazySmartsheetSidebarToolbar
      v-if="isOpen"
      class="min-h-[var(--toolbar-height)] max-h-[var(--toolbar-height)] flex items-center py-3 px-3 justify-between border-b-1"
    />
    <div v-if="isOpen" class="flex-1 flex flex-col min-h-0">
      <LazySmartsheetSidebarMenuTop @open-modal="openModal" @deleted="loadViews" />

      <div v-if="isUIAllowed('virtualViewsCreateOrEdit')" class="!my-3 w-full border-b-1" />

      <LazySmartsheetSidebarMenuBottom @open-modal="openModal" />
    </div>

    <LazyDlgViewCreate
      v-if="views"
      v-model="modalOpen"
      :title="viewCreateTitle"
      :type="viewCreateType"
      :selected-view-id="selectedViewId"
      @created="onCreate"
    />
  </a-layout-sider>
</template>

<style scoped>
:deep(.ant-menu-title-content) {
  @apply w-full;
}

:deep(.ant-layout-sider-children) {
  @apply flex flex-col;
}
</style>
