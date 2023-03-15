<script setup lang="ts">
import type { ViewType, ViewTypes } from 'nocodb-sdk'
import {
  ActiveViewInj,
  MetaInj,
  computed,
  inject,
  ref,
  resolveComponent,
  storeToRefs,
  useCommandPalette,
  useDialog,
  useNuxtApp,
  useRoute,
  useRouter,
  useSidebar,
  useUIPermission,
  useViews,
  watch,
} from '#imports'

const { refreshCommandPalette } = useCommandPalette()

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { activeTab } = storeToRefs(useTabs())

const { views, loadViews, isLoading } = useViews(meta)

const { lastOpenedViewMap } = storeToRefs(useProject())

const setLastOpenedViewId = (viewId?: string) => {
  if (viewId && activeTab.value?.id) {
    lastOpenedViewMap.value[activeTab.value?.id] = viewId
  }
}

const { isUIAllowed } = useUIPermission()

const router = useRouter()

const route = useRoute()

const { $e } = useNuxtApp()

/** Sidebar visible */
const { isOpen } = useSidebar('nc-right-sidebar')

const sidebarCollapsed = computed(() => !isOpen.value)

/** Sidebar ref */
const sidebar = ref()

/** Watch route param and change active view based on `viewTitle` */
watch(
  [views, () => route.params.viewTitle],
  ([nextViews, viewTitle]) => {
    const lastOpenedViewId = activeTab.value?.id && lastOpenedViewMap.value[activeTab.value?.id]
    const lastOpenedView = nextViews.find((v) => v.id === lastOpenedViewId)

    if (viewTitle) {
      let view = nextViews.find((v) => v.title === viewTitle)
      if (view) {
        activeView.value = view
        setLastOpenedViewId(activeView.value?.id)
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
    } else if (lastOpenedView) {
      /** if active view is not found, set it to last opened view */
      router.replace({
        params: {
          viewTitle: lastOpenedView.title,
        },
      })
    } else {
      if (nextViews?.length && activeView.value !== nextViews[0]) {
        activeView.value = nextViews[0]
      }
    }

    /** if active view is not found, set it to first view */
    if (nextViews?.length && (!activeView.value || !nextViews.includes(activeView.value))) {
      activeView.value = nextViews[0]
    }
  },
  { immediate: true },
)

/** Open delete modal */
function onOpenModal({
  title = '',
  type,
  copyViewId,
  groupingFieldColumnId,
}: {
  title?: string
  type: ViewTypes
  copyViewId?: string
  groupingFieldColumnId?: string
}) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewCreate'), {
    'modelValue': isOpen,
    title,
    type,
    meta,
    'selectedViewId': copyViewId,
    groupingFieldColumnId,
    'views': views,
    'onUpdate:modelValue': closeDialog,
    'onCreated': async (view: ViewType) => {
      closeDialog()

      refreshCommandPalette()

      await loadViews()

      router.push({ params: { viewTitle: view.title || '' } })

      $e('a:view:create', { view: view.type })
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <a-layout-sider
    ref="sidebar"
    :collapsed="sidebarCollapsed"
    collapsiple
    collapsed-width="0"
    width="0"
    class="nc-view-sidebar relative shadow h-full w-full !flex-1 !min-w-0 !max-w-[150px] !w-[150px] lg:(!max-w-[250px] !w-[250px])"
    theme="light"
  >
    <LazySmartsheetSidebarToolbar
      class="min-h-[var(--toolbar-height)] max-h-[var(--toolbar-height)] flex items-center py-3 px-3 justify-between border-b-1"
    />

    <div class="flex-1 flex flex-col min-h-0">
      <GeneralOverlay v-if="!views.length" :model-value="isLoading" inline class="bg-gray-300/50">
        <div class="w-full h-full flex items-center justify-center">
          <a-spin />
        </div>
      </GeneralOverlay>

      <LazySmartsheetSidebarMenuTop :views="views" @open-modal="onOpenModal" @deleted="loadViews" />

      <template v-if="isUIAllowed('virtualViewsCreateOrEdit')">
        <div class="!my-3 w-full border-b-1" />

        <LazySmartsheetSidebarMenuBottom @open-modal="onOpenModal" />
      </template>
    </div>
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
