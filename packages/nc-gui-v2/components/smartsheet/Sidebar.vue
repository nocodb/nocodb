<script setup lang="ts">
import type { FormType, GalleryType, GridType, KanbanType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { notification } from 'ant-design-vue'
import {
  inject,
  onClickOutside,
  onKeyStroke,
  provide,
  ref,
  useApi,
  useDebounceFn,
  useNuxtApp,
  useTabs,
  useViews,
  watch,
} from '#imports'
import { ActiveViewInj, MetaInj, ViewListInj } from '~/context'
import { extractSdkResponseErrorMsg, viewIcons } from '~/utils'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiTrashCan from '~icons/mdi/trash-can'
import MdiContentCopy from '~icons/mdi/content-copy'
import MdiXml from '~icons/mdi/xml'
import MdiHook from '~icons/mdi/hook'
import MdiHeartsCard from '~icons/mdi/cards-heart'
import type { TabItem } from '~/composables/useTabs'
import { TabType } from '~/composables/useTabs'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { $e } = useNuxtApp()

const { addTab } = useTabs()

const { views, loadViews } = useViews(meta)

const { api } = useApi()

provide(ViewListInj, views)

/** Watch current views and on change set the next active view */
watch(
  views,
  (nextViews) => {
    if (nextViews.length) {
      activeView.value = nextViews[0]
    }
  },
  { immediate: true },
)

/** Sidebar visible */
const toggleDrawer = ref(false)

const isView = ref(false)

/** Is editing the view name enabled */
let isEditing = $ref<number | null>(null)

/** Helper to check if editing was disabled before the view navigation timeout triggers */
let isStopped = $ref(false)

/** Original view title when editing the view name */
let originalTitle = $ref<string | undefined>()

/** View type to create from modal */
let viewCreateType = $ref<ViewTypes>()

/** View title to create from modal (when duplicating) */
const viewCreateTitle = $ref('')

/** is view creation modal open */
let modalOpen = $ref(false)

/** Selected view(s) for menu */
const selected = ref<string[]>([])

/** Watch currently active view so we can mark it in the menu */
watch(activeView, (nextActiveView) => {
  const _nextActiveView = nextActiveView as GridType | FormType | KanbanType

  if (_nextActiveView && _nextActiveView.id) {
    selected.value = [_nextActiveView.id]
  }
})

/** Open view creation modal */
function openModal(type: ViewTypes) {
  modalOpen = true
  viewCreateType = type
}

/** Handle view creation */
function onCreate(view: GridType | FormType | KanbanType | GalleryType) {
  views.value?.push(view)
  activeView.value = view
  modalOpen = false
}

// todo: fix view type, alias is missing for some reason?
/** Navigate to view and add new tab if necessary */
function changeView(view: { id: string; alias?: string; title?: string; type: ViewTypes }) {
  activeView.value = view

  const tabProps: TabItem = {
    id: view.id,
    title: (view.alias ?? view.title) || '',
    type: TabType.VIEW,
  }

  addTab(tabProps)
}

/** Debounce click handler so we can potentially enable editing view name {@see onDblClick} */
const onClick = useDebounceFn((view) => {
  if (isEditing !== null || isStopped) return

  changeView(view)
}, 250)

/** Enable editing view name on dbl click */
function onDblClick(index: number) {
  if (isEditing === null) {
    isEditing = index
    originalTitle = views.value[index].title
  }
}

/** Handle keydown on input field */
function onKeyDown(event: KeyboardEvent, index: number) {
  if (event.key === 'Escape') {
    onKeyEsc(event, index)
  } else if (event.key === 'Enter') {
    onKeyEnter(event, index)
  }
}

/** Rename view when enter is pressed */
function onKeyEnter(event: KeyboardEvent, index: number) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onRename(index)
}

/** Disable renaming view when escape is pressed */
function onKeyEsc(event: KeyboardEvent, index: number) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onCancel(index)
}

onKeyStroke('Escape', (event) => {
  if (isEditing !== null) {
    onKeyEsc(event, isEditing)
  }
})

onKeyStroke('Enter', (event) => {
  if (isEditing !== null) {
    onKeyEnter(event, isEditing)
  }
})

/** Current input element, changes when edit is enabled on a view menu item */
let inputRef = $ref<HTMLInputElement>()

function setInputRef(el: HTMLInputElement) {
  if (el) {
    el.focus()
    inputRef = el
  }
}

/** Cancel editing when clicked outside of input */
onClickOutside(inputRef, () => {
  if (isEditing !== null) {
    onCancel(isEditing)
  }
})

/** Duplicate a view */
// todo: This is not really a duplication, maybe we need to implement a true duplication?
function onDuplicate(index: number) {
  const view: any = views.value[index]

  openModal(view.type)

  $e('c:view:copy', { view: view.type })
}

/** Delete a view */
async function onDelete(index: number) {
  const view: any = views.value[index]

  try {
    await api.dbView.delete(view.id)

    notification.success({
      message: 'View deleted successfully',
      duration: 3,
    })

    await loadViews()
  } catch (e: any) {
    notification.error({
      message: await extractSdkResponseErrorMsg(e),
      duration: 3,
    })
  }

  // telemetry event
  $e('a:view:delete', { view: view.type })
}

