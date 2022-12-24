<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import type { SortableEvent } from 'sortablejs'
import Sortable from 'sortablejs'
import type { Menu as AntMenu } from 'ant-design-vue'
import {
  ActiveViewInj,
  extractSdkResponseErrorMsg,
  inject,
  message,
  ref,
  resolveComponent,
  useApi,
  useDialog,
  useI18n,
  useNuxtApp,
  useRouter,
  viewTypeAlias,
  watch,
} from '#imports'
import type { SectionType } from '~/lib'

interface Props {
  sections: SectionType[]
}

interface Emits {
  (event: 'openModal', data: { type: ViewTypes; title?: string; copyViewId?: string; groupingFieldColumnId?: string }): void

  (event: 'updated'): void
}

const { sections = [] } = defineProps<Props>()

const emits = defineEmits<Emits>()

const sectionNames = computed(() => sections.map((s) => s.name))

const allViews = $computed(() => sections.flatMap((s) => s.views))

let activeKey = $ref<string[]>([])

const { t } = useI18n()

const { $e } = useNuxtApp()

const activeView = inject(ActiveViewInj, ref())

const { api } = useApi()

const router = useRouter()

/** Selected view(s) for menu */
const selected = ref<string[]>([])

/** dragging renamable view items */
let dragging = $ref(false)

const menuRefs = $ref<typeof AntMenu[]>([])

let isMarked = $ref<string | false>(false)

/** Watch currently active view, so we can mark it in the menu */
watch(activeView, (nextActiveView) => {
  if (nextActiveView && nextActiveView.id) {
    selected.value = [nextActiveView.id]
  }
})

/** shortly mark an item after sorting */
function markItem(id: string) {
  isMarked = id
  setTimeout(() => {
    isMarked = false
  }, 300)
}

function validateViewTitle(view: ViewType) {
  if (!view.title || view.title.trim().length < 0) {
    return 'View name is required'
  }

  if (allViews.some((v) => v.title === view.title && v.id !== view.id)) {
    return 'View name should be unique'
  }

  return true
}

function validateSectionName(section: SectionType, nextName: string) {
  return !sections.some((s) => s.name === nextName && s !== section)
}

function onSortStart(evt: SortableEvent) {
  evt.stopImmediatePropagation()
  evt.preventDefault()
  dragging = true
}

async function onSortEnd(evt: SortableEvent) {
  evt.stopImmediatePropagation()
  evt.preventDefault()
  dragging = false

  if (evt.from === evt.to && evt.oldIndex === evt.newIndex) {
    return
  }

  const newIndex = evt.newIndex || 0

  const children = evt.to.children as unknown as HTMLLIElement[]

  const previousEl = children[newIndex - 1]
  const nextEl = children[newIndex + 1]

  const currentItem = allViews.find((v) => v.id === evt.item.id)

  if (!currentItem || !currentItem.id) {
    return
  }

  const currSectionName = evt.from.dataset.sectionName
  const nextSectionName = evt.to.dataset.sectionName
  const currViews = sections.find((s) => s.name === currSectionName)?.views || []
  const nextViews = sections.find((s) => s.name === nextSectionName)?.views || []

  const previousItem = (previousEl ? nextViews.find((v) => v.id === previousEl.id) : {}) as ViewType
  const nextItem = (nextEl ? nextViews.find((v) => v.id === nextEl.id) : {}) as ViewType

  let nextOrder: number

  // set new order value based on the new order of the items
  if (children.length - 1 === newIndex) {
    nextOrder = parseFloat(String(previousItem.order)) + 1
  } else if (newIndex === 0) {
    nextOrder = parseFloat(String(nextItem.order)) / 2
  } else {
    nextOrder = (parseFloat(String(previousItem.order)) + parseFloat(String(nextItem.order))) / 2
  }

  const currIndex = currViews.findIndex((v) => v.id === currentItem.id)
  if (currIndex > -1) {
    currViews.splice(currIndex, 1)
  }
  const nextIndex = nextViews.findIndex((v) => (v?.order ?? 0) > nextOrder)
  if (nextIndex > -1) {
    nextViews.splice(nextIndex, 0, currentItem)
  } else {
    nextViews.push(currentItem)
  }
  evt.item.remove()

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : 1

  currentItem.order = _nextOrder

  await api.dbView.update(currentItem.id, { order: _nextOrder, section: nextSectionName })

  markItem(currentItem.id)

  $e('a:view:reorder')
}

let sortables: Sortable[] = []

watch(
  () => [...menuRefs],
  () => {
    sortables.forEach((sortable) => sortable.destroy())

    sortables = menuRefs.map(
      (menuRef) =>
        new Sortable(menuRef.$el, {
          group: 'views',
          // handle: '.nc-drag-icon',
          ghostClass: 'ghost',
          onStart: onSortStart,
          onEnd: onSortEnd,
        }),
    )
  },
  { immediate: true },
)

