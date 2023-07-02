<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import Sortable from 'sortablejs'

import ProjectWrapper from './ProjectWrapper.vue'

import {
  TabType,
  TreeViewFunctions,
  computed,
  isDrawerOrModalExist,
  isMac,
  reactive,
  ref,
  resolveComponent,
  storeToRefs,
  useDialog,
  useNuxtApp,
  useProject,
  useProjects,
  useTablesStore,
  useTabs,
  useUIPermission,
  watchEffect,
} from '#imports'

import { useRouter } from '#app'

const emit = defineEmits<{
  (event: 'onScrollTop', type: boolean): void
}>()

const { isUIAllowed } = useUIPermission()

const { addTab } = useTabs()

const { $api, $e, $jobs } = useNuxtApp()

const router = useRouter()

const route = $(router.currentRoute)

const projectsStore = useProjects()

const { createProject: _createProject } = projectsStore

const { projects, projectsList, activeProjectId } = storeToRefs(projectsStore)

const { projectTables } = storeToRefs(useTablesStore())

const projectStore = useProject()

const { loadTables } = projectStore

const { tables } = storeToRefs(projectStore)

const { activeTab } = storeToRefs(useTabs())

const keys = $ref<Record<string, number>>({})

const menuRefs = $ref<HTMLElement[] | HTMLElement>()

const activeTable = computed(() => ([TabType.TABLE, TabType.VIEW].includes(activeTab.value?.type) ? activeTab.value.id : null))

const tablesById = $computed(() =>
  Object.values(projectTables.value.get(activeProjectId.value!) || {})
    .flat()
    ?.reduce<Record<string, TableType>>((acc, table) => {
      acc[table.id!] = table

      return acc
    }, {}),
)

const sortables: Record<string, Sortable> = {}

// todo: replace with vuedraggable
const initSortable = (el: Element) => {
  const base_id = el.getAttribute('nc-base')
  if (!base_id) return
  if (sortables[base_id]) sortables[base_id].destroy()
  Sortable.create(el as HTMLLIElement, {
    onEnd: async (evt) => {
      const offset = tables.value.findIndex((table) => table.base_id === base_id)

      const { newIndex = 0, oldIndex = 0 } = evt

      const itemEl = evt.item as HTMLLIElement
      const item = tablesById[itemEl.dataset.id as string]

      // get the html collection of all list items
      const children: HTMLCollection = evt.to.children

      // skip if children count is 1
      if (children.length < 2) return

      // get items before and after the moved item
      const itemBeforeEl = children[newIndex - 1] as HTMLLIElement
      const itemAfterEl = children[newIndex + 1] as HTMLLIElement

      // get items meta of before and after the moved item
      const itemBefore = itemBeforeEl && tablesById[itemBeforeEl.dataset.id as string]
      const itemAfter = itemAfterEl && tablesById[itemAfterEl.dataset.id as string]

      // set new order value based on the new order of the items
      if (children.length - 1 === evt.newIndex) {
        item.order = (itemBefore.order as number) + 1
      } else if (newIndex === 0) {
        item.order = (itemAfter.order as number) / 2
      } else {
        item.order = ((itemBefore.order as number) + (itemAfter.order as number)) / 2
      }

      // update the order of the moved item
      tables.value?.splice(newIndex + offset, 0, ...tables.value?.splice(oldIndex + offset, 1))

      // force re-render the list
      if (keys[base_id]) {
        keys[base_id] = keys[base_id] + 1
      } else {
        keys[base_id] = 1
      }

      // update the item order
      await $api.dbTable.reorder(item.id as string, {
        order: item.order,
      })
    },
    animation: 150,
  })
}

watchEffect(() => {
  if (menuRefs) {
    if (menuRefs instanceof HTMLElement) {
      initSortable(menuRefs)
    } else {
      menuRefs.forEach((el) => initSortable(el))
    }
  }
})

const contextMenuTarget = reactive<{ type?: 'project' | 'base' | 'table' | 'main' | 'layout'; value?: any }>({})

