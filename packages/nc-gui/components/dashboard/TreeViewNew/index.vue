<script setup lang="ts">
import type { BaseType, ProjectType, TableType } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import Sortable from 'sortablejs'
import { nextTick, } from '@vue/runtime-core'
import type { VNodeRef } from '#imports'

import {
  TabType,
  computed,
  extractSdkResponseErrorMsg,
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
  useTable,
  useTabs,
  useToggle,
  useUIPermission,
  useWorkspace,
  watchEffect,
} from '#imports'
import MdiView from '~icons/mdi/eye-circle-outline'
import MdiTableLarge from '~icons/mdi/table-large'
import PhTableThin from '~icons/ph/table-thin'

import AddNewTableNode from './AddNewTableNode'
import TableList from './TableList'
import {useRouter} from "#app";

const { addTab, updateTab } = useTabs()

const { $api, $e } = useNuxtApp()

const workspaceStore = useWorkspace()

const { projects: workspaceProjects } = storeToRefs(workspaceStore)

const projectsStore = useProjects()

const { loadProjectTables, loadProject, createProject: _createProject } = projectsStore

const { projectTableList, projects } = storeToRefs(projectsStore)

const minimisedProjRefs = reactive({})

const openedProjectId = ref()

const projectElRefs = ref()

const loadProjectAndTableList = async (project: ProjectType, projIndex: number) => {
  if (!project) {
    return
  }

  openedProjectId.value = project.id

  nextTick(() => {
    const el = projectElRefs.value[projIndex]

    console.log(projectElRefs.value)

    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  })

  // if document project, add a document tab and route to the page
  switch (project.type) {
    case 'documentation':
      addTab({
        id: project.id,
        title: project.title,
        type: TabType.DOCUMENT,
        projectId: project.id,
      })
      $e('c:document:open', project.id)
      break
    default:
      await loadProject(project.id!)
      await loadProjectTables(project.id!)
      break
  }
}

const projectStore = useProject()
//
// const { loadTables } = projectStore
const { isSharedBase } = storeToRefs(projectStore)

const { activeTab } = storeToRefs(useTabs())

const { deleteTable } = useTable()

const { isUIAllowed } = useUIPermission()

const router = useRouter()
const route = $(router.currentRoute)

const [searchActive, toggleSearchActive] = useToggle()


const keys = $ref<Record<string, number>>({})

const activeKey = ref<string[]>([])

const menuRefs = $ref<HTMLElement[] | HTMLElement>()

let filterQuery = $ref('')

const activeTable = computed(() => ([TabType.TABLE, TabType.VIEW].includes(activeTab.value?.type) ? activeTab.value.id : null))

const tablesById = $computed(() =>
  Object.values(projectTableList.value)
    .flat()
    ?.reduce<Record<string, TableType>>((acc, table) => {
      acc[table.id!] = table

      return acc
    }, {}),
)

