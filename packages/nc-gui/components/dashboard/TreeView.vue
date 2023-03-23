<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import type { Input } from 'ant-design-vue'
import { Dropdown, Tooltip, message } from 'ant-design-vue'
import Sortable from 'sortablejs'
import GithubButton from 'vue-github-button'
import { Icon } from '@iconify/vue'
import type { VNodeRef } from '#imports'
import {
  ClientType,
  Empty,
  TabType,
  computed,
  extractSdkResponseErrorMsg,
  iconMap,
  isDrawerOrModalExist,
  isMac,
  parseProp,
  reactive,
  ref,
  resolveComponent,
  storeToRefs,
  useDialog,
  useGlobal,
  useNuxtApp,
  useProject,
  useRoute,
  useTable,
  useTabs,
  useToggle,
  useUIPermission,
  watchEffect,
} from '#imports'
import PhEyeThin from '~icons/ph/EyeThin'
import PhTableThin from '~icons/ph/TableThin'

const { isMobileMode } = useGlobal()

const { addTab, updateTab } = useTabs()

const { $api, $e } = useNuxtApp()

const projectStore = useProject()

const { loadTables } = projectStore
const { bases, tables, isSharedBase, project } = storeToRefs(projectStore)

const { activeTab } = storeToRefs(useTabs())

const { deleteTable } = useTable()

const { isUIAllowed } = useUIPermission()

const route = useRoute()

const [searchActive, toggleSearchActive] = useToggle()

const { appInfo } = useGlobal()

const toggleDialog = inject(ToggleDialogInj, () => {})

const keys = $ref<Record<string, number>>({})

const activeKey = ref<string[]>([])

const menuRefs = $ref<HTMLElement[] | HTMLElement>()

let filterQuery = $ref('')

const activeTable = computed(() => ([TabType.TABLE, TabType.VIEW].includes(activeTab.value?.type) ? activeTab.value.id : null))

const tablesById = $computed(() =>
  tables.value?.reduce<Record<string, TableType>>((acc, table) => {
    acc[table.id!] = table

    return acc
  }, {}),
)

const filteredTables = $computed(() =>
  tables.value?.filter(
    (table) => !searchActive.value || !filterQuery || table.title.toLowerCase().includes(filterQuery.toLowerCase()),
  ),
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
    return PhEyeThin
  }
}

const contextMenuTarget = reactive<{ type?: 'table' | 'main'; value?: any }>({})

const setMenuContext = (type: 'table' | 'main', value?: any) => {
  contextMenuTarget.type = type
  contextMenuTarget.value = value
}

const reloadTables = async () => {
  $e('a:table:refresh:navdraw')

  await loadTables()
}

const addTableTab = (table: TableType) => {
  addTab({ title: table.title, id: table.id, type: table.type as TabType })
}

function openRenameTableDialog(table: TableType, baseId?: string, rightClick = false) {
  $e(rightClick ? 'c:table:rename:navdraw:right-click' : 'c:table:rename:navdraw:options')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableRename'), {
    'modelValue': isOpen,
    'tableMeta': table,
    'baseId': baseId || bases.value[0].id,
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
    'baseId': baseId || bases.value[0].id,
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
    'baseId': baseId || bases.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openTableCreateDialog(baseId?: string) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    'baseId': baseId || bases.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
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
          openTableCreateDialog()
        }
        break
      }
    }
  }
})

watch(
  activeTable,
  (value, oldValue) => {
    let tableTitle
    if (value) {
      if (value !== oldValue) {
        const fndTable = tables.value.find((el) => el.id === value)
        if (fndTable) {
          activeKey.value = [`collapse-${fndTable.base_id}`]
          tableTitle = fndTable.title
        }
      }
    } else {
      const table = bases.value.filter((el) => el.enabled)[0]
      if (table?.id) {
        activeKey.value = [`collapse-${table.id}`]
      }
      if (table?.title) {
        tableTitle = table.title
      }
    }
    if (project.value.title && tableTitle) {
      document.title = `${project.value.title}: ${tableTitle} | NocoDB`
    } else {
      document.title = 'NocoDB'
    }
  },
  { immediate: true },
)

