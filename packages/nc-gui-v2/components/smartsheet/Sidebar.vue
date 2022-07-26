<script setup lang="ts">
import type { FormType, GalleryType, GridType, KanbanType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { inject, ref, useViews } from '#imports'
import { ActiveViewInj, MetaInj, ViewListInj } from '~/context'
import { viewIcons } from '~/utils/viewUtils'
import MdiPlusIcon from '~icons/mdi/plus'

const meta = inject(MetaInj)
const activeView = inject(ActiveViewInj, ref())

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

const toggleDrawer = $ref(false)
// todo: identify based on meta
const isView = $ref(false)

let viewCreateType = $ref<ViewTypes>()

let viewCreateDlg = $ref(false)

function openCreateViewDlg(type: ViewTypes) {
  viewCreateDlg = true
  viewCreateType = type
}

function onViewCreate(view: GridType | FormType | KanbanType | GalleryType) {
  views.value?.push(view)
  activeView.value = view
  viewCreateDlg = false
}
</script>

<template>
  <a-layout-sider class="views-navigation-drawer bg-white shadow" :width="toggleDrawer ? 0 : 250">
    <div class="flex flex-col h-full">
      <div class="flex-1">
        <v-list v-if="views && views.length" dense>
          <v-list-item dense>
            <!-- Views -->
            <span class="body-2 font-weight-medium">{{ $t('objects.views') }}</span>
          </v-list-item>
          <v-list-item
            v-for="view in views"
            :key="view.id"
            v-t="['a:view:open', { view: view.type }]"
            dense
            :value="view.id"
            active-class="x-active--text"
            @click="activeView = view"
          >
            <component :is="viewIcons[view.type].icon" :class="`text-${viewIcons[view.type].color} mr-1`" />
            <span>{{ view.alias || view.title }}</span>
            <v-spacer />
          </v-list-item>
        </v-list>

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
                <!--                <v-list-item-icon class="mr-n1"> -->
                <component :is="viewIcons[ViewTypes.GRID].icon" :class="`text-${viewIcons[ViewTypes.GRID].color} mr-1`" />
                <!--                </v-list-item-icon> -->
                <v-list-item-title>
                  <span class="font-weight-regular">
                    <!-- Grid -->
                    {{ $t('objects.viewType.grid') }}
                  </span>
                </v-list-item-title>
                <v-spacer />
                <MdiPlusIcon class="mr-1" />
                <!--                <v-icon class="mr-1" small> mdi-plus</v-icon> -->
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
