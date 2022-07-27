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

const openCreateViewDlg = (type: ViewTypes) => {
  viewCreateDlg = true
  viewCreateType = type
}

const onViewCreate = (view: GridType | FormType | KanbanType | GalleryType) => {
  views.value?.push(view)
  activeView.value = view
  viewCreateDlg = false
}
</script>

<template>
  <div
    class="views-navigation-drawer flex-item-stretch pa-4 elevation-1"
    :style="{
      maxWidth: toggleDrawer ? '0' : '220px',
      minWidth: toggleDrawer ? '0' : '220px',
    }"
  >
    <div class="d-flex flex-column h-100">
      <div class="flex-grow-1">
        <v-list v-if="views && views.length" dense>
          <v-list-item dense>
            <!-- Views -->
            <span class="body-2 font-weight-medium">{{ $t('objects.views') }}</span>
          </v-list-item>

          <!--          <v-list-group v-model="selectedViewIdLocal" mandatory color="primary"> -->
          <!--
               todo: add sortable
               <draggable
                          :is="_isUIAllowed('viewlist-drag-n-drop') ? 'draggable' : 'div'"
                          v-model="viewsList"
                          draggable="div"
                          v-bind="dragOptions"
                          @change="onMove($event)"
                        > -->
          <!--            <transition-group
                          type="transition"
                          :name="!drag ? 'flip-list' : null"
                        > -->
          <v-list-item
            v-for="view in views"
            :key="view.id"
            v-t="['a:view:open', { view: view.type }]"
            dense
            :value="view.id"
            active-class="x-active--text"
            @click="activeView = view"
          >
            <!--                :class="`body-2  view nc-view-item nc-draggable-child nc-${
                      viewTypeAlias[view.type]
                    }-view-item`"
                @click="$emit('rerender')" -->
            <!--              <v-icon
                v-if="_isUIAllowed('viewlist-drag-n-drop')"
                small
                :class="`nc-child-draggable-icon nc-child-draggable-icon-${view.title}`"
                @click.stop
              >
                mdi-drag-vertical
              </v-icon> -->
            <!--              <v-list-item-icon class="mr-n1">
                <v-icon v-if="viewIcons[view.type]" x-small :color="viewIcons[view.type].color">
                  {{ viewIcons[view.type].icon }}
                </v-icon>
                <v-icon v-else color="primary" small> mdi-table </v-icon>
              </v-list-item-icon> -->
            <component :is="viewIcons[view.type].icon" :class="`text-${viewIcons[view.type].color} mr-1`" />
            <span>{{ view.alias || view.title }}</span>

            <!--              <v-list-item-title>
                <v-tooltip bottom>
                  <template #activator="{ on }">
                    <div class="font-weight-regular" style="overflow: hidden; text-overflow: ellipsis">
                      <input v-if="view.edit" :ref="`input${i}`" v-model="view.title_temp" />

                      &lt;!&ndash;                        @click.stop
                                              @keydown.enter.stop="updateViewName(view, i)"
                                              @blur="updateViewName(view, i)" &ndash;&gt;
                      <template v-else>
                        <span v-on="on">{{ view.alias || view.title }}</span>
                      </template>
                    </div>
                  </template>
                  {{ view.alias || view.title }}
                </v-tooltip>
              </v-list-item-title> -->
            <v-spacer />
            <!--              <template v-if="_isUIAllowed('virtualViewsCreateOrEdit')">
                &lt;!&ndash; Copy view &ndash;&gt;
                <x-icon
                  v-if="!view.edit"
                  :tooltip="$t('activity.copyView')"
                  x-small
                  color="primary"
                  icon-class="view-icon nc-view-copy-icon"
                  @click.stop="copyView(view, i)"
                >
                  mdi-content-copy
                </x-icon>
                &lt;!&ndash; Rename view &ndash;&gt;
                <x-icon
                  v-if="!view.edit"
                  :tooltip="$t('activity.renameView')"
                  x-small
                  color="primary"
                  icon-class="view-icon nc-view-edit-icon"
                  @click.stop="showRenameTextBox(view, i)"
                >
                  mdi-pencil
                </x-icon>
                &lt;!&ndash; Delete view" &ndash;&gt;
                <x-icon
                  v-if="!view.is_default"
                  :tooltip="$t('activity.deleteView')"
                  small
                  color="error"
                  icon-class="view-icon nc-view-delete-icon"
                  @click.stop="deleteView(view)"
                >
                  mdi-delete-outline
                </x-icon>
              </template>
              <v-icon
                v-if="view.id === selectedViewId"
                small
                class="check-icon"
              >
                mdi-check-bold
              </v-icon> -->
          </v-list-item>
          <!--            </transition-group> -->
          <!--            </draggable> -->
          <!--          </v-list-group> -->
        </v-list>

        <v-divider class="advance-menu-divider" />

        <v-list dense>
          <v-list-item dense>
            <!-- Create a View -->
            <span class="body-2 font-weight-medium" @dblclick="enableDummyFeat = true">
              {{ $t('activity.createView') }}
            </span>
            <!--            <v-tooltip top>
              <template #activator="{ props }">
                &lt;!&ndash;                <x-icon &ndash;&gt;
                &lt;!&ndash;                  color="pink textColor" &ndash;&gt;
                &lt;!&ndash;                  icon-class="ml-2" &ndash;&gt;
                &lt;!&ndash;                  small &ndash;&gt;
                &lt;!&ndash;                  v-on="on" &ndash;&gt;
                &lt;!&ndash;                  @mouseenter="overShieldIcon = true" &ndash;&gt;
                &lt;!&ndash;                  @mouseleave="overShieldIcon = false" &ndash;&gt;
                &lt;!&ndash;                > &ndash;&gt;
                &lt;!&ndash;                  mdi-shield-lock-outline &ndash;&gt;
                &lt;!&ndash;                </x-icon> &ndash;&gt;
              </template>
              &lt;!&ndash; Only visible to Creator &ndash;&gt;
              <span class="caption">
                {{ $t('msg.info.onlyCreator') }}
              </span>
            </v-tooltip> -->
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
                <!--                <v-list-item-icon class="mr-n1"> -->
                <component :is="viewIcons[ViewTypes.GALLERY].icon" :class="`text-${viewIcons[ViewTypes.GALLERY].color} mr-1`" />
                <!--                </v-list-item-icon> -->
                <v-list-item-title>
                  <span class="font-weight-regular">
                    <!-- Gallery -->
                    {{ $t('objects.viewType.gallery') }}
                  </span>
                </v-list-item-title>

                <v-spacer />

                <MdiPlusIcon class="mr-1" />
                <!--                <v-icon class="mr-1" small> mdi-plus</v-icon> -->
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
                <!--                <v-list-item-icon class="mr-n1"> -->
                <component :is="viewIcons[ViewTypes.FORM].icon" :class="`text-${viewIcons[ViewTypes.FORM].color} mr-1`" />
                <!--                </v-list-item-icon> -->
                <v-list-item-title>
                  <span class="font-weight-regular">
                    <!-- Form -->

                    {{ $t('objects.viewType.form') }}
                  </span>
                </v-list-item-title>

                <v-spacer />

                <MdiPlusIcon class="mr-1" />
                <!--                <v-icon class="mr-1" small> mdi-plus</v-icon> -->
              </v-list-item>
            </template>
            <!-- Add Form View -->
            {{ $t('msg.info.addView.form') }}
          </v-tooltip>
        </v-list>
      </div>
    </div>

    <DlgViewCreate v-if="views" v-model="viewCreateDlg" :type="viewCreateType" @created="onViewCreate" />
  </div>
</template>
