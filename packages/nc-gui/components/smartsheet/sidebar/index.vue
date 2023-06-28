<script setup lang="ts">
import type { ViewType, ViewTypes } from 'nocodb-sdk'
import type { Ref } from 'vue'
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
import FieldIcon from '~icons/nc-icons/eye'

const openedTab = ref<'views' | 'developer'>('views')

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
const sidebar: Ref<Element | null> = ref(null)

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
const onTabChange = (tab: 'views' | 'developer') => {
  openedTab.value = tab
}
</script>

<template>
  <div class="nc-view-sidebar flex flex-col border-l-1 border-gray-75 relative h-full w-full bg-white">
    <div class="flex flex-row p-1 mx-3 mt-3 mb-3 bg-gray-50 rounded-md gap-x-2">
      <div
        class="tab"
        :class="{
          active: openedTab === 'views',
        }"
        @click="onTabChange('views')"
      >
        <FieldIcon class="h-3.5 w-3.5" />
        <div>Views</div>
      </div>
      <div
        class="tab"
        :class="{
          active: openedTab === 'developer',
        }"
        @click="onTabChange('developer')"
      >
        <component
          :is="iconMap.snippet"
          class="text-gray-500"
          :style="{
            fontWeight: 600,
          }"
        />
        <div>Developer</div>
      </div>
    </div>

    <div class="flex-1 flex flex-col min-h-0">
      <GeneralOverlay v-if="!views.length" :model-value="isLoading" inline class="bg-gray-300/50">
        <div class="w-full h-full flex items-center justify-center">
          <a-spin />
        </div>
      </GeneralOverlay>

      <template v-if="openedTab === 'views'">
        <LazySmartsheetSidebarMenuTop :views="views" @open-modal="onOpenModal" @deleted="loadViews" />
        <template v-if="isUIAllowed('virtualViewsCreateOrEdit')">
          <div class="!my-3 w-full border-b-1 border-gray-75" />

          <LazySmartsheetSidebarMenuBottom @open-modal="onOpenModal" />
        </template>
      </template>
      <LazySmartsheetSidebarToolbarDeveloper v-if="openedTab === 'developer'" />
    </div>
  </div>
</template>

<style scoped>
:deep(.ant-menu-title-content) {
  @apply w-full;
}

:deep(.ant-layout-sider-children) {
  @apply flex flex-col;
}

.tab {
  @apply flex flex-row items-center justify-center w-1/2 py-1 bg-gray-50 rounded-md gap-x-1.5 text-gray-500 cursor-pointer transition-all duration-300 select-none;
}
.active {
  @apply bg-white shadow text-gray-700;
}
</style>