const filteredTables = $computed(
  () => [],
  // tables.value?.filter(
  //   (table) => !searchActive.value || !filterQuery || table.title.toLowerCase().includes(filterQuery.toLowerCase()),
  // ),
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

const icon = (table: TableType) => {
  if (table.type === 'table') {
    return PhTableThin
  }
  if (table.type === 'view') {
    return MdiView
  }
}

const contextMenuTarget = reactive<{ type?: 'base' | 'table' | 'main'; value?: any }>({})

const setMenuContext = (type: 'base' | 'table' | 'main', value?: any) => {
  contextMenuTarget.type = type
  contextMenuTarget.value = value
}

const reloadTables = async () => {
  $e('a:table:refresh:navdraw')

  // await loadTables()
}

const addTableTab = (table: TableType) => {
  addTab({ title: table.title, id: table.id, type: table.type as TabType, projectId: table.project_id })
}

function openRenameTableDialog(table: TableType, baseId?: string, rightClick = false) {
  $e(rightClick ? 'c:table:rename:navdraw:right-click' : 'c:table:rename:navdraw:options')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableRename'), {
    'modelValue': isOpen,
    'tableMeta': table,
    'baseId': baseId, // || bases.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openQuickImportDialog(type: string, baseId?: string) {
  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'baseId': baseId, // || bases.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openAirtableImportDialog(baseId?: string) {
  $e('a:actions:import-airtable')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgAirtableImport'), {
    'modelValue': isOpen,
    'baseId': baseId, // || bases.value[0].id,
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
    'projectId': projectId || projects.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openTableCreateMagicDialog(baseId?: string) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableMagic'), {
    'modelValue': isOpen,
    'baseId': baseId, // || bases.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openSchemaMagicDialog(baseId?: string) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgSchemaMagic'), {
    'modelValue': isOpen,
    'baseId': baseId, // || bases.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openSqlEditor(base?: BaseType) {
  // if (!base) base = bases.value?.filter((base: BaseType) => base.enabled)[0]
  // selectedBase.value = base.id
  // navigateTo(`/${route.params.projectType}/${route.params.projectId}/sql`)
}

function openErdView(base?: BaseType) {
  // if (!base) base = bases.value?.filter((base: BaseType) => base.enabled)[0]
  // navigateTo(`/${route.params.projectType}/${route.params.projectId}/erd/${base.id}`)
}

const searchInputRef: VNodeRef = (vnode: typeof Input) => vnode?.$el?.focus()

const beforeSearch = ref<string[]>([])

const onSearchCloseIconClick = () => {
  filterQuery = ''
  toggleSearchActive(false)
  activeKey.value = beforeSearch.value
}

const onSearchIconClick = () => {
  beforeSearch.value = activeKey.value
  toggleSearchActive(true)
  activeKey.value = bases.value.filter((el) => el.enabled).map((el) => `collapse-${el.id}`)
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

const activeProjectId = computed(() => route.params.projectId)

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
          const projectId = openedProjectId.value! || activeProjectId.value
          if(projectId)
          openTableCreateDialog(projects.value?.[projectId]?.bases?.[0].id, projectId)
        }
        break
      }
    }
  }
})

watch(
  activeTable,
  (value, oldValue) => {
    if (value) {
      if (value !== oldValue) {
        // const fndTable = tables.value.find((el) => el.id === value)
        // if (fndTable) {
        //   activeKey.value = [`collapse-${fndTable.base_id}`]
        // }
      }
    } else {
      // if (bases.value.filter((el) => el.enabled)[0]?.id)
      //   activeKey.value = [`collapse-${bases.value.filter((el) => el.enabled)[0].id}`]
    }
  },
  { immediate: true },
)

