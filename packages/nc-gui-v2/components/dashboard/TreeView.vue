<script setup lang="ts">
import { computed } from '@vue/reactivity'
import { onMounted } from '@vue/runtime-core'
import type { TableType } from 'nocodb-sdk'
import Sortable from 'sortablejs'
import { $computed } from 'vue/macros'
import { useNuxtApp, useRoute } from '#app'
// import Draggable  from 'vuedraggable'
import useProject from '~/composables/useProject'
import useTabs from '~/composables/useTabs'
import MdiSettingIcon from '~icons/mdi/cog'
import MdiTable from '~icons/mdi/table'
import MdiView from '~icons/mdi/eye-circle-outline'
import MdiTableLarge from '~icons/mdi/table-large'
import MdiMenuDown from '~icons/mdi/chevron-down'
import MdiPlus from '~icons/mdi/plus-circle-outline'
import MdiDrag from '~icons/mdi/drag-vertical'
import MdiMenuIcon from '~icons/mdi/dots-vertical'
import MdiAPIDocIcon from '~icons/mdi/open-in-new'

const { addTab } = useTabs()
const { $api } = useNuxtApp()
const { isUIAllowed } = useUIPermission()
const route = useRoute()
const { tables, loadTables } = useProject(route.params.projectId as string)

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

onMounted(() => {
  setTimeout(() => {
    const el = document.querySelector('.sortable-list') // Must get this DomElement,
    Sortable.create(el, {
      handle: '.nc-drag-icon',
      onChange: async (evt) => {
        const { newIndex = 0, oldIndex = 0 } = evt

        const itemEl = evt.item as HTMLLIElement
        const item = tablesById[itemEl.dataset.id as string]

        // get the html collection of all list items
        const children: HTMLCollection = evt.to.children

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

        // update the item order
        await $api.dbTable.reorder(item.id as string, {
          order: item.order as any,
        })
      },
      animation: 150,
    })
  }, 1000)
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

const contextMenuTarget = reactive<{ type: 'table' | 'main'; value?: any }>({})
const setMenuContext = (type: 'table' | 'main', value?: any) => {
  contextMenuTarget.type = type
  contextMenuTarget.value = value
}
</script>

<template>
  <div class="nc-treeview-container flex flex-column">
    <div class="p-1">
      <a-input-search
        v-model:value="filterQuery"
        size="small"
        class="nc-filter-input"
        :placeholder="$t('placeholder.searchProjectTree')"
      />
    </div>

    <a-dropdown :trigger="['contextmenu']" >
      <div class="p-1 flex-1 overflow-y-auto flex flex-column">
        <div
          class="py-1 px-3 flex w-full align-center gap-1 cursor-pointer"
          @click="showTableList = !showTableList"
          @contextmenu="setMenuContext('main')"
        >
          <MdiTable class="mr-1 text-gray-500" />
          <span class="flex-grow text-bold">{{ $t('objects.tables') }} <template v-if="tables?.length">({{tables.length}})</template></span>
          <MdiPlus class="text-gray-500" @click.stop="tableCreateDlg = true" />
          <MdiMenuDown
            class="transition-transform !duration-100 text-gray-500"
            :class="{ 'transform rotate-180': showTableList }"
          />
        </div>
        <div class="flex-1">
          <div class="transition-height duration-200 overflow-hidden" :class="{ 'h-100': showTableList, 'h-0': !showTableList }">
            <a-menu class="border-none sortable-list">
              <a-menu-item
                v-for="table in filteredTables"
                :key="table.id"
                class="!pl-1 py-1 !h-[28px] !my-0 text-sm pointer group"
                :data-order="table.order"
                :data-id="table.id"
                @click="addTab({ type: 'table', title: table.title, id: table.id })"
              >
                <div class="flex align-center gap-1" @contextmenu="setMenuContext('table', table)">
                  <MdiDrag class="transition-opacity opacity-0 group-hover:opacity-100 text-gray-500 nc-drag-icon cursor-move" />
                  <component :is="icon(table)" class="text-xs text-gray-500" />

                  <span class="text-xs flex-1">{{ table.title }}</span>
                  <a-dropdown :trigger="['click']">
                    <MdiMenuIcon class="transition-opacity opacity-0 group-hover:opacity-100" />
                    <template #overlay>
                      <a-menu>
                        <a-menu-item class="!text-xs"> Rename</a-menu-item>
                        <a-menu-item class="!text-xs"> UI ACL</a-menu-item>
                        <a-menu-item class="!text-xs"> Delete</a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </div>
              </a-menu-item>
            </a-menu>
          </div>
        </div>
      </div>

      <template #overlay>
        <a-menu>
          <template v-if="contextMenuTarget.type === 'table'">
            <a-menu-item class="!text-xs">Table Rename</a-menu-item>
            <a-menu-item class="!text-xs">Table Delete</a-menu-item>
          </template>
          <template v-else>
            <a-menu-item @click="loadTables" class="!text-xs">Tables Refresh</a-menu-item>
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

    <a-modal v-model:visible="settingsDlg" width="max(90vw, 600px)"> Team and settings</a-modal>
    <DlgTableCreate v-model="tableCreateDlg"/>
  </div>
</template>

<style scoped>
.pointer {
  cursor: pointer;
}

.nc-treeview-container {
  height: calc(100vh - var(--header-height));
}

.nc-treeview-footer-item {
  @apply cursor-pointer px-4 py-2 flex align-center hover:bg-gray-200/20 text-xs text-current;
}

:deep(.nc-filter-input input::placeholder) {
  @apply !text-xs;
}
</style>
