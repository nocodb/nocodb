<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import Sortable from 'sortablejs'
import GithubButton from 'vue-github-button'
import {
  Empty,
  computed,
  inject,
  reactive,
  ref,
  resolveComponent,
  useDialog,
  useNuxtApp,
  useProject,
  useTable,
  useTabs,
  useUIPermission,
  watchEffect,
} from '#imports'
import { TabType } from '~/lib'
import MdiView from '~icons/mdi/eye-circle-outline'
import MdiTableLarge from '~icons/mdi/table-large'

const { addTab } = useTabs()

const { $api, $e } = useNuxtApp()

const { tables, loadTables, isSharedBase } = useProject()

const { activeTab } = useTabs()

const { deleteTable } = useTable()

const { isUIAllowed } = useUIPermission()

const isLocked = inject('TreeViewIsLockedInj')

let key = $ref(0)

const menuRef = $ref<HTMLLIElement>()

const filterQuery = $ref('')

const activeTable = computed(() => ([TabType.TABLE, TabType.VIEW].includes(activeTab.value?.type) ? activeTab.value.title : null))

const tablesById = $computed(() =>
  tables.value?.reduce<Record<string, TableType>>((acc, table) => {
    acc[table.id!] = table

    return acc
  }, {}),
)

const filteredTables = $computed(() =>
  tables.value?.filter((table) => !filterQuery || table.title.toLowerCase().includes(filterQuery.toLowerCase())),
)

let sortable: Sortable

// todo: replace with vuedraggable
const initSortable = (el: Element) => {
  if (sortable) sortable.destroy()
  sortable = Sortable.create(el as HTMLLIElement, {
    handle: '.nc-drag-icon',
    onEnd: async (evt) => {
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
      tables.value?.splice(newIndex, 0, ...tables.value?.splice(oldIndex, 1))

      // force re-render the list
      key++

      // update the item order
      await $api.dbTable.reorder(item.id as string, {
        order: item.order,
      })
    },
    animation: 150,
  })
}

watchEffect(() => {
  if (menuRef) {
    initSortable(menuRef)
  }
})

const icon = (table: TableType) => {
  if (table.type === 'table') {
    return MdiTableLarge
  }
  if (table.type === 'view') {
    return MdiView
  }
}

const contextMenuTarget = reactive<{ type?: 'table' | 'main'; value?: any }>({})

const setMenuContext = (type: 'table' | 'main', value?: any) => {
  contextMenuTarget.type = type
  contextMenuTarget.value = value

  // $e('c:table:create:navdraw:right-click')
}

const reloadTables = async () => {
  $e('a:table:refresh:navdraw')

  await loadTables()
}

const addTableTab = (table: TableType) => {
  addTab({ title: table.title, id: table.id, type: table.type as TabType })
}