const setIcon = async (icon: string, table: TableType) => {
  try {
    table.meta = {
      ...(table.meta || {}),
      icon,
    }
    tables.value.splice(tables.value.indexOf(table), 1, { ...table })

    updateTab({ id: table.id }, { meta: table.meta })

    $api.dbTable.update(table.id as string, {
      meta: table.meta,
    })

    $e('a:table:icon:navdraw', { icon })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const handleContext = (e: MouseEvent) => {
  if (!document.querySelector('.base-context, .table-context')?.contains(e.target as Node)) {
    setMenuContext('main')
  }
}

useEventListener(document, 'contextmenu', handleContext, true)

watch(
  () => route.params.projectId,
  async (newId, oldId) => {
    if (newId && newId !== oldId) {
      openedProjectId.value = newId
      await loadProject(newId)
      await loadProjectTables(newId)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="nc-treeview-container flex flex-col">
    <div mode="inline" class="flex-grow min-h-50 overflow-y-auto overflow-x-hidden">
      <div
        v-for="(project, i) of workspaceProjects"
        :key="project.id"
        ref="projectElRefs"
        class="m-2 py-1 nc-project-sub-menu"
        :class="{ active: project.id === activeProjectId }"
      >
        <div class="flex items-center gap-2 py-1 cursor-pointer" @click="loadProjectAndTableList(project, i)">
          <DashboardTreeViewNewProjectNode ref="projectNodeRefs" class="flex-grow" :project="projects[project.id] ?? project" />
        </div>

        <div
          key="g1"
          class="overflow-y-auto transition-max-height"
          :class="{ 'max-h-0': openedProjectId !== project.id, 'max-h-500': openedProjectId === project.id }"
        >
          <div v-if="project.type === 'documentation'">
            <DocsSideBarNew v-if="openedProjectId === project.id" :project="project" />
          </div>
          <a-dropdown
            v-else-if="project && projects[project.id] && projects[project.id].bases"
            :trigger="['contextmenu']"
            overlay-class-name="nc-dropdown-tree-view-context-menu"
          >
            <div class="pt-2 pl-2 pb-2 flex-1 overflow-y-auto flex flex-col" :class="{ 'mb-[20px]': isSharedBase }">
              <div
                v-if="
                  projects[project.id].bases[0] &&
                  projects[project.id].bases[0].enabled &&
                  !projects[project.id].bases.slice(1).filter((el) => el.enabled)?.length
                "
                class="flex-1 ml-1"
              >

                <AddNewTableNode :project="project" :base-index="0" @openTableCreateDialog="openTableCreateDialog(projects[project.id].bases[0].id, project.id)"/>

                <div class="transition-height duration-200 ml-2">
                  <TableList :project="projects[project.id]" :base-index="0"/>
                </div>

                <div
                  v-if="!projectTableList[project.id]?.length"
                  class="mt-0.5 pt-16 mx-3 flex flex-col items-center border-t-1 border-gray-50"
                >
                  <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" description="Empty Database" />
                </div>
              </div>

              <div v-else class="transition-height duration-200">
                <div class="border-none sortable-list">
                  <div v-for="(base, baseIndex) of bases" :key="`base-${base.id}`">
                    <a-collapse
                      v-if="base && base.enabled"
                      v-model:activeKey="activeKey"
                      :class="[
                        { hidden: searchActive && !!filterQuery && !filteredTables?.find((el) => el.base_id === base.id) },
                      ]"
                      expand-icon-position="right"
                      :bordered="false"
                      :accordion="!searchActive"
                      ghost
                    >
                      <a-collapse-panel :key="`collapse-${base.id}`">
                        <template #header>
                          <div
                            v-if="baseIndex === '0'"
                            class="base-context flex items-center gap-2 text-gray-500 font-bold"
                            @contextmenu="setMenuContext('base', base)"
                          >
                            <GeneralBaseLogo :base-type="base.type" />
                            Default ({{
                              projectTableList[project.id]?.filter((table) => table.base_id === base.id).length || '0'
                            }})
                          </div>
                          <div
                            v-else
                            class="base-context flex items-center gap-2 text-gray-500 font-bold"
                            @contextmenu="setMenuContext('base', base)"
                          >
                            <GeneralBaseLogo :base-type="base.type" />
                            {{ base.alias || '' }}
                            ({{ projectTableList[project.id].filter((table) => table.base_id === base.id).length || '0' }})
                          </div>
                        </template>
                        <div
                          v-if="baseIndex === '0' && isUIAllowed('table-create')"
                          class="group flex items-center gap-2 pl-8 pr-3 py-2 text-primary/70 hover:(text-primary/100) cursor-pointer select-none"
                          @click="openTableCreateDialog(projects[project.id].bases[0].id)"
                        >
                          <MdiPlus />

                          <span class="text-gray-500 group-hover:(text-primary/100) flex-1 nc-add-new-table">{{
                            $t('tooltip.addTable')
                          }}</span>

                          <a-dropdown
                            v-if="!isSharedBase"
                            :trigger="['click']"
                            overlay-class-name="nc-dropdown-import-menu"
                            @click.stop
                          >
                            <MdiDotsVertical
                              class="transition-opacity opacity-0 group-hover:opacity-100 nc-import-menu outline-0"
                            />

                            <template #overlay>
                              <a-menu class="!py-0 rounded text-sm">
                                <a-menu-item-group class="!px-0 !mx-0">
                                  <template #title>
                                    <div class="flex items-center">
                                      Noco
                                      <PhSparkleFill class="ml-1 text-orange-400" />
                                    </div>
                                  </template>
                                  <a-menu-item
                                    key="table-magic"
                                    @click="openTableCreateMagicDialog(projects[project.id].bases[0].id)"
                                  >
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiMagicStaff class="group-hover:text-accent" />
                                      Create table
                                    </div>
                                  </a-menu-item>
                                  <a-menu-item
                                    key="schema-magic"
                                    @click="openSchemaMagicDialog(projects[project.id].bases[0].id)"
                                  >
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiMagicStaff class="group-hover:text-accent" />
                                      Create schema
                                    </div>
                                  </a-menu-item>
                                </a-menu-item-group>

                                <a-menu-divider class="my-0" />

                                &lt;!&ndash; Quick Import From &ndash;&gt;
                                <a-menu-item-group :title="$t('title.quickImportFrom')" class="!px-0 !mx-0">
                                  <a-menu-item
                                    v-if="isUIAllowed('airtableImport')"
                                    key="quick-import-airtable"
                                    @click="openAirtableImportDialog(projects[project.id].bases[0].id)"
                                  >
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiTableLarge class="group-hover:text-accent" />
                                      Airtable
                                    </div>
                                  </a-menu-item>

                                  <a-menu-item
                                    v-if="isUIAllowed('csvImport')"
                                    key="quick-import-csv"
                                    @click="openQuickImportDialog('csv', projects[project.id].bases[0].id)"
                                  >
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiFileDocumentOutline class="group-hover:text-accent" />
                                      CSV file
                                    </div>
                                  </a-menu-item>

                                  <a-menu-item
                                    v-if="isUIAllowed('jsonImport')"
                                    key="quick-import-json"
                                    @click="openQuickImportDialog('json', projects[project.id].bases[0].id)"
                                  >
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiCodeJson class="group-hover:text-accent" />
                                      JSON file
                                    </div>
                                  </a-menu-item>

                                  <a-menu-item
                                    v-if="isUIAllowed('excelImport')"
                                    key="quick-import-excel"
                                    @click="openQuickImportDialog('excel', projects[project.id].bases[0].id)"
                                  >
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiFileExcel class="group-hover:text-accent" />
                                      Microsoft Excel
                                    </div>
                                  </a-menu-item>
                                </a-menu-item-group>

                                <a-menu-divider class="my-0" />

                                <a-menu-item v-if="isUIAllowed('importRequest')" key="add-new-table" class="py-1 rounded-b">
                                  <a
                                    v-e="['e:datasource:import-request']"
                                    href="https://github.com/nocodb/nocodb/issues/2052"
                                    target="_blank"
                                    class="prose-sm hover:(!text-primary !opacity-100) color-transition nc-project-menu-item group after:(!rounded-b)"
                                  >
                                    <MdiOpenInNew class="group-hover:text-accent" />
                                    &lt;!&ndash; Request a data source you need? &ndash;&gt;
                                    {{ $t('labels.requestDataSource') }}
                                  </a>
                                </a-menu-item>
                              </a-menu>
                            </template>
                          </a-dropdown>
                        </div>
                        <div
                          v-else-if="isUIAllowed('table-create')"
                          class="group flex items-center gap-2 pl-8 pr-3 py-2 text-primary/70 hover:(text-primary/100) cursor-pointer select-none"
                          @click="openTableCreateDialog(base.id)"
                        >
                          <MdiPlus />

                          <span class="text-gray-500 group-hover:(text-primary/100) flex-1 nc-add-new-table">{{
                            $t('tooltip.addTable')
                          }}</span>

                          <a-dropdown
                            v-if="!isSharedBase"
                            :trigger="['click']"
                            overlay-class-name="nc-dropdown-import-menu"
                            @click.stop
                          >
                            <MdiDotsVertical
                              class="transition-opacity opacity-0 group-hover:opacity-100 nc-import-menu outline-0"
                            />

                            <template #overlay>
                              <a-menu class="!py-0 rounded text-sm">
                                <a-menu-item-group class="!px-0 !mx-0">
                                  <template #title>
                                    <div class="flex items-center">
                                      Noco
                                      <PhSparkleFill class="ml-1 text-orange-400" />
                                    </div>
                                  </template>
                                  <a-menu-item key="table-magic" @click="openTableCreateMagicDialog(base.id)">
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiMagicStaff class="group-hover:text-accent" />
                                      Create table
                                    </div>
                                  </a-menu-item>
                                  <a-menu-item key="schema-magic" @click="openSchemaMagicDialog(base.id)">
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiMagicStaff class="group-hover:text-accent" />
                                      Create schema
                                    </div>
                                  </a-menu-item>
                                </a-menu-item-group>

                                <a-menu-divider class="my-0" />

                                &lt;!&ndash; Quick Import From &ndash;&gt;
                                <a-menu-item-group :title="$t('title.quickImportFrom')" class="!px-0 !mx-0">
                                  <a-menu-item
                                    v-if="isUIAllowed('airtableImport')"
                                    key="quick-import-airtable"
                                    @click="openAirtableImportDialog(base.id)"
                                  >
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiTableLarge class="group-hover:text-accent" />
                                      Airtable
                                    </div>
                                  </a-menu-item>

                                  <a-menu-item
                                    v-if="isUIAllowed('csvImport')"
                                    key="quick-import-csv"
                                    @click="openQuickImportDialog('csv', base.id)"
                                  >
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiFileDocumentOutline class="group-hover:text-accent" />
                                      CSV file
                                    </div>
                                  </a-menu-item>

                                  <a-menu-item
                                    v-if="isUIAllowed('jsonImport')"
                                    key="quick-import-json"
                                    @click="openQuickImportDialog('json', base.id)"
                                  >
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiCodeJson class="group-hover:text-accent" />
                                      JSON file
                                    </div>
                                  </a-menu-item>

                                  <a-menu-item
                                    v-if="isUIAllowed('excelImport')"
                                    key="quick-import-excel"
                                    @click="openQuickImportDialog('excel', base.id)"
                                  >
                                    <div class="color-transition nc-project-menu-item group">
                                      <MdiFileExcel class="group-hover:text-accent" />
                                      Microsoft Excel
                                    </div>
                                  </a-menu-item>
                                </a-menu-item-group>

                                <a-menu-divider class="my-0" />

                                <a-menu-item v-if="isUIAllowed('importRequest')" key="add-new-table" class="py-1 rounded-b">
                                  <a
                                    v-e="['e:datasource:import-request']"
                                    href="https://github.com/nocodb/nocodb/issues/2052"
                                    target="_blank"
                                    class="prose-sm hover:(!text-primary !opacity-100) color-transition nc-project-menu-item group after:(!rounded-b)"
                                  >
                                    <MdiOpenInNew class="group-hover:text-accent" />
                                    &lt;!&ndash; Request a data source you need? &ndash;&gt;
                                    {{ $t('labels.requestDataSource') }}
                                  </a>
                                </a-menu-item>
                              </a-menu>
                            </template>
                          </a-dropdown>
                        </div>
                        <div
                          ref="menuRefs"
                          :key="`sortable-${base.id}-${base.id && base.id in keys ? keys[base.id] : '0'}`"
                          :nc-base="base.id"
                        >

                          <TableList :project="projects[project.id]" :base-index="baseIndex"/>
<!--                          <div
                            v-for="table of projectTableList[project.id].filter((table) => table.base_id === base.id)"
                            :key="table.id"
                            v-e="['a:table:open']"
                            :class="[
                              { hidden: !filteredTables?.includes(table), active: activeTable === table.id },
                              `nc-project-tree-tbl nc-project-tree-tbl-${table.title}`,
                            ]"
                            class="nc-tree-item text-sm cursor-pointer group"
                            :data-order="table.order"
                            :data-id="table.id"
                            :data-testid="`tree-view-table-${table.title}`"
                            @click="addTableTab(table)"
                          >
                            <GeneralTooltip class="pl-8 pr-3 py-2" modifier-key="Alt">
                              <template #title>{{ table.table_name }}</template>
                              <div
                                class="table-context flex items-center gap-2 h-full"
                                @contextmenu="setMenuContext('table', table)"
                              >
                                <div class="flex w-auto" :data-testid="`tree-view-table-draggable-handle-${table.title}`">
                                  <component
                                    :is="isUIAllowed('tableIconCustomisation') ? Dropdown : 'div'"
                                    trigger="click"
                                    destroy-popup-on-hide
                                    class="flex items-center"
                                    @click.stop
                                  >
                                    <div class="flex items-center" @click.stop>
                                      <component :is="isUIAllowed('tableIconCustomisation') ? Tooltip : 'div'">
                                        <span
                                          v-if="table.meta?.icon"
                                          :key="table.meta?.icon"
                                          class="nc-table-icon flex items-center"
                                        >
                                          <IconifyIcon
                                            :key="table.meta?.icon"
                                            :data-testid="`nc-icon-${table.meta?.icon}`"
                                            class="text-xl"
                                            :icon="table.meta?.icon"
                                          ></IconifyIcon>
                                        </span>
                                        <component
                                          :is="icon(table)"
                                          v-else
                                          class="nc-table-icon nc-view-icon w-5"
                                          :class="{ 'group-hover:text-gray-500': isUIAllowed('treeview-drag-n-drop') }"
                                        />

                                        <template v-if="isUIAllowed('tableIconCustomisation')" #title>Change icon </template>
                                      </component>
                                    </div>
                                    <template v-if="isUIAllowed('tableIconCustomisation')" #overlay>
                                      <GeneralEmojiIcons class="shadow bg-white p-2" @select-icon="setIcon($event, table)" />
                                    </template>
                                  </component>
                                </div>

                                <div class="nc-tbl-title flex-1">
                                  <GeneralTruncateText>{{ table.title }}</GeneralTruncateText>
                                </div>

                                <a-dropdown
                                  v-if="!isSharedBase && (isUIAllowed('table-rename') || isUIAllowed('table-delete'))"
                                  :trigger="['click']"
                                  @click.stop
                                >
                                  <MdiDotsVertical class="transition-opacity opacity-0 group-hover:opacity-100 outline-0" />

                                  <template #overlay>
                                    <a-menu class="!py-0 rounded text-sm">
                                      <a-menu-item
                                        v-if="isUIAllowed('table-rename')"
                                        :data-testid="`sidebar-table-rename-${table.title}`"
                                        @click="openRenameTableDialog(table, base.id)"
                                      >
                                        <div class="nc-project-menu-item">
                                          {{ $t('general.rename') }}
                                        </div>
                                      </a-menu-item>

                                      <a-menu-item
                                        v-if="isUIAllowed('table-delete')"
                                        :data-testid="`sidebar-table-delete-${table.title}`"
                                        @click="deleteTable(table)"
                                      >
                                        <div class="nc-project-menu-item">
                                          {{ $t('general.delete') }}
                                        </div>
                                      </a-menu-item>
                                    </a-menu>
                                  </template>
                                </a-dropdown>
                              </div>
                            </GeneralTooltip>
                          </div>-->
                        </div>
                      </a-collapse-panel>
                    </a-collapse>
                  </div>
                </div>
              </div>
            </div>

            <template v-if="!isSharedBase" #overlay>
              <a-menu class="!py-0 rounded text-sm">
                <template v-if="contextMenuTarget.type === 'base'">
                  <a-menu-item v-if="isUIAllowed('sqlEditor')" @click="openSqlEditor(contextMenuTarget.value)">
                    <div class="nc-project-menu-item">SQL Editor</div>
                  </a-menu-item>

                  <a-menu-item @click="openErdView(contextMenuTarget.value)">
                    <div class="nc-project-menu-item">ERD View</div>
                  </a-menu-item>
                </template>

                <template v-else-if="contextMenuTarget.type === 'table'">
                  <a-menu-item
                    v-if="isUIAllowed('table-rename')"
                    @click="openRenameTableDialog(contextMenuTarget.value, projects[project.id].bases[0].id, true)"
                  >
                    <div class="nc-project-menu-item">
                      {{ $t('general.rename') }}
                    </div>
                  </a-menu-item>

                  <a-menu-item v-if="isUIAllowed('table-delete')" @click="deleteTable(contextMenuTarget.value)">
                    <div class="nc-project-menu-item">
                      {{ $t('general.delete') }}
                    </div>
                  </a-menu-item>
                </template>

                <template v-else>
                  <a-menu-item @click="reloadTables">
                    <div class="nc-project-menu-item">
                      {{ $t('general.reload') }}
                    </div>
                  </a-menu-item>
                </template>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>
    </div>

    <div class="flex items-center py-2 justify-center">
      <WorkspaceCreateProjectBtn modal type="ghost" :activeWorkspaceId="route.params.workspaceId">
        <PhPlusThin />
        Add New
      </WorkspaceCreateProjectBtn>
    </div>
    <a-divider class="!my-0" />

    <div class="flex items-start flex-col justify-start px-2 py-3 gap-2">

      <GeneralJoinCloud class="color-transition px-2 text-gray-500 cursor-pointer select-none hover:text-accent" />

    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-treeview-container {
  @apply h-[calc(100vh_-_var(--header-height))];
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
  @apply bg-primary bg-opacity-8 rounded;
}
</style>