/** Rename a view */
async function onRename(index: number) {
  // todo: validate if title is unique and not empty
  if (isEditing === null) return
  const view = views.value[index]

  if (view.title === '' || view.title === originalTitle) {
    onCancel(index)
    return
  }

  try {
    // todo typing issues, order and id do not exist on all members of ViewTypes (Kanban, Gallery, Form, Grid)
    await api.dbView.update((view as any).id, {
      title: view.title,
      order: (view as any).order,
    })

    console.log('rename success')

    notification.success({
      message: 'View renamed successfully',
      duration: 3,
    })

    console.log('success')
  } catch (e: any) {
    notification.error({
      message: await extractSdkResponseErrorMsg(e),
      duration: 3,
    })
  }

  onStopEdit()
}

/** Cancel renaming view */
function onCancel(index: number) {
  views.value[index].title = originalTitle
  onStopEdit()
}

/** Stop editing view name, timeout makes sure that view navigation (click trigger) does not pick up before stop is done */
function onStopEdit() {
  isStopped = true
  isEditing = null
  originalTitle = ''

  setTimeout(() => {
    isStopped = false
  }, 250)
}

function onApiSnippet() {
  // get API snippet
  $e('a:view:api-snippet')
}
</script>

<template>
  <a-layout-sider class="shadow" :width="toggleDrawer ? 0 : 250">
    <a-menu class="h-full relative" :selected-keys="selected">
      <h3 class="pt-3 px-3 text-xs font-semibold">{{ $t('objects.views') }}</h3>

      <a-menu-item
        v-for="(view, i) of views"
        :key="view.id"
        class="group !flex !items-center !h-[30px]"
        @dblclick="onDblClick(i)"
        @click="onClick(view)"
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

          <template v-if="isEditing !== i">
            <div class="flex items-center gap-1">
              <a-tooltip placement="left">
                <template #title>
                  {{ $t('activity.copyView') }}
                </template>

                <MdiContentCopy class="hidden group-hover:block text-gray-500" @click.stop="onDuplicate(i)" />
              </a-tooltip>

              <a-popconfirm
                placement="left"
                :title="$t('msg.info.deleteProject')"
                :ok-text="$t('general.yes')"
                :cancel-text="$t('general.no')"
                @confirm="onDelete(i)"
              >
                <a-tooltip placement="left">
                  <template #title>
                    {{ $t('activity.deleteView') }}
                  </template>

                  <MdiTrashCan class="hidden group-hover:block text-red-500" @click.stop />
                </a-tooltip>
              </a-popconfirm>
            </div>
          </template>
        </div>
      </a-menu-item>

      <a-divider class="my-2" />

      <h3 class="px-3 text-xs font-semibold">{{ $t('activity.createView') }}</h3>

      <a-menu-item key="grid" class="group !flex !items-center !h-[30px]" @click="openModal(ViewTypes.GRID)">
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

      <a-menu-item key="gallery" class="group !flex !items-center !h-[30px]" @click="openModal(ViewTypes.GALLERY)">
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

      <a-menu-item v-if="!isView" key="form" class="group !flex !items-center !h-[30px]" @click="openModal(ViewTypes.FORM)">
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

      <div class="flex flex-col gap-4 mt-8">
        <button
          class="flex items-center gap-2 w-full mx-3 p-4 rounded bordered !bg-primary text-white transform translate-x-4 hover:translate-x-0 transition duration-150 ease"
          @click="onApiSnippet"
        >
          <MdiXml />Get API Snippet
        </button>

        <button
          class="flex items-center gap-2 w-full mx-3 p-4 rounded border-1 border-solid border-black transform translate-x-4 hover:translate-x-0 transition duration-150 ease"
          @click="onApiSnippet"
        >
          <MdiHook />{{ $t('objects.webhooks') }}
        </button>
      </div>

      <general-flipping-card class="my-4 h-[250px] w-[250px]" :triggers="['click', { duration: 15000 }]">
        <template #front>
          <div class="flex h-full w-full gap-6 flex-col">
            <general-social />

            <div>
              <a
                v-t="['e:hiring']"
                class="p-4 bg-primary/75 rounded accent-pink-500 shadow bordered border-primary text-white"
                href="https://angel.co/company/nocodb"
                target="_blank"
              >
                🚀 We are Hiring! 🚀
              </a>
            </div>
          </div>
        </template>

        <template #back>
          <!-- todo: add project cost -->
          <a
            href="https://github.com/sponsors/nocodb"
            target="_blank"
            class="flex items-center gap-2 w-full mx-3 p-4 rounded bordered !bg-primary text-white transform translate-x-4 hover:translate-x-0 transition duration-150 ease"
          >
            <MdiHeartsCard class="text-red-500" />
            {{ $t('activity.sponsorUs') }}
          </a>
        </template>
      </general-flipping-card>
    </a-menu>

    <DlgViewCreate v-if="views" v-model="modalOpen" :title="viewCreateTitle" :type="viewCreateType" @created="onCreate" />
  </a-layout-sider>
</template>

<style scoped>
:deep(.ant-menu-title-content) {
  @apply w-full;
}
</style>