function openRenameTableDialog(table: TableType, rightClick = false) {
  $e(rightClick ? 'c:table:rename:navdraw:right-click' : 'c:table:rename:navdraw:options')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableRename'), {
    'modelValue': isOpen,
    'tableMeta': table,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openQuickImportDialog(type: string) {
  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openAirtableImportDialog() {
  $e('a:actions:import-airtable')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgAirtableImport'), {
    'modelValue': isOpen,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openTableCreateDialog() {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <div class="nc-treeview-container flex flex-col">
    <a-dropdown :trigger="['contextmenu']" overlay-class-name="nc-dropdown-tree-view-context-menu">
      <div class="pt-2 pl-2 pb-2 flex-1 overflow-y-auto flex flex-col scrollbar-thin-dull" :class="{ 'mb-[20px]': isSharedBase }">
        <div class="py-1 px-3 flex w-full items-center gap-1 cursor-pointer" @contextmenu="setMenuContext('main')">
          <span class="flex-1 text-bold uppercase nc-project-tree text-gray-500 font-weight-bold">
            {{ $t('objects.tables') }}

            <template v-if="tables?.length"> ({{ tables.length }}) </template>
          </span>
        </div>

        <div class="flex-1">
          <div
            v-if="isUIAllowed('table-create')"
            class="group flex items-center gap-2 pl-5 pr-3 py-2 text-primary/70 hover:(text-primary/100) cursor-pointer select-none"
            @click="openTableCreateDialog"
          >
            <MdiPlus />

            <span class="text-gray-500 group-hover:(text-primary/100) flex-1 nc-add-new-table">{{ $t('tooltip.addTable') }}</span>

            <a-dropdown v-if="!isSharedBase" :trigger="['click']" overlay-class-name="nc-dropdown-import-menu" @click.stop>
              <MdiDotsVertical class="transition-opacity opacity-0 group-hover:opacity-100 nc-import-menu" />

              <template #overlay>
                <a-menu class="!py-0 rounded text-sm">
                  <!--                  Quick Import From -->
                  <a-menu-item-group :title="$t('title.quickImportFrom')" class="!px-0 !mx-0">
                    <a-menu-item
                      v-if="isUIAllowed('airtableImport')"
                      key="quick-import-airtable"
                      @click="openAirtableImportDialog"
                    >
                      <div class="color-transition nc-project-menu-item group">
                        <MdiTableLarge class="group-hover:text-accent" />
                        Airtable
                      </div>
                    </a-menu-item>

                    <a-menu-item v-if="isUIAllowed('csvImport')" key="quick-import-csv" @click="openQuickImportDialog('csv')">
                      <div class="color-transition nc-project-menu-item group">
                        <MdiFileDocumentOutline class="group-hover:text-accent" />
                        CSV file
                      </div>
                    </a-menu-item>

                    <a-menu-item v-if="isUIAllowed('jsonImport')" key="quick-import-json" @click="openQuickImportDialog('json')">
                      <div class="color-transition nc-project-menu-item group">
                        <MdiCodeJson class="group-hover:text-accent" />
                        JSON file
                      </div>
                    </a-menu-item>

                    <a-menu-item
                      v-if="isUIAllowed('excelImport')"
                      key="quick-import-excel"
                      @click="openQuickImportDialog('excel')"
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

          <div v-if="tables.length" class="transition-height duration-200 overflow-hidden">
            <div :key="key" ref="menuRef" class="border-none sortable-list">
              <div
                v-for="table of tables"
                :key="table.id"
                v-e="['a:table:open']"
                :class="[
                  { hidden: !filteredTables?.includes(table), active: activeTable === table.title },
                  `nc-project-tree-tbl nc-project-tree-tbl-${table.title}`,
                ]"
                class="nc-tree-item text-sm cursor-pointer group"
                :data-order="table.order"
                :data-id="table.id"
                @click="addTableTab(table)"
              >
                <GeneralTooltip wrapper-class="pl-5 pr-3 py-2" modifier-key="Alt">
                  <template #title>{{ table.table_name }}</template>

                  <div class="flex items-center gap-2 h-full" @contextmenu="setMenuContext('table', table)">
                    <div class="flex w-auto">
                      <MdiDragVertical
                        v-if="isUIAllowed('treeview-drag-n-drop')"
                        :class="`nc-child-draggable-icon-${table.title}`"
                        class="nc-drag-icon text-xs hidden group-hover:block transition-opacity opacity-0 group-hover:opacity-100 text-gray-500 cursor-move"
                        @click.stop.prevent
                      />

                      <component
                        :is="icon(table)"
                        class="nc-view-icon text-xs"
                        :class="{ 'group-hover:hidden group-hover:text-gray-500': isUIAllowed('treeview-drag-n-drop') }"
                      />
                    </div>

                    <div class="nc-tbl-title flex-1">
                      <GeneralTruncateText>{{ table.title }}</GeneralTruncateText>
                    </div>

                    <a-dropdown
                      v-if="!isSharedBase && !isLocked && (isUIAllowed('table-rename') || isUIAllowed('table-delete'))"
                      :trigger="['click']"
                      @click.stop
                    >
                      <MdiDotsVertical class="transition-opacity opacity-0 group-hover:opacity-100" />

                      <template #overlay>
                        <a-menu class="!py-0 rounded text-sm">
                          <a-menu-item v-if="isUIAllowed('table-rename')" @click="openRenameTableDialog(table)">
                            <div class="nc-project-menu-item">
                              {{ $t('general.rename') }}
                            </div>
                          </a-menu-item>

                          <a-menu-item v-if="isUIAllowed('table-delete')" @click="deleteTable(table)">
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

          <div v-else class="mt-0.5 pt-16 mx-3 flex flex-col items-center border-t-1 border-gray-50">
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" />
          </div>
        </div>
      </div>

      <template v-if="!isLocked && !isSharedBase" #overlay>
        <a-menu class="!py-0 rounded text-sm">
          <template v-if="contextMenuTarget.type === 'table'">
            <a-menu-item v-if="isUIAllowed('table-rename')" @click="openRenameTableDialog(contextMenuTarget.value, true)">
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
      <LazyGeneralShareBaseButton
        class="color-transition py-1.5 px-2 text-primary font-bold cursor-pointer select-none hover:text-accent"
      />

      <LazyGeneralHelpAndSupport class="color-transition px-2 text-gray-500 cursor-pointer select-none hover:text-accent" />

      <GithubButton
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
  @apply relative  cursor-pointer after:(pointer-events-none content-[''] absolute top-0 left-0  w-full h-full right-0 !bg-current transition transition-opactity duration-100 opacity-0);
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
  @apply !py-0 active:(ring ring-accent);
}

:deep(.ant-dropdown-menu-title-content) {
  @apply !p-0;
}
</style>
