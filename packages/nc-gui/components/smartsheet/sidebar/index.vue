<script setup lang="ts">
import type { ViewType, ViewTypes } from 'nocodb-sdk'
import {
  ActiveViewInj,
  MetaInj,
  inject,
  ref,
  resolveComponent,
  storeToRefs,
  useCommandPalette,
  useDialog,
  useNuxtApp,
  useRoute,
  useRouter,
  useUIPermission,
  useViewsStore,
  watch,
} from '#imports'

const { refreshCommandPalette } = useCommandPalette()

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { activeTab } = storeToRefs(useTabs())

const viewsStore = useViewsStore()
const { loadViews } = viewsStore
const { isViewsLoading, views } = storeToRefs(viewsStore)

const { lastOpenedViewMap } = storeToRefs(useProject())

const { activeTable } = storeToRefs(useTablesStore())

const setLastOpenedViewId = (viewId?: string) => {
  if (viewId && activeTab.value?.id) {
    lastOpenedViewMap.value[activeTab.value?.id] = viewId
  }
}

const { isUIAllowed } = useUIPermission()

const router = useRouter()

const route = useRoute()

const { $e } = useNuxtApp()

const { isRightSidebarOpen } = storeToRefs(useSidebarStore())

const tabBtnsContainerRef = ref<HTMLElement | null>(null)

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
              viewTitle: view.id,
            },
          })
        }
      }
    } else if (lastOpenedView) {
      /** if active view is not found, set it to last opened view */
      router.replace({
        params: {
          viewTitle: lastOpenedView.id,
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

      router.push({ params: { viewTitle: view.id || '' } })

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
  <div class="relative nc-view-sidebar flex flex-col border-l-1 border-gray-200 relative h-full w-full bg-white">
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!h-8 !rounded overflow-hidden ml-3 mr-3 mt-3.75 mb-3.75" />
    </template>
    <div
      v-else
      ref="tabBtnsContainerRef"
      class="flex flex-row group py-1 mx-3.25 mt-1.25 mb-2.75 rounded-md gap-x-2 nc-view-sidebar-tab items-center justify-between"
    >
      <div class="flex text-gray-600 ml-1.75">Views</div>
      <NcTooltip
        placement="bottomLeft"
        hide-on-click
        class="flex opacity-0 group-hover:(opacity-100) transition-all duration-50"
        :class="{
          '!w-8 !opacity-100': !isRightSidebarOpen,
        }"
      >
        <template #title>
          {{
            isRightSidebarOpen
              ? `${$t('general.hide')} ${$t('objects.sidebar').toLowerCase()}`
              : `${$t('general.show')} ${$t('objects.sidebar').toLowerCase()}`
          }}
        </template>
        <NcButton
          type="text"
          size="small"
          class="nc-sidebar-left-toggle-icon !text-gray-600 !hover:text-gray-800"
          @click="isRightSidebarOpen = !isRightSidebarOpen"
        >
          <div class="flex items-center text-inherit">
            <GeneralIcon
              icon="doubleRightArrow"
              class="duration-150 transition-all"
              :class="{
                'transform rotate-180': !isRightSidebarOpen,
              }"
            />
          </div>
        </NcButton>
      </NcTooltip>
    </div>

    <div class="flex-1 flex flex-col min-h-0">
      <div class="flex flex-col h-full justify-between w-full">
        <div class="flex flex-grow nc-scrollbar-md pr-1.75 mr-0.5">
          <div v-if="isViewsLoading" class="flex flex-col w-full">
            <div class="flex flex-row items-center w-full mt-1.5 ml-5 gap-x-3">
              <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
              <a-skeleton-input :active="true" class="!w-1/2 !h-4 !rounded overflow-hidden" />
            </div>
            <div class="flex flex-row items-center w-full mt-4 ml-5 gap-x-3">
              <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
              <a-skeleton-input :active="true" class="!w-1/2 !h-4 !rounded overflow-hidden" />
            </div>
            <div class="flex flex-row items-center w-full mt-4 ml-5 gap-x-3">
              <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
              <a-skeleton-input :active="true" class="!w-1/2 !h-4 !rounded overflow-hidden" />
            </div>
          </div>
          <LazySmartsheetSidebarMenuTop v-else :views="views" @open-modal="onOpenModal" @deleted="loadViews" />
        </div>
        <div v-if="isUIAllowed('virtualViewsCreateOrEdit')" class="flex flex-col">
          <div class="!mb-3 w-full border-b-1 border-gray-200" />

          <div v-if="!activeTable" class="flex flex-col pt-2 pb-5 px-6">
            <a-skeleton-input :active="true" class="!w-3/5 !h-4 !rounded overflow-hidden" />
            <div class="flex flex-row justify-between items-center w-full mt-4.75">
              <div class="flex flex-row items-center flex-grow gap-x-3">
                <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
                <a-skeleton-input :active="true" class="!w-3/5 !h-4 !rounded overflow-hidden" />
              </div>
              <div class="flex">
                <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
              </div>
            </div>
            <div class="flex flex-row justify-between items-center w-full mt-3.75">
              <div class="flex flex-row items-center flex-grow gap-x-3">
                <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
                <a-skeleton-input :active="true" class="!w-3/5 !h-4 !rounded overflow-hidden" />
              </div>
              <div class="flex">
                <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
              </div>
            </div>
            <div class="flex flex-row justify-between items-center w-full mt-3.75">
              <div class="flex flex-row items-center flex-grow gap-x-3">
                <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
                <a-skeleton-input :active="true" class="!w-3/5 !h-4 !rounded overflow-hidden" />
              </div>
              <div class="flex">
                <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
              </div>
            </div>
            <div class="flex flex-row justify-between items-center w-full mt-3.75">
              <div class="flex flex-row items-center flex-grow gap-x-3">
                <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
                <a-skeleton-input :active="true" class="!w-3/5 !h-4 !rounded overflow-hidden" />
              </div>
              <div class="flex">
                <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
              </div>
            </div>
          </div>
          <LazySmartsheetSidebarMenuBottom v-else @open-modal="onOpenModal" />
        </div>
      </div>
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
  @apply flex flex-row items-center h-7.5 justify-center w-1/2 py-1 bg-gray-100 rounded-md gap-x-1.5 text-gray-500 hover:text-black cursor-pointer transition-all duration-300 select-none;
}

.tab-icon {
  @apply transition-all duration-300;
}
.tab .tab-title {
  @apply min-w-0;
  word-break: 'keep-all';
  white-space: 'nowrap';
  display: 'inline';
}

.active {
  @apply bg-white shadow text-gray-700;
}
</style>
