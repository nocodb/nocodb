<script setup lang="ts">
import type { FormType, GalleryType, GridType, KanbanType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { inject, onClickOutside, onKeyStroke, provide, ref, useDebounceFn, useTabs, useViews, watch } from '#imports'
import { ActiveViewInj, MetaInj, ViewListInj } from '~/context'
import { viewIcons } from '~/utils'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiTrashCan from '~icons/mdi/trash-can'
import MdiContentCopy from '~icons/mdi/content-copy'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { addTab } = useTabs()

const { views } = useViews(meta)

provide(ViewListInj, views)

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

const isView = ref(false)

let isEditing = $ref<number | null>(null)

let originalTitle = $ref<string | undefined>()

let viewCreateType = $ref<ViewTypes>()

let viewCreateDlg = $ref(false)

const selected = ref<string[]>([])

watch(activeView, (nextActiveView) => {
  const _nextActiveView = nextActiveView as GridType | FormType | KanbanType

  if (_nextActiveView && _nextActiveView.id) {
    selected.value = [_nextActiveView.id]
  }
})

onKeyStroke('Escape', () => {
  if (isEditing !== null) {
    onCancel(isEditing)
  }
})

onKeyStroke('Enter', () => {
  if (isEditing !== null) {
    onRename(isEditing)
  }
})

function openCreateViewDlg(type: ViewTypes) {
  viewCreateDlg = true
  viewCreateType = type
}

function onCreate(view: GridType | FormType | KanbanType | GalleryType) {
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

const debouncedChangeView = useDebounceFn((view) => {
  if (isEditing !== null) return

  changeView(view)
}, 250)

function onCopy(index: number) {
  // copy view
}

function onDelete(index: number) {
  // delete view
}

function onRename(index: number) {
  // rename view
}

function onDblClick(index: number) {
  if (isEditing === null) {
    isEditing = index
    originalTitle = views.value[index].title
  }
}

function onCancel(index: number) {
  isEditing = null
  views.value[index].title = originalTitle
  originalTitle = ''
}

function onKeyDown(event: KeyboardEvent, index: number) {
  if (event.key === 'Escape') {
    onCancel(index)
  } else if (event.key === 'Enter') {
    onRename(index)
  }
}

const inputRef = $ref<HTMLInputElement>()

function setInputRef(el: HTMLInputElement) {
  if (el) el.focus()
}

onClickOutside(inputRef, () => {
  if (isEditing !== null) {
    onCancel(isEditing)
  }
})
</script>

<template>
  <a-layout-sider class="views-navigation-drawer bg-white shadow" :width="toggleDrawer ? 0 : 250">
    <div class="flex flex-col h-full">
      <div class="flex-1">
        <a-menu :selected-keys="selected">
          <h3 class="pt-3 px-3 text-xs font-semibold">{{ $t('objects.views') }}</h3>

          <a-menu-item
            v-for="(view, i) of views"
            :key="view.id"
            class="group !flex !items-center !h-[30px]"
            @dblclick="onDblClick(i)"
            @click="debouncedChangeView(view)"
          >
            <div v-t="['a:view:open', { view: view.type }]" class="text-xs flex items-center w-full gap-2">
              <component :is="viewIcons[view.type].icon" :class="`text-${viewIcons[view.type].color}`" />

              <a-input
                v-if="isEditing === i"
                :ref="setInputRef"
                v-model:value="view.title"
                @blur="onCancel(i)"
                @keydown="onKeyDown($event, i)"
              />
              <div v-else>{{ view.alias || view.title }}</div>

              <div class="flex-1" />

              <div class="flex items-center gap-1">
                <a-tooltip placement="left">
                  <template #title>
                    {{ $t('activity.copyView') }}
                  </template>

                  <MdiContentCopy class="hidden group-hover:block text-gray-500" />
                </a-tooltip>

                <a-tooltip placement="left">
                  <template #title>
                    {{ $t('activity.deleteView') }}
                  </template>

                  <MdiTrashCan class="hidden group-hover:block text-red-500" />
                </a-tooltip>
              </div>
            </div>
          </a-menu-item>

          <a-divider class="my-2" />

          <h3 class="px-3 text-xs font-semibold">{{ $t('activity.createView') }}</h3>

          <a-menu-item key="grid" class="group !flex !items-center !h-[30px]" @click="openCreateViewDlg(ViewTypes.GRID)">
            <a-tooltip placement="left">
              <template #title>
                {{ $t('msg.info.addView.grid') }}
              </template>

              <div class="text-xs flex items-center h-full w-full gap-2">
                <component :is="viewIcons[ViewTypes.GRID].icon" :class="`text-${viewIcons[ViewTypes.GRID].color}`" />

                <div>{{ $t('objects.viewType.grid') }}</div>

                <div class="flex-1" />

                <MdiPlusIcon class="group-hover:text-primary" />
              </div>
            </a-tooltip>
          </a-menu-item>

          <a-menu-item key="gallery" class="group !flex !items-center !h-[30px]" @click="openCreateViewDlg(ViewTypes.GALLERY)">
            <a-tooltip placement="left">
              <template #title>
                {{ $t('msg.info.addView.gallery') }}
              </template>

              <div class="text-xs flex items-center h-full w-full gap-2">
                <component :is="viewIcons[ViewTypes.GALLERY].icon" :class="`text-${viewIcons[ViewTypes.GALLERY].color}`" />

                <div>{{ $t('objects.viewType.gallery') }}</div>

                <div class="flex-1" />

                <MdiPlusIcon class="group-hover:text-primary" />
              </div>
            </a-tooltip>
          </a-menu-item>

          <a-menu-item
            v-if="!isView"
            key="form"
            class="group !flex !items-center !h-[30px]"
            @click="openCreateViewDlg(ViewTypes.FORM)"
          >
            <a-tooltip placement="left">
              <template #title>
                {{ $t('msg.info.addView.form') }}
              </template>

              <div class="text-xs flex items-center h-full w-full gap-2">
                <component :is="viewIcons[ViewTypes.FORM].icon" :class="`text-${viewIcons[ViewTypes.FORM].color}`" />

                <div>{{ $t('objects.viewType.form') }}</div>

                <div class="flex-1" />

                <MdiPlusIcon class="group-hover:text-primary" />
              </div>
            </a-tooltip>
          </a-menu-item>
        </a-menu>
      </div>
    </div>

    <DlgViewCreate v-if="views" v-model="viewCreateDlg" :type="viewCreateType" @created="onCreate" />
  </a-layout-sider>
</template>

<style scoped>
:deep(.ant-menu-title-content) {
  @apply w-full;
}
</style>