const setIcon = async (icon: string, table: TableType) => {
  try {
    table.meta = {
      ...parseProp(table.meta),
      icon,
    }
    tables.value.splice(tables.value.indexOf(table), 1, { ...table })

    updateTab({ id: table.id }, { meta: table.meta })

    $api.dbTable.update(table.id as string, {
      meta: table.meta,
    })

    $e('a:table:icon:navdraw', { icon })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div class="nc-treeview-container flex flex-col">
    <a-dropdown :trigger="['contextmenu']" overlay-class-name="nc-dropdown-tree-view-context-menu">
      <div class="pt-2 pl-2 pb-2 flex-1 overflow-y-auto flex flex-col scrollbar-thin-dull" :class="{ 'mb-[20px]': isSharedBase }">
        <div
          v-if="bases[0] && bases[0].enabled && !bases.slice(1).filter((el) => el.enabled)?.length"
          class="min-h-[36px] py-1 px-3 flex w-full items-center gap-1 cursor-pointer"
          @contextmenu="setMenuContext('main')"
        >
          <Transition name="slide-left" mode="out-in">
            <a-input
              v-if="searchActive"
              :ref="searchInputRef"
              v-model:value="filterQuery"
              class="flex-1 rounded"
              :placeholder="$t('placeholder.searchProjectTree')"
            />

            <span v-else class="flex-1 text-bold uppercase nc-project-tree text-gray-500 font-weight-bold">
              {{ $t('objects.tables') }}

              <template v-if="tables.filter((table) => table.base_id === bases[0].id)?.length">
                ({{ tables.filter((table) => table.base_id === bases[0].id).length }})
              </template>
            </span>
          </Transition>

          <Transition name="layout" mode="out-in">
            <MdiClose v-if="searchActive" class="text-gray-500 text-lg mx-1 mt-0.5" @click="onSearchCloseIconClick" />
            <component :is="iconMap.search" v-else class="text-gray-500 text-lg mx-1 mt-0.5" @click="toggleSearchActive(true)" />
          </Transition>
        </div>
        <div
          v-else
          class="min-h-[36px] py-1 px-3 flex w-full items-center gap-1 cursor-pointer"
          @contextmenu="setMenuContext('main')"
        >
          <Transition name="slide-left" mode="out-in">
            <a-input
              v-if="searchActive"
              :ref="searchInputRef"
              v-model:value="filterQuery"
              class="flex-1 rounded"
              :placeholder="$t('placeholder.searchProjectTree')"
            />

            <span v-else class="flex-1 text-bold uppercase nc-project-tree text-gray-500 font-weight-bold">
              BASES
              <template v-if="tables.filter((table) => table.base_id === bases[0].id)?.length">
                ({{ bases.filter((el) => el.enabled).length }})
              </template>
            </span>
          </Transition>

          <Transition name="slide-right" mode="out-in">
            <MdiClose v-if="searchActive" class="text-gray-500 text-lg mx-1 mt-0.5" @click="onSearchCloseIconClick" />
            <IcRoundSearch v-else class="text-gray-500 text-lg mx-1 mt-0.5" @click="onSearchIconClick" />
          </Transition>

          <a-dropdown v-if="!isSharedBase" :trigger="['click']" overlay-class-name="nc-dropdown-import-menu" @click.stop>
            <Transition name="slide-right" mode="out-in">
              <component :is="iconMap.threeDotVertical" v-if="!searchActive" class="hover:text-accent outline-0" />
            </Transition>

            <template #overlay>
              <a-menu class="!py-0 rounded text-sm">
                <a-menu-item-group title="Connect to new datasource" class="!px-0 !mx-0">
                  <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MYSQL)">
                    <div class="color-transition nc-project-menu-item group">
                      <LogosMysqlIcon class="group-hover:text-accent" />
                      MySQL
                    </div>
                  </a-menu-item>
                  <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.PG)">
                    <div class="color-transition nc-project-menu-item group">
                      <LogosPostgresql class="group-hover:text-accent" />
                      Postgres
                    </div>
                  </a-menu-item>
                  <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.SQLITE)">
                    <div class="color-transition nc-project-menu-item group">
                      <VscodeIconsFileTypeSqlite class="group-hover:text-accent" />
                      SQLite
                    </div>
                  </a-menu-item>
                  <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MSSQL)">
                    <div class="color-transition nc-project-menu-item group">
                      <SimpleIconsMicrosoftsqlserver class="group-hover:text-accent" />
                      MSSQL
                    </div>
                  </a-menu-item>
                  <a-menu-item
                    v-if="appInfo.ee"
                    key="connect-new-source"
                    @click="toggleDialog(true, 'dataSources', ClientType.SNOWFLAKE)"
                  >
                    <div class="color-transition nc-project-menu-item group">
                      <LogosSnowflakeIcon class="group-hover:text-accent" />
                      Snowflake
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
                    <!-- Request a data source you need? -->
                    {{ $t('labels.requestDataSource') }}
                  </a>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>

        <div v-if="bases[0] && bases[0].enabled && !bases.slice(1).filter((el) => el.enabled)?.length" class="flex-1">
          <div
            v-if="isUIAllowed('table-create')"
            class="group flex items-center gap-2 pl-2 pr-3 py-2 text-primary/70 hover:(text-primary/100) cursor-pointer select-none"
            @click="openTableCreateDialog(bases[0].id)"
          >
            <component :is="iconMap.plus" class="w-5" />

            <span class="text-gray-500 group-hover:(text-primary/100) flex-1 nc-add-new-table">{{ $t('tooltip.addTable') }}</span>

            <a-dropdown v-if="!isSharedBase" :trigger="['click']" overlay-class-name="nc-dropdown-import-menu" @click.stop>
              <component
                :is="iconMap.threeDotVertical"
                class="transition-opacity opacity-0 group-hover:opacity-100 nc-import-menu outline-0"
              />

              <template #overlay>
                <a-menu class="!py-0 rounded text-sm">
                  <!--                  Quick Import From -->
                  <a-menu-item-group :title="$t('title.quickImportFrom')" class="!px-0 !mx-0">
                    <a-menu-item
                      v-if="isUIAllowed('airtableImport')"
                      key="quick-import-airtable"
                      @click="openAirtableImportDialog(bases[0].id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <component :is="iconMap.table" class="group-hover:text-accent" />
                        Airtable
                      </div>
                    </a-menu-item>

                    <a-menu-item
                      v-if="isUIAllowed('csvImport')"
                      key="quick-import-csv"
                      @click="openQuickImportDialog('csv', bases[0].id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <component :is="iconMap.csv" class="group-hover:text-accent" />
                        CSV file
                      </div>
                    </a-menu-item>

                    <a-menu-item
                      v-if="isUIAllowed('jsonImport')"
                      key="quick-import-json"
                      @click="openQuickImportDialog('json', bases[0].id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <component :is="iconMap.code" class="group-hover:text-accent" />
                        JSON file
                      </div>
                    </a-menu-item>

                    <a-menu-item
                      v-if="isUIAllowed('excelImport')"
                      key="quick-import-excel"
                      @click="openQuickImportDialog('excel', bases[0].id)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <component :is="iconMap.excel" class="group-hover:text-accent" />
                        Microsoft Excel
                      </div>
                    </a-menu-item>
                  </a-menu-item-group>

                  <a-menu-divider class="my-0" />

                  <a-menu-item-group title="Connect to new datasource" class="!px-0 !mx-0">
                    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MYSQL)">
                      <div class="color-transition nc-project-menu-item group">
                        <LogosMysqlIcon class="group-hover:text-accent" />
                        MySQL
                      </div>
                    </a-menu-item>
                    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.PG)">
                      <div class="color-transition nc-project-menu-item group">
                        <LogosPostgresql class="group-hover:text-accent" />
                        Postgres
                      </div>
                    </a-menu-item>
                    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.SQLITE)">
                      <div class="color-transition nc-project-menu-item group">
                        <VscodeIconsFileTypeSqlite class="group-hover:text-accent" />
                        SQLite
                      </div>
                    </a-menu-item>
                    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MSSQL)">
                      <div class="color-transition nc-project-menu-item group">
                        <SimpleIconsMicrosoftsqlserver class="group-hover:text-accent" />
                        MSSQL
                      </div>
                    </a-menu-item>
                    <a-menu-item
                      v-if="appInfo.ee"
                      key="connect-new-source"
                      @click="toggleDialog(true, 'dataSources', ClientType.SNOWFLAKE)"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <LogosSnowflakeIcon class="group-hover:text-accent" />
                        Snowflake
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
                      <!-- Request a data source you need? -->
                      {{ $t('labels.requestDataSource') }}
                    </a>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>

          <div class="transition-height duration-200">
            <div class="border-none sortable-list">
              <div v-if="bases[0]" :key="`base-${bases[0].id}`">
                <div
                  v-if="bases[0] && bases[0].enabled"
                  ref="menuRefs"
                  :key="`sortable-${bases[0].id}-${bases[0].id && bases[0].id in keys ? keys[bases[0].id] : '0'}`"
                  :nc-base="bases[0].id"
                >
                  <div
                    v-for="table of tables.filter((table) => table.base_id === bases[0].id)"
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
                    <GeneralTooltip class="pl-2 pr-3 py-2" modifier-key="Alt">
                      <template #title>{{ table.table_name }}</template>
                      <div class="flex items-center gap-2 h-full" @contextmenu="setMenuContext('table', table)">
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
                                <span v-if="table.meta?.icon" :key="table.meta?.icon" class="nc-table-icon flex items-center">
                                  <Icon
                                    :key="table.meta?.icon"
                                    :data-testid="`nc-icon-${table.meta?.icon}`"
                                    class="text-xl"
                                    :icon="table.meta?.icon"
                                  ></Icon>
                                </span>
                                <component
                                  :is="icon(table)"
                                  v-else
                                  class="nc-table-icon nc-view-icon w-5"
                                  :class="{ 'group-hover:text-gray-500': isUIAllowed('treeview-drag-n-drop') }"
                                />

                                <template v-if="isUIAllowed('tableIconCustomisation')" #title>Change icon</template>
                              </component>
                            </div>
                            <template v-if="isUIAllowed('tableIconCustomisation')" #overlay>
                              <GeneralEmojiIcons class="shadow bg-white p-2" @select-icon="setIcon($event, table)" />
                            </template>
                          </component>
                        </div>

                        <div class="nc-tbl-title flex-1">
                          <GeneralTruncateText :key="table.title" :length="activeTable === table.id ? 18 : 20">{{
                            table.title
                          }}</GeneralTruncateText>
                        </div>

                        <a-dropdown
                          v-if="!isSharedBase && (isUIAllowed('table-rename') || isUIAllowed('table-delete'))"
                          :trigger="['click']"
                          @click.stop
                        >
                          <component
                            :is="iconMap.threeDotVertical"
                            class="transition-opacity opacity-0 group-hover:opacity-100 outline-0"
                          />

                          <template #overlay>
                            <a-menu class="!py-0 rounded text-sm">
                              <a-menu-item v-if="isUIAllowed('table-rename')" @click="openRenameTableDialog(table, bases[0].id)">
                                <div class="nc-project-menu-item" :data-testid="`sidebar-table-rename-${table.title}`">
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
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="!tables.filter((table) => table.base_id === bases[0].id)?.length"
            class="mt-0.5 pt-16 mx-3 flex flex-col items-center border-t-1 border-gray-50"
          >
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" />
          </div>
        </div>

        <div v-else class="transition-height duration-200">
          <div class="border-none sortable-list">
            <div v-for="[index, base] of Object.entries(bases)" :key="`base-${base.id}`">
              <a-collapse
                v-if="base && base.enabled"
                v-model:activeKey="activeKey"
                :class="[{ hidden: searchActive && !!filterQuery && !filteredTables?.find((el) => el.base_id === base.id) }]"
                expand-icon-position="right"
                :bordered="false"
                :accordion="!searchActive"
                ghost
              >
                <a-collapse-panel :key="`collapse-${base.id}`">
                  <template #header>
                    <div v-if="index === '0'" class="flex items-center gap-2 text-gray-500 font-bold">
                      <GeneralBaseLogo :base-type="base.type" />
                      Default ({{ tables.filter((table) => table.base_id === base.id).length || '0' }})
                    </div>
                    <div v-else class="flex items-center gap-2 text-gray-500 font-bold">
                      <GeneralBaseLogo :base-type="base.type" />
                      {{ base.alias || '' }}
                      ({{ tables.filter((table) => table.base_id === base.id).length || '0' }})
                    </div>
                  </template>
                  <div
                    v-if="index === '0' && isUIAllowed('table-create')"
                    class="group flex items-center gap-2 pl-8 pr-3 py-2 text-primary/70 hover:(text-primary/100) cursor-pointer select-none"
                    @click="openTableCreateDialog(bases[0].id)"
                  >
                    <component :is="iconMap.plus" />

                    <span class="text-gray-500 group-hover:(text-primary/100) flex-1 nc-add-new-table">{{
                      $t('tooltip.addTable')
                    }}</span>

                    <a-dropdown
                      v-if="!isSharedBase"
                      :trigger="['click']"
                      overlay-class-name="nc-dropdown-import-menu"
                      @click.stop
                    >
                      <component
                        :is="iconMap.threeDotVertical"
                        class="transition-opacity opacity-0 group-hover:opacity-100 nc-import-menu outline-0"
                      />

                      <template #overlay>
                        <a-menu class="!py-0 rounded text-sm">
                          <!--                  Quick Import From -->
                          <a-menu-item-group :title="$t('title.quickImportFrom')" class="!px-0 !mx-0">
                            <a-menu-item
                              v-if="isUIAllowed('airtableImport')"
                              key="quick-import-airtable"
                              @click="openAirtableImportDialog(bases[0].id)"
                            >
                              <div class="color-transition nc-project-menu-item group">
                                <MdiTableLarge class="group-hover:text-accent" />
                                Airtable
                              </div>
                            </a-menu-item>

                            <a-menu-item
                              v-if="isUIAllowed('csvImport')"
                              key="quick-import-csv"
                              @click="openQuickImportDialog('csv', bases[0].id)"
                            >
                              <div class="color-transition nc-project-menu-item group">
                                <MdiFileDocumentOutline class="group-hover:text-accent" />
                                CSV file
                              </div>
                            </a-menu-item>

                            <a-menu-item
                              v-if="isUIAllowed('jsonImport')"
                              key="quick-import-json"
                              @click="openQuickImportDialog('json', bases[0].id)"
                            >
                              <div class="color-transition nc-project-menu-item group">
                                <MdiCodeJson class="group-hover:text-accent" />
                                JSON file
                              </div>
                            </a-menu-item>

                            <a-menu-item
                              v-if="isUIAllowed('excelImport')"
                              key="quick-import-excel"
                              @click="openQuickImportDialog('excel', bases[0].id)"
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
                              <!-- Request a data source you need? -->
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
                    <component :is="iconMap.plus" />

                    <span class="text-gray-500 group-hover:(text-primary/100) flex-1 nc-add-new-table">{{
                      $t('tooltip.addTable')
                    }}</span>

                    <a-dropdown
                      v-if="!isSharedBase"
                      :trigger="['click']"
                      overlay-class-name="nc-dropdown-import-menu"
                      @click.stop
                    >
                      <component
                        :is="iconMap.threeDotVertical"
                        class="transition-opacity opacity-0 group-hover:opacity-100 nc-import-menu outline-0"
                      />

                      <template #overlay>
                        <a-menu class="!py-0 rounded text-sm">
                          <!--                  Quick Import From -->
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
                              <!-- Request a data source you need? -->
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
                    <div
                      v-for="table of tables.filter((table) => table.base_id === base.id)"
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
                        <div class="flex items-center gap-2 h-full" @contextmenu="setMenuContext('table', table)">
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
                                  <span v-if="table.meta?.icon" :key="table.meta?.icon" class="nc-table-icon flex items-center">
                                    <Icon
                                      :key="table.meta?.icon"
                                      :data-testid="`nc-icon-${table.meta?.icon}`"
                                      class="text-xl"
                                      :icon="table.meta?.icon"
                                    ></Icon>
                                  </span>
                                  <component
                                    :is="icon(table)"
                                    v-else
                                    class="nc-table-icon nc-view-icon w-5"
                                    :class="{ 'group-hover:text-gray-500': isUIAllowed('treeview-drag-n-drop') }"
                                  />

                                  <template v-if="isUIAllowed('tableIconCustomisation')" #title>Change icon</template>
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
                            <component
                              :is="iconMap.threeDotVertical"
                              class="transition-opacity opacity-0 group-hover:opacity-100 outline-0"
                            />

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
                    </div>
                  </div>
                </a-collapse-panel>
              </a-collapse>
            </div>
          </div>
        </div>
      </div>

      <template v-if="!isSharedBase" #overlay>
        <a-menu class="!py-0 rounded text-sm">
          <template v-if="contextMenuTarget.type === 'table'">
            <a-menu-item
              v-if="isUIAllowed('table-rename')"
              @click="openRenameTableDialog(contextMenuTarget.value, bases[0].id, true)"
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

    <a-divider class="!my-0" />

    <div class="flex items-start flex-col justify-start px-2 py-3 gap-2">
      <LazyGeneralAddBaseButton class="color-transition py-1.5 px-2 cursor-pointer select-none hover:text-primary" />

      <LazyGeneralHelpAndSupport class="color-transition px-2 text-gray-500 cursor-pointer select-none hover:text-accent" />

      <GeneralJoinCloud
        v-if="!isMobileMode"
        class="color-transition px-2 text-gray-500 cursor-pointer select-none hover:text-accent"
      />

      <GithubButton
        v-if="!isMobileMode"
        class="ml-2 py-1"
        href="https://github.com/nocodb/nocodb"
        data-icon="octicon-star"
        data-show-count="true"
        data-size="large"
      >
        Star
      </GithubButton>
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

.nc-tree-item {
  @apply relative cursor-pointer after:(pointer-events-none content-[''] absolute top-0 left-0  w-full h-full right-0 !bg-current transition transition-opactity duration-100 opacity-0);
}

.nc-tree-item svg {
  @apply text-primary text-opacity-60;
}

.nc-tree-item.active {
  @apply text-primary font-weight-bold after:(!opacity-20);
  @apply border-r-3 border-primary;

  svg {
    @apply text-primary !text-opacity-100;
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
</style>
