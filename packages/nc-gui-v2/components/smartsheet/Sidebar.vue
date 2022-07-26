<script setup lang="ts">
import type { FormType, GalleryType, GridType, KanbanType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { inject, provide, ref, useTabs, useViews, watch } from '#imports'
import { ActiveViewInj, MetaInj, ViewListInj } from '~/context'
import { viewIcons } from '~/utils'
import MdiPlusIcon from '~icons/mdi/plus'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { addTab } = useTabs()

const { views } = useViews(meta)

provide(ViewListInj, views)

// todo decide based on route param
watch(
  views,
  (nextViews) => {
    if (nextViews.length) {
      activeView.value = nextViews[0]
    }
  },
  { immediate: true },
)

const toggleDrawer = ref(false)
// todo: identify based on meta
const isView = ref(false)

const enableDummyFeat = ref(false)

let viewCreateType = $ref<ViewTypes>()

let viewCreateDlg = $ref(false)

const selected = ref<string[]>([])

watch(activeView, (nextActiveView) => {
  const _nextActiveView = nextActiveView as GridType | FormType | KanbanType

  if (_nextActiveView && _nextActiveView.id) {
    selected.value = [_nextActiveView.id]
  }
})

function openCreateViewDlg(type: ViewTypes) {
  viewCreateDlg = true
  viewCreateType = type
}

function onViewCreate(view: GridType | FormType | KanbanType | GalleryType) {
  views.value?.push(view)
  activeView.value = view
  viewCreateDlg = false
}

// todo: fix view type, alias is missing for some reason?
function changeView(view: { id: string; alias?: string; title?: string; type: ViewTypes }) {
  activeView.value = view

  const tabProps = {
    id: view.id,
    title: (view.alias ?? view.title) || '',
    type: ViewTypes[view.type],
  }

  addTab(tabProps)
}
</script>

<template>
  <a-layout-sider class="views-navigation-drawer bg-white shadow" :width="toggleDrawer ? 0 : 250">
    <div class="flex flex-col h-full">
      <div class="flex-1">
        <a-menu v-model:selected-keys="selected">
          <h3 class="pt-3 px-3 text-sm font-semibold">{{ $t('objects.views') }}</h3>
          <a-menu-item v-for="view in views" :key="view.id" @click="changeView(view)">
            <div v-t="['a:view:open', { view: view.type }]" class="flex items-center w-full">
              <component :is="viewIcons[view.type].icon" :class="`text-${viewIcons[view.type].color} mr-1`" />
              <div>{{ view.alias || view.title }}</div>
            </div>
          </a-menu-item>
        </a-menu>

        <v-divider class="advance-menu-divider" />

        <v-list dense>
          <v-list-item dense>
            <!-- Create a View -->
            <span class="body-2 font-weight-medium" @dblclick="enableDummyFeat = true">
              {{ $t('activity.createView') }}
            </span>
          </v-list-item>
          <v-tooltip bottom>
            <template #activator="{ props }">
              <v-list-item dense class="body-2 nc-create-grid-view" v-bind="props" @click="openCreateViewDlg(ViewTypes.GRID)">
                <component :is="viewIcons[ViewTypes.GRID].icon" :class="`text-${viewIcons[ViewTypes.GRID].color} mr-1`" />

                <v-list-item-title>
                  <span class="font-weight-regular">
                    <!-- Grid -->
                    {{ $t('objects.viewType.grid') }}
                  </span>
                </v-list-item-title>

                <v-spacer />

                <MdiPlusIcon class="mr-1" />
              </v-list-item>
            </template>
            <!-- Add Grid View -->
            {{ $t('msg.info.addView.grid') }}
          </v-tooltip>

          <v-tooltip bottom>
            <template #activator="{ props }">
              <v-list-item
                dense
                class="body-2 nc-create-gallery-view"
                v-bind="props"
                @click="openCreateViewDlg(ViewTypes.GALLERY)"
              >
                <component :is="viewIcons[ViewTypes.GALLERY].icon" :class="`text-${viewIcons[ViewTypes.GALLERY].color} mr-1`" />

                <v-list-item-title>
                  <span class="font-weight-regular">
                    <!-- Gallery -->
                    {{ $t('objects.viewType.gallery') }}
                  </span>
                </v-list-item-title>

                <v-spacer />

                <MdiPlusIcon class="mr-1" />
              </v-list-item>
            </template>
            <!-- Add Gallery View -->
            {{ $t('msg.info.addView.gallery') }}
          </v-tooltip>

          <v-tooltip bottom>
            <template #activator="{ props }">
              <v-list-item
                v-if="!isView"
                dense
                class="body-2 nc-create-form-view"
                v-bind="props"
                @click="openCreateViewDlg(ViewTypes.FORM)"
              >
                <component :is="viewIcons[ViewTypes.FORM].icon" :class="`text-${viewIcons[ViewTypes.FORM].color} mr-1`" />

                <v-list-item-title>
                  <span class="font-weight-regular">
                    <!-- Form -->

                    {{ $t('objects.viewType.form') }}
                  </span>
                </v-list-item-title>

                <v-spacer />

                <MdiPlusIcon class="mr-1" />
              </v-list-item>
            </template>
            <!-- Add Form View -->
            {{ $t('msg.info.addView.form') }}
          </v-tooltip>
        </v-list>
      </div>
    </div>

    <DlgViewCreate v-if="views" v-model="viewCreateDlg" :type="viewCreateType" @created="onViewCreate" />
  </a-layout-sider>
</template>
