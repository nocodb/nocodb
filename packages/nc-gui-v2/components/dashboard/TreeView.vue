<script setup lang="ts">
import { useNuxtApp, useRoute } from '#app'
import { computed, useProject, useTable, useTabs, useUIPermission, watchEffect } from '#imports'
import type { TableType } from 'nocodb-sdk'
import Sortable from 'sortablejs'
import { useToast } from 'vue-toastification'
import { TabType } from '~/composables'
import MdiTable from '~icons/mdi/table'
import MdiView from '~icons/mdi/eye-circle-outline'
import MdiTableLarge from '~icons/mdi/table-large'
import MdiMenuDown from '~icons/mdi/chevron-down'
import MdiSettingIcon from '~icons/mdi/cog'
import MdiMenuIcon from '~icons/mdi/dots-vertical'
import MdiDrag from '~icons/mdi/drag-vertical'
import MdiView from '~icons/mdi/eye-circle-outline'
import MdiAPIDocIcon from '~icons/mdi/open-in-new'
import MdiPlus from '~icons/mdi/plus-circle-outline'
import MdiTable from '~icons/mdi/table'
import MdiTableLarge from '~icons/mdi/table-large'
import SettingsModal from './settings/SettingsModal.vue'
import MdiMenuIcon from '~icons/mdi/dots-vertical'

const { addTab } = useTabs()

const toast = useToast()

const { $api, $e } = useNuxtApp()

const route = useRoute()

const { tables, loadTables } = useProject(route.params.projectId as string)
const { closeTab, activeTab } = useTabs()
const { deleteTable } = useTable()


const tablesById = $computed<Record<string, TableType>>(() =>
  tables?.value?.reduce((acc: Record<string, TableType>, table: TableType) => {
    acc[table.id as string] = table
    return acc
  }, {}),
)

const settingsDlg = ref(false)
const showTableList = ref(true)
const tableCreateDlg = ref(false)
const tableDeleteDlg = ref(false)
const menuRef = $ref<HTMLLIElement>()
let key = $ref(0)
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
        order: item.order as any,
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

const filterQuery = $ref('')
const filteredTables = $computed(() => {
  return tables?.value?.filter((table) => !filterQuery || table?.title.toLowerCase()?.includes(filterQuery.toLowerCase()))
})

const contextMenuTarget = reactive<{ type?: 'table' | 'main'; value?: any }>({})
const setMenuContext = (type: 'table' | 'main', value?: any) => {
  contextMenuTarget.type = type
  contextMenuTarget.value = value
  $e('c:table:create:navdraw:right-click')
}

const renameTableDlg = ref(false)
const renameTableMeta = ref()
const showRenameTableDlg = (table: TableType, rightClick = false) => {
  $e(rightClick ? 'c:table:rename:navdraw:right-click' : 'c:table:rename:navdraw:options')
  renameTableMeta.value = table
  renameTableDlg.value = true
}
const reloadTables = async () => {
  $e('a:table:refresh:navdraw')
  await loadTables()
}
const addTableTab = (table: TableType) => {
  $e('a:table:open')
  addTab({ title: table.title, id: table.id, type: table.type as any })
}

const activeTable = computed(() => {
  return [TabType.TABLE, TabType.VIEW].includes(activeTab.value?.type) ? activeTab.value.title : null
})

</script>

