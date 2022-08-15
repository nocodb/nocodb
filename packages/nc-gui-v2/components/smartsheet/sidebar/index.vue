<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'
import type { FormType, GalleryType, GridType, KanbanType } from 'nocodb-sdk'
import MenuTop from './MenuTop.vue'
import MenuBottom from './MenuBottom.vue'
import Toolbar from './toolbar/index.vue'
import {
  ActiveViewInj,
  MetaInj,
  RightSidebarInj,
  ViewListInj,
  computed,
  inject,
  provide,
  ref,
  useElementHover,
  useRoute,
  useRouter,
  useUIPermission,
  useViews,
  viewIcons,
  watch,
} from '#imports'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { views, loadViews } = useViews(meta)

const { isUIAllowed } = useUIPermission()

const router = useRouter()

const route = useRoute()

provide(ViewListInj, views)

/** Sidebar visible */
const sidebarOpen = inject(RightSidebarInj, ref(true))

const sidebarCollapsed = computed(() => !sidebarOpen.value)

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

const isHovered = useElementHover(sidebar)

/** Watch route param and change active view based on `viewTitle` */
watch(
  [views, () => route.params.viewTitle],
  ([nextViews, viewTitle]) => {
    if (viewTitle) {
      const view = nextViews.find((v) => v.title === viewTitle)
      if (view) {
        activeView.value = view
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
function openModal({ type, title = '', copyViewId }: { type: ViewTypes; title?: string; copyViewId?: string }) {
  modalOpen = true
  viewCreateType = type
  viewCreateTitle = title

  if (copyViewId) selectedViewId = copyViewId
}

/** Handle view creation */
function onCreate(view: GridType | FormType | KanbanType | GalleryType) {
  views.value.push(view)
  activeView.value = view
  router.push({ params: { viewTitle: view.title || '' } })
  modalOpen = false
}
</script>

<template>
  <a-layout-sider
    ref="sidebar"
    :collapsed="sidebarCollapsed"
    collapsiple
    collapsed-width="50"
    width="250"
    class="relative shadow-md h-full"
    theme="light"
  >
    <a-tooltip :mouse-enter-delay="1" placement="left">
      <template #title> Toggle sidebar </template>

      <Transition name="glow">
        <div
          v-show="sidebarCollapsed || isHovered"
          class="group color-transition cursor-pointer hover:ring active:ring-pink-500 z-1 flex items-center p-[1px] absolute top-1/2 left-[-1rem] shadow bg-gray-100 rounded-full"
        >
          <MaterialSymbolsChevronRightRounded
            v-if="sidebarOpen"
            class="transform group-hover:(scale-115 text-pink-500) text-xl text-gray-400"
            @click="sidebarOpen = false"
          />

          <MaterialSymbolsChevronLeftRounded
            v-else
            class="transform group-hover:(scale-115 text-pink-500) text-xl text-gray-400"
            @click="sidebarOpen = true"
          />
        </div>
      </Transition>
    </a-tooltip>

    <Toolbar v-if="sidebarOpen" class="flex items-center py-3 px-3 justify-between border-b-1" />

    <Toolbar v-else class="py-3 px-2 max-w-[50px] flex !flex-col-reverse gap-4 items-center mt-[-1px]">
      <template #start>
        <a-tooltip v-if="isUIAllowed('virtualViewsCreateOrEdit')" placement="left">
          <template #title> {{ $t('objects.webhooks') }}</template>

          <div class="nc-sidebar-right-item hover:after:bg-gray-300">
            <MdiHook />
          </div>
        </a-tooltip>

        <div class="dot" />

        <a-tooltip placement="left">
          <template #title> Get API Snippet</template>

          <div class="nc-sidebar-right-item group hover:after:bg-yellow-500">
            <MdiXml class="group-hover:(!text-white)" />
          </div>
        </a-tooltip>

        <div class="dot" />

        <a-tooltip v-if="isUIAllowed('virtualViewsCreateOrEdit')" placement="left" :mouse-enter-delay="1">
          <template #title> {{ $t('activity.createView') }}</template>

          <a-dropdown placement="left" :trigger="['click']">
            <div class="nc-sidebar-right-item group hover:after:bg-blue-500">
              <MdiGridLarge class="group-hover:(!text-white)" />
            </div>

            <template #overlay>
              <a-menu>
                <a-menu-item title="" @click="openModal({ type: ViewTypes.GRID })">
                  <div class="nc-project-menu-item group">
                    <component :is="viewIcons[ViewTypes.GRID].icon" :class="`text-${viewIcons[ViewTypes.GRID].color}`" />

                    <div>{{ $t('objects.viewType.grid') }}</div>

                    <div class="flex-1" />

                    <MdiPlus class="group-hover:text-pink-500" />
                  </div>
                </a-menu-item>

                <a-menu-item title="" @click="openModal({ type: ViewTypes.GALLERY })">
                  <div class="nc-project-menu-item group">
                    <component :is="viewIcons[ViewTypes.GALLERY].icon" :class="`text-${viewIcons[ViewTypes.GALLERY].color}`" />

                    <div>{{ $t('objects.viewType.gallery') }}</div>

                    <div class="flex-1" />

                    <MdiPlus class="group-hover:text-pink-500" />
                  </div>
                </a-menu-item>

                <a-menu-item title="" @click="openModal({ type: ViewTypes.FORM })">
                  <div class="nc-project-menu-item group">
                    <component :is="viewIcons[ViewTypes.FORM].icon" :class="`text-${viewIcons[ViewTypes.FORM].color}`" />

                    <div>{{ $t('objects.viewType.form') }}</div>

                    <div class="flex-1" />

                    <MdiPlus class="group-hover:text-pink-500" />
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </a-tooltip>

        <div class="dot" />
      </template>
    </Toolbar>

    <div v-if="sidebarOpen" class="flex-1 flex flex-col">
      <MenuTop @open-modal="openModal" @deleted="loadViews" @sorted="loadViews" />

      <a-divider v-if="isUIAllowed('virtualViewsCreateOrEdit')" class="my-2" />

      <MenuBottom @open-modal="openModal" />
    </div>

    <dlg-view-create
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

.dot {
  @apply w-[3px] h-[3px] bg-gray-300 rounded-full;
}
</style>