const setMenuContext = (type: 'project' | 'base' | 'table' | 'main' | 'layout', value?: any) => {
  contextMenuTarget.type = type
  contextMenuTarget.value = value
}

function openRenameTableDialog(table: TableType, rightClick = false) {
  $e(rightClick ? 'c:table:rename:navdraw:right-click' : 'c:table:rename:navdraw:options')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableRename'), {
    'modelValue': isOpen,
    'tableMeta': table,
    'baseId': table.base_id, // || bases.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openTableCreateDialog(baseId?: string, projectId?: string) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    'baseId': baseId, // || bases.value[0].id,
    'projectId': projectId || projectsList.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const duplicateTable = async (table: TableType) => {
  if (!table || !table.id || !table.project_id) return

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableDuplicate'), {
    'modelValue': isOpen,
    'table': table,
    'onOk': async (jobData: { id: string }) => {
      $jobs.subscribe({ id: jobData.id }, undefined, async (status: string, data?: any) => {
        if (status === JobStatus.COMPLETED) {
          await loadTables()
          const newTable = tables.value.find((el) => el.id === data?.result?.id)
          if (newTable) addTab({ title: newTable.title, id: newTable.id, type: newTable.type as TabType })
        } else if (status === JobStatus.FAILED) {
          message.error('Failed to duplicate table')
          await loadTables()
        }
      })

      $e('a:table:duplicate')
    },
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const isCreateTableAllowed = computed(
  () =>
    isUIAllowed('table-create') &&
    route.name !== 'index' &&
    route.name !== 'index-index' &&
    route.name !== 'index-index-create' &&
    route.name !== 'index-index-create-external' &&
    route.name !== 'index-user-index',
)

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 84: {
        // ALT + T
        if (isCreateTableAllowed.value && !isDrawerOrModalExist()) {
          // prevent the key `T` is inputted to table title input
          e.preventDefault()
          $e('c:shortcut', { key: 'ALT + T' })
          const projectId = activeProjectId.value
          const project = projectId ? projects.value.get(projectId) : undefined
          if (!project) return

          if (projectId) openTableCreateDialog(project.bases?.[0].id, projectId)
        }
        break
      }
      // ALT + L - only show active project
      case 76: {
        if (route.params.projectId) {
          router.push({
            query: {
              ...route.query,
              clear: route.query.clear === '1' ? undefined : '1',
            },
          })
        }
        break
      }
    }
  }
})

const handleContext = (e: MouseEvent) => {
  if (!document.querySelector('.base-context, .table-context')?.contains(e.target as Node)) {
    setMenuContext('main')
  }
}

provide(TreeViewFunctions, {
  setMenuContext,
  duplicateTable,
  openRenameTableDialog,
})

useEventListener(document, 'contextmenu', handleContext, true)

const treeViewDom = ref<HTMLElement>()

const checkScrollTopMoreThanZero = () => {
  if (treeViewDom.value) {
    if (treeViewDom.value.scrollTop > 0) {
      emit('onScrollTop', true)
    } else {
      emit('onScrollTop', false)
    }
  }
  return false
}

watch(activeProjectId, () => {
  const activeProjectDom = document.querySelector(`.nc-treeview [data-project-id="${activeProjectId.value}"]`)

  if (activeProjectDom) {
    activeProjectDom.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    })
  }
})

onMounted(() => {
  treeViewDom.value?.addEventListener('scroll', checkScrollTopMoreThanZero)
})

onUnmounted(() => {
  treeViewDom.value?.removeEventListener('scroll', checkScrollTopMoreThanZero)
})
</script>