<template>
  <div class="nc-treeview-container flex flex-col">
    <div class="px-2 py-[11.75px] border-b-1">
      <a-input-search
        v-model:value="filterQuery"
        size="small"
        class="nc-filter-input"
        :placeholder="$t('placeholder.searchProjectTree')"
      />
    </div>

    <a-dropdown :trigger="['contextmenu']">
      <div class="p-1 flex-1 overflow-y-auto flex flex-column scrollbar-thin-dull" style="direction: rtl">
        <div
          style="direction: ltr"
          class="py-1 px-3 flex w-full align-center gap-1 cursor-pointer"
          @click="showTableList = !showTableList"
          @contextmenu="setMenuContext('main')"
        >
          <MdiTable class="mr-1 text-gray-500" />

          <span class="flex-grow text-bold nc-project-tree">
            {{ $t('objects.tables') }}

            <template v-if="tables?.length"> ({{ tables.length }}) </template>
          </span>

          <MdiPlus
            v-t="['c:table:create:navdraw']"
            class="transform text-gray-500 hover:(text-pink-500 scale-105) nc-btn-tbl-add"
            @click.stop="tableCreateDlg = true"
          />

          <MdiMenuDown
            class="transition-transform !duration-100 text-gray-500 hover:text-pink-500"
            :class="{ 'transform rotate-180': showTableList }"
          />
        </div>
        <div style="direction: ltr" class="flex-1">
          <div class="transition-height duration-200 overflow-hidden" :class="{ 'h-100': showTableList, 'h-0': !showTableList }">
            <div :key="key" ref="menuRef" class="border-none sortable-list">
              <div
                v-for="table of tables"
                :key="table.id"
                v-t="['a:table:open']"
                :class="[{ hidden: !filteredTables?.includes(table),
                 'active': activeTable === table.title,}, `nc-project-tree-tbl nc-project-tree-tbl-${table.title}`,]"
                class="nc-tree-item pl-5 pr-3 py-2 text-sm cursor-pointer group"
                :data-order="table.order"
                :data-id="table.id"
                @click="addTableTab(table)"
              >
                <div class="flex align-center gap-2 h-full" @contextmenu="setMenuContext('table', table)">
                  <div class="flex w-auto">
                    <MdiDrag
                      :class="`nc-child-draggable-icon-${table.title}`"
                      class="nc-drag-icon text-xs hidden group-hover:block transition-opacity opacity-0 group-hover:opacity-100 text-gray-500 cursor-move"
                      @click.stop.prevent
                    />

                    <component
                      :is="icon(table)"
                      :class="route.params.title && route.params.title.includes(table.title) ? 'text-pink-500' : 'text-gray-500'"
                      class="nc-view-icon group-hover:hidden text-xs"
                    />
                  </div>

                  <div class="nc-tbl-title text-xs flex-1">{{ table.title }}</div>

                  <a-dropdown :trigger="['click']" @click.stop>
                    <MdiMenuIcon class="transition-opacity opacity-0 group-hover:opacity-100" />

                    <template #overlay>
                      <a-menu class="cursor-pointer">
                        <a-menu-item v-t="" class="!text-xs" @click="showRenameTableDlg(table)"><div>Rename</div></a-menu-item>

                        <a-menu-item class="!text-xs" @click="deleteTable(table)"> Delete</a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #overlay>
        <a-menu class="cursor-pointer">
          <template v-if="contextMenuTarget.type === 'table'">
            <a-menu-item class="!text-xs" @click="showRenameTableDlg(contextMenuTarget.value)">
              {{ $t('general.rename') }}
            </a-menu-item>
            <a-menu-item class="!text-xs" @click="deleteTable(contextMenuTarget.value)">
              {{ $t('general.delete') }}
            </a-menu-item>
          </template>
          <template v-else>
            <a-menu-item class="!text-xs" @click="reloadTables">
              {{ $t('general.reload') }}
            </a-menu-item>
          </template>
        </a-menu>
      </template>
    </a-dropdown>

    <DlgTableCreate v-if="tableCreateDlg" v-model="tableCreateDlg" />
    <DlgTableRename v-if="renameTableMeta" v-model="renameTableDlg" :table-meta="renameTableMeta" />
  </div>
</template>

<style lang="scss" scoped>
.nc-treeview-container {
  @apply h-[calc(100vh_-_var(--header-height))];
}

.nc-treeview-footer-item {
  @apply cursor-pointer px-4 py-2 flex align-center hover:bg-gray-200/20 text-xs text-current;
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

  &.dragging {
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
    @apply !bg-primary/25 text-primary;
  }
}

.nc-tree-item{
  @apply relative  cursor-pointer after:(content-[''] absolute top-0 left-0  w-full h-full right-0 !bg-current transition transition-opactity duration-100 opacity-0);
}

.nc-tree-item.active{
  @apply !text-primary after:(!opacity-10);
}

.nc-tree-item:hover{
  @apply !text-grey after:(!opacity-5);
}

</style>
