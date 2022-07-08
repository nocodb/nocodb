<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { inject, onMounted, ref } from '#imports'
import { ActiveViewInj, MetaInj } from '~/components'
import useViews from '~/composables/useViews'
import { viewIcons } from '~/utils/viewUtils'

const meta = inject(MetaInj)
const activeView = inject(ActiveViewInj)

const { views, loadViews } = useViews(meta as Ref<TableType>)
const _isUIAllowed = (view: string) => {}

loadViews().then(() => {
  activeView.value = views.value?.[0]
})

const toggleDrawer = ref(false)
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
      </div>
    </div>
  </div>
</template>

<style scoped></style>