<template>
  <div class="nc-treeview-container flex flex-col justify-between select-none">
    <div ref="treeViewDom" mode="inline" class="nc-treeview pb-0.5 flex-grow min-h-50 overflow-x-hidden">
      <template v-if="projectsList?.length">
        <ProjectWrapper
          v-for="project of projectsList"
          :key="project.id"
          :project-role="[project.project_role, project.role]"
          :project="project"
        >
          <DashboardTreeViewNewProjectNode />
        </ProjectWrapper>
      </template>

      <WorkspaceEmptyPlaceholder v-else />
    </div>

    <!-- <div class="flex flex-col border-t-1 border-gray-100">
      <div class="flex items-center mt-3 justify-center mx-2">
        <WorkspaceCreateProjectBtn
          modal
          type="ghost"
          class="h-auto w-full nc-create-project-btn !rounded-lg"
          :active-workspace-id="route.params.workspaceId"
        >
          <div class="flex flex-row justify-between w-full items-center">
            <div class="flex">Create new Project</div>
            <MaterialSymbolsAddRounded />
          </div>
        </WorkspaceCreateProjectBtn>
      </div>
      <div class="flex items-start flex-row justify-center px-2 pt-1 pb-1.5 gap-2">
        <GeneralJoinCloud class="color-transition px-2 text-gray-500 cursor-pointer select-none hover:text-accent" />
      </div>
    </div> -->
  </div>
</template>

<style scoped lang="scss">
.nc-treeview-container {
  height: calc(100% - var(--sidebar-top-height));
}

.nc-treeview-footer-item {
  @apply cursor-pointer px-4 py-2 flex items-center hover:bg-gray-200/20 text-xs text-current;
}

:deep(.nc-filter-input input::placeholder) {
  @apply !text-xs;
}

:deep(.ant-dropdown-menu-title-content) {
  @apply !p-2;
}

:deep(.ant-input-group-addon:last-child) {
  @apply top-[-0.5px];
}

.nc-treeview-container {
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  & .dragging {
    .nc-icon {
      @apply !hidden;
    }

    .nc-view-icon {
      @apply !block;
    }
  }

  .ant-menu-item:not(.sortable-chosen) {
    @apply color-transition hover:!bg-transparent;
  }

  .sortable-chosen {
    @apply !bg-primary bg-opacity-25 text-primary;
  }
}

.nc-tree-item:hover {
  @apply text-primary after:(!opacity-5);
}

:deep(.nc-filter-input) {
  .ant-input {
    @apply pr-6 !border-0;
  }
}

:deep(.ant-dropdown-menu-item-group-title) {
  @apply border-b-1;
}

:deep(.ant-dropdown-menu-item-group-list) {
  @apply !mx-0;
}

:deep(.ant-dropdown-menu-item-group-title) {
  @apply border-b-1;
}

:deep(.ant-dropdown-menu-item-group-list) {
  @apply m-0;
}

:deep(.ant-dropdown-menu-item) {
  @apply !py-0 active:(ring ring-accent ring-opacity-100);
}

:deep(.ant-dropdown-menu-title-content) {
  @apply !p-0;
}

:deep(.ant-collapse-content-box) {
  @apply !p-0;
}

:deep(.ant-collapse-header) {
  @apply !border-0;
}

:deep(.ant-menu-sub.ant-menu-inline .ant-menu-item-group-title) {
  @apply !py-0;
}

:deep(.nc-project-sub-menu .ant-menu-submenu-title) {
  @apply !pr-1 !pl-3;
}

:deep(.ant-menu-inline .ant-menu-submenu-title) {
  @apply !h-28px;
}

:deep(.nc-project-sub-menu.active) {
}

.nc-create-project-btn {
  @apply px-2;
  :deep(.ant-btn) {
    @apply w-full !text-center justify-center h-auto rounded-lg py-2 px-4 border-gray-100 bg-white;
    & > div {
      @apply !justify-center;
    }
  }
}

.nc-treeview {
  overflow-y: overlay;
  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-track {
    @apply bg-inherit;
  }
  &::-webkit-scrollbar-thumb {
    @apply bg-scrollbar;
  }
  &::-webkit-scrollbar-thumb:hover {
    @apply bg-scrollbar-hover;
  }
}
</style>
