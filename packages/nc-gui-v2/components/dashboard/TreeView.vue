<script setup lang="ts">
import { computed } from '@vue/reactivity'
import { Modal } from 'ant-design-vue'
import type { LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import Sortable from 'sortablejs'
import { useToast } from 'vue-toastification'
import SettingsModal from './settings/SettingsModal.vue'
import { useProject, useTabs, useUIPermission, watchEffect } from '#imports'
import { useNuxtApp, useRoute } from '#app'
import { extractSdkResponseErrorMsg } from '~/utils'
import MdiSettingIcon from '~icons/mdi/cog'
import MdiTable from '~icons/mdi/table'
import MdiView from '~icons/mdi/eye-circle-outline'
import MdiTableLarge from '~icons/mdi/table-large'
import MdiMenuDown from '~icons/mdi/chevron-down'
import MdiPlus from '~icons/mdi/plus-circle-outline'
import MdiDrag from '~icons/mdi/drag-vertical'
import MdiMenuIcon from '~icons/mdi/dots-vertical'
import MdiAPIDocIcon from '~icons/mdi/open-in-new'
import { TabType } from '~/composables'

const { addTab } = useTabs()
const toast = useToast()
const { $api, $e } = useNuxtApp()
const { isUIAllowed } = useUIPermission()
const route = useRoute()
const { tables, loadTables } = useProject(route.params.projectId as string)
const { closeTab } = useTabs()

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

const apiLink = computed(
  () =>
    // new URL(
    `/api/v1/db/meta/projects/${route.params.projectId}/swagger`,
  // todo: get siteUrl
  // this.$store.state.project.appInfo && this.$store.state.project.appInfo.ncSiteUrl
  // ),
)

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

const deleteTable = (table: TableType) => {
  $e('c:table:delete')
  // 'Click Submit to Delete The table'
  Modal.confirm({
    title: `Click Yes to Delete The table : ${table.title}`,
    okText: 'Yes',
    okType: 'danger',
    cancelText: 'No',
    async onOk() {
      const { getMeta, removeMeta } = useMetas()
      try {
        const meta = (await getMeta(table.id as string)) as TableType
        const relationColumns = meta?.columns?.filter((c) => c.uidt === UITypes.LinkToAnotherRecord)

        if (relationColumns?.length) {
          const refColMsgs = await Promise.all(
            relationColumns.map(async (c, i) => {
              const refMeta = (await getMeta(
                (c?.colOptions as LinkToAnotherRecordType)?.fk_related_model_id as string,
              )) as TableType
              return `${i + 1}. ${c.title} is a LinkToAnotherRecord of ${(refMeta && refMeta.title) || c.title}`
            }),
          )
          toast.info(
            h('div', {
              innerHTML: `<div style="padding:10px 4px">Unable to delete tables because of the following.
                <br><br>${refColMsgs.join('<br>')}<br><br>
                Delete them & try again</div>`,
            }),
          )
          return
        }

        await $api.dbTable.delete(table?.id as string)

        closeTab({
          type: TabType.TABLE,
          id: table.id,
          title: table.title,
        })

        await loadTables()

        removeMeta(table.id as string)
        toast.info(`Deleted table ${table.title} successfully`)
        $e('a:table:delete')
      } catch (e: any) {
        toast.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
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
</script>

<template>
  <div class="nc-treeview-container flex flex-column">
    <div class="px-3 py-2">
      <a-input-search
        v-model:value="filterQuery"
        size="small"
        class="nc-filter-input"
        :placeholder="$t('placeholder.searchProjectTree')"
      />
    </div>

    <a-dropdown :trigger="['contextmenu']">
      <div class="p-1 flex-1 overflow-y-auto flex flex-column scrollbar-thin-primary">
        <div
          class="py-1 px-3 flex w-full align-center gap-1 cursor-pointer"
          @click="showTableList = !showTableList"
          @contextmenu="setMenuContext('main')"
        >
          <MdiTable class="mr-1 text-gray-500" />
          <span class="flex-grow text-bold nc-project-tree"
            >{{ $t('objects.tables') }} <template v-if="tables?.length">({{ tables.length }})</template></span
          >
          <MdiPlus v-t="['c:table:create:navdraw']" class="text-gray-500 nc-btn-tbl-add" @click.stop="tableCreateDlg = true" />
          <MdiMenuDown
            class="transition-transform !duration-100 text-gray-500"
            :class="{ 'transform rotate-180': showTableList }"
          />
        </div>
        <div class="flex-1">
          <div class="transition-height duration-200 overflow-hidden" :class="{ 'h-100': showTableList, 'h-0': !showTableList }">
            <div :key="key" ref="menuRef" class="border-none sortable-list">
              <div
                v-for="table in tables"
                :key="table.id"
                v-t="['a:table:open']"
                :class="[{ hidden: !filteredTables?.includes(table) }, `nc-project-tree-tbl nc-project-tree-tbl-${table.title}`]"
                class="!pl-1 py-1 !h-[28px] !my-0 text-sm cursor-pointer group"
                :data-order="table.order"
                :data-id="table.id"
                @click="addTableTab(table)"
              >
                <div class="flex align-center gap-1 h-full" @contextmenu="setMenuContext('table', table)">
                  <MdiDrag
                    :class="`transition-opacity opacity-0 group-hover:opacity-100 text-gray-500 nc-drag-icon cursor-move nc-child-draggable-icon-${table.title}`"
                  />
                  <component :is="icon(table)" class="text-[10px] text-gray-500" />

                  <span class="nc-tbl-title text-xs flex-1 ml-2">{{ table.title }}</span>
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
    <div class="w-full h-[1px] bg-gray-200" />
    <a v-if="isUIAllowed('apiDocs')" v-t="['e:api-docs']" class="nc-treeview-footer-item" :href="apiLink" target="_blank">
      <MdiAPIDocIcon class="mr-2" />
      <span> {{ $t('title.apiDocs') }}</span>
    </a>
    <div
      v-if="isUIAllowed('settings')"
      v-t="['c:navdraw:project-settings']"
      class="nc-treeview-footer-item nc-team-settings"
      @click="settingsDlg = true"
    >
      <MdiSettingIcon class="mr-2" />
      <span> {{ $t('title.teamAndSettings') }}</span>
    </div>

    <SettingsModal :show="settingsDlg" @closed="settingsDlg = false" />
    <DlgTableCreate v-model="tableCreateDlg" />
    <DlgTableRename v-if="renameTableMeta" v-model="renameTableDlg" :table-meta="renameTableMeta" />
  </div>
</template>

<style scoped>
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
</style>
