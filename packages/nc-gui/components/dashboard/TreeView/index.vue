<script setup lang="ts">
import Draggable from 'vuedraggable'
import type { TableType, ViewType } from 'nocodb-sdk'
import ProjectWrapper from './ProjectWrapper.vue'

const { isUIAllowed } = useRoles()

const { $e } = useNuxtApp()

const router = useRouter()

const route = router.currentRoute

const basesStore = useBases()

const { createProject: _createProject, updateProject } = basesStore

const { bases, basesList, activeProjectId } = storeToRefs(basesStore)

const { isWorkspaceLoading } = storeToRefs(useWorkspace())

const baseCreateDlg = ref(false)

const baseStore = useBase()

const { isSharedBase, base } = storeToRefs(baseStore)

const { activeTable: _activeTable } = storeToRefs(useTablesStore())

const { isMobileMode } = useGlobal()

const contextMenuTarget = reactive<{ type?: 'base' | 'source' | 'table' | 'main' | 'layout'; value?: any }>({})

const setMenuContext = (type: 'base' | 'source' | 'table' | 'main' | 'layout', value?: any) => {
  contextMenuTarget.type = type
  contextMenuTarget.value = value
}

function openViewDescriptionDialog(view: ViewType) {
  if (!view || !view.id) return

  $e('c:view:description')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewDescriptionUpdate'), {
    'modelValue': isOpen,
    'view': view,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openTableDescriptionDialog(table: TableType) {
  if (!table || !table.id) return

  $e('c:table:description')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableDescriptionUpdate'), {
    'modelValue': isOpen,
    'tableMeta': table,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openRenameTableDialog(table: TableType, _ = false) {
  if (!table || !table.source_id) return

  $e('c:table:rename')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableRename'), {
    'modelValue': isOpen,
    'tableMeta': table,
    'sourceId': table.source_id, // || sources.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openTableCreateDialog(sourceId?: string, baseId?: string) {
  if (!sourceId && !(baseId || basesList.value[0].id)) return

  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    'sourceId': sourceId, // || sources.value[0].id,
    'baseId': baseId || basesList.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const duplicateTable = async (table: TableType) => {
  if (!table || !table.id || !table.base_id) return

  const isOpen = ref(true)

  $e('c:table:duplicate')

  const { close } = useDialog(resolveComponent('DlgTableDuplicate'), {
    'modelValue': isOpen,
    'table': table,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const isCreateTableAllowed = computed(
  () =>
    base.value?.sources?.[0] &&
    isUIAllowed('tableCreate', { source: base.value?.sources?.[0] }) &&
    route.value.name !== 'index' &&
    route.value.name !== 'index-index' &&
    route.value.name !== 'index-index-create' &&
    route.value.name !== 'index-index-create-external' &&
    route.value.name !== 'index-user-index',
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
          const baseId = activeProjectId.value
          const base = baseId ? bases.value.get(baseId) : undefined
          if (!base) return

          if (baseId) openTableCreateDialog(base.sources?.[0].id, baseId)
        }
        break
      }
      // ALT + L - only show active base
      case 76: {
        if (route.value.params.baseId) {
          router.push({
            query: {
              ...route.value.query,
              clear: route.value.query.clear === '1' ? undefined : '1',
            },
          })
        }
        break
      }
      // ALT + D
      case 68: {
        e.stopPropagation()
        baseCreateDlg.value = true
        break
      }
    }
  }
})

const handleContext = (e: MouseEvent) => {
  if (!document.querySelector('.source-context, .table-context')?.contains(e.target as Node)) {
    setMenuContext('main')
  }
}

provide(TreeViewInj, {
  setMenuContext,
  duplicateTable,
  openRenameTableDialog,
  openViewDescriptionDialog,
  openTableDescriptionDialog,
  contextMenuTarget,
})

useEventListener(document, 'contextmenu', handleContext, true)

const scrollTableNode = () => {
  const activeTableDom = document.querySelector(`.nc-treeview [data-table-id="${_activeTable.value?.id}"]`)
  if (!activeTableDom) return

  // Scroll to the table node
  activeTableDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

const onMove = async (_event: { moved: { newIndex: number; oldIndex: number; element: NcProject } }) => {
  const {
    moved: { newIndex = 0, oldIndex = 0, element },
  } = _event

  if (!element?.id) return

  let nextOrder: number

  // set new order value based on the new order of the items
  if (basesList.value.length - 1 === newIndex) {
    // If moving to the end, set nextOrder greater than the maximum order in the list
    nextOrder = Math.max(...basesList.value.map((item) => item?.order ?? 0)) + 1
  } else if (newIndex === 0) {
    // If moving to the beginning, set nextOrder smaller than the minimum order in the list
    nextOrder = Math.min(...basesList.value.map((item) => item?.order ?? 0)) / 2
  } else {
    nextOrder =
      (parseFloat(String(basesList.value[newIndex - 1]?.order ?? 0)) +
        parseFloat(String(basesList.value[newIndex + 1]?.order ?? 0))) /
      2
  }

  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  await updateProject(element.id, {
    order: _nextOrder,
  })

  $e('a:base:reorder')
}

watch(
  () => _activeTable.value?.id,
  () => {
    if (!_activeTable.value?.id) return

    // TODO: Find a better way to scroll to the table node
    setTimeout(() => {
      scrollTableNode()
    }, 1000)
  },
  {
    immediate: true,
  },
)

watch(
  activeProjectId,
  () => {
    const activeProjectDom = document.querySelector(`.nc-treeview [data-base-id="${activeProjectId.value}"]`)
    if (!activeProjectDom) return

    if (isElementInvisible(activeProjectDom)) {
      // Scroll to the table node
      activeProjectDom?.scrollIntoView({ behavior: 'smooth' })
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="nc-treeview-container flex flex-col justify-between select-none">
    <div v-if="!isSharedBase" class="text-gray-500 font-medium pl-3.5 mb-1">{{ $t('objects.projects') }}</div>
    <div mode="inline" class="nc-treeview pb-0.5 flex-grow min-h-50 overflow-x-hidden">
      <div v-if="basesList?.length">
        <Draggable
          :model-value="basesList"
          :disabled="isMobileMode || !isUIAllowed('baseReorder') || basesList?.length < 2"
          item-key="id"
          handle=".base-title-node"
          ghost-class="ghost"
          @change="onMove($event)"
        >
          <template #item="{ element: baseItem }">
            <div :key="baseItem.id">
              <ProjectWrapper :base-role="baseItem.project_role" :base="baseItem">
                <DashboardTreeViewProjectNode />
              </ProjectWrapper>
            </div>
          </template>
        </Draggable>
      </div>

      <WorkspaceEmptyPlaceholder v-else-if="!isWorkspaceLoading" />
    </div>
    <WorkspaceCreateProjectDlg v-model="baseCreateDlg" />
  </div>
</template>

<style scoped lang="scss">
.ghost,
.ghost > * {
  @apply pointer-events-none;
}
.ghost {
  @apply bg-primary-selected;
}
</style>