watch(
  sectionNames,
  () => {
    activeKey = sections.map((s) => s.name)
  },
  { immediate: true },
)

/** Navigate to view by changing url param */
function changeView(view: ViewType) {
  router.push({ params: { viewTitle: view.title || '' } })

  if (view.type === ViewTypes.FORM && selected.value[0] === view.id) {
    // reload the page if the same form view is clicked
    // router.go(0)
    // fix me: router.go(0) reloads entire page. need to reload only the form view
    router.replace({ query: { reload: 'true' } }).then(() => {
      router.replace({ query: {} })
    })
  }
}

/** Rename a view */
async function onRename(view: ViewType) {
  try {
    await api.dbView.update(view.id!, {
      title: view.title,
      order: view.order,
    })

    await router.replace({
      params: {
        viewTitle: view.title,
      },
    })

    // View renamed successfully
    message.success(t('msg.success.viewRenamed'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Open delete modal */
function openDeleteDialog(view: ViewType) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewDelete'), {
    'modelValue': isOpen,
    'view': view,
    'onUpdate:modelValue': closeDialog,
    'onDeleted': () => {
      closeDialog()

      emits('updated')
      if (activeView.value === view) {
        // return to the default view
        router.replace({
          params: {
            viewTitle: allViews[0].title,
          },
        })
      }
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openSectionRenameDialog(section: SectionType) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgSectionRename'), {
    'modelValue': isOpen,
    'section': section,
    'onUpdate:modelValue': closeDialog,
    'validate': validateSectionName,
    'onRenamed': () => {
      emits('updated')
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openSectionDeleteDialog(section: SectionType) {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgSectionDelete'), {
    'modelValue': isOpen,
    'section': section,
    'onUpdate:modelValue': closeDialog,
    'onDeleted': () => {
      emits('updated')
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const setIcon = async (icon: string, view: ViewType) => {
  try {
    // modify the icon property in meta
    view.meta = {
      ...(view.meta || {}),
      icon,
    }

    api.dbView.update(view.id as string, {
      meta: view.meta,
    })

    $e('a:view:icon:sidebar', { icon })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <a-collapse v-model:activeKey="activeKey" class="nc-views-menu flex-1" expand-icon-position="right" :bordered="false" ghost>
    <a-collapse-panel
      v-for="section in sections"
      :key="section.name"
      header-class="group"
      :data-testid="`view-sidebar-section-${section.name}`"
    >
      <template #header>
        <div class="flex w-full items-center gap-1 text-gray-500 font-bold">
          <LazyGeneralTruncateText>{{ section.name || 'No section' }}</LazyGeneralTruncateText>

          <div class="flex-1" />

          <template v-if="section.name !== ''">
            <a-tooltip placement="left">
              <template #title>
                {{ $t('activity.renameSection') }}
              </template>

              <MdiPencil
                class="hidden group-hover:block text-gray-500 nc-view-copy-icon"
                @click.stop="openSectionRenameDialog(section)"
              />
            </a-tooltip>

            <a-tooltip placement="left">
              <template #title>
                {{ $t('activity.deleteSection') }}
              </template>

              <MdiTrashCan
                class="hidden group-hover:block text-red-500 nc-view-delete-icon"
                @click.stop="openSectionDeleteDialog(section)"
              />
            </a-tooltip>
          </template>
        </div>
      </template>
      <a-menu ref="menuRefs" :class="{ dragging }" :selected-keys="selected" :data-section-name="section.name">
        <!-- Lazy load breaks menu item active styles, i.e. styles never change even when active item changes -->
        <SmartsheetSidebarRenameableMenuItem
          v-for="view of section.views"
          :id="view.id"
          :key="view.id"
          :view="view"
          :on-validate="validateViewTitle"
          class="nc-view-item transition-all ease-in duration-300"
          :class="{
            'bg-gray-100': isMarked === view.id,
            'active': activeView?.id === view.id,
            [`nc-${view.type ? viewTypeAlias[view.type] : undefined || view.type}-view-item`]: true,
          }"
          @change-view="changeView"
          @open-modal="$emit('openModal', $event)"
          @delete="openDeleteDialog"
          @rename="onRename"
          @select-icon="setIcon($event, view)"
        />
      </a-menu>
    </a-collapse-panel>
  </a-collapse>
</template>

<style lang="scss">
.nc-views-menu {
  @apply flex-1 min-h-[100px] overflow-y-scroll scrollbar-thin-dull;

  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  &.dragging {
    .nc-icon {
      @apply !hidden;
    }

    .nc-view-icon {
      @apply !block;
    }
  }

  .ant-menu-item:not(.sortable-chosen) {
    @apply color-transition;
  }

  .sortable-chosen {
    @apply !bg-primary bg-opacity-25 text-primary;
  }

  .active {
    @apply bg-primary bg-opacity-25 text-primary font-medium;
  }

  .ant-collapse-content {
    @apply !min-h-2;
  }

  .ant-collapse-content-box {
    @apply !p-0;
  }
}
</style>
