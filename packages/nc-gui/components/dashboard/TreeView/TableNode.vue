<script lang="ts" setup>
import type { BaseType, TableType } from 'nocodb-sdk'
import { toRef } from '@vue/reactivity'
import { message } from 'ant-design-vue'
import { storeToRefs } from 'pinia'

import { ProjectRoleInj, TreeViewInj, useNuxtApp, useRoles, useTabs } from '#imports'

const props = withDefaults(
  defineProps<{
    base: BaseType
    table: TableType
    sourceIndex: number
  }>(),
  { sourceIndex: 0 },
)

const base = toRef(props, 'base')
const table = toRef(props, 'table')
const sourceIndex = toRef(props, 'sourceIndex')

const { openTable: _openTable } = useTableNew({
  baseId: base.value.id!,
})

const route = useRoute()

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const tabStore = useTabs()
const { updateTab } = tabStore

const { $e, $api } = useNuxtApp()

useTableNew({
  baseId: base.value.id!,
})

const baseRole = inject(ProjectRoleInj)
provide(SidebarTableInj, table)

const { setMenuContext, openRenameTableDialog, duplicateTable } = inject(TreeViewInj)!

const { loadViews: _loadViews } = useViewsStore()
const { activeView } = storeToRefs(useViewsStore())
const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

// todo: temp
const { baseTables } = storeToRefs(useTablesStore())
const tables = computed(() => baseTables.value.get(base.value.id!) ?? [])

const openedTableId = computed(() => route.params.viewId)

const isTableDeleteDialogVisible = ref(false)

const setIcon = async (icon: string, table: TableType) => {
  try {
    table.meta = {
      ...((table.meta as object) || {}),
      icon,
    }
    tables.value.splice(tables.value.indexOf(table), 1, { ...table })

    updateTab({ id: table.id }, { meta: table.meta })

    await $api.dbTable.update(table.id as string, {
      meta: table.meta,
    })

    $e('a:table:icon:navdraw', { icon })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// Todo: temp

const { isSharedBase } = useBase()
// const isMultiBase = computed(() => base.sources && base.sources.length > 1)

const canUserEditEmote = computed(() => {
  return isUIAllowed('tableIconEdit', { roles: baseRole?.value })
})

const isExpanded = ref(false)
const isLoading = ref(false)

const onExpand = async () => {
  if (isExpanded.value) {
    isExpanded.value = false
    return
  }

  isLoading.value = true
  try {
    await _loadViews({ tableId: table.value.id, ignoreLoading: true })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
    isExpanded.value = true
  }
}

const onOpenTable = async () => {
  isLoading.value = true
  try {
    await _openTable(table.value)

    if (isMobileMode.value) {
      isLeftSidebarOpen.value = false
    }
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
    isExpanded.value = true
  }
}

watch(
  () => activeView.value?.id,
  () => {
    if (!activeView.value) return

    if (activeView.value?.fk_model_id === table.value?.id) {
      isExpanded.value = true
    }
  },
  {
    immediate: true,
  },
)

const isTableOpened = computed(() => {
  return openedTableId.value === table.value?.id && activeView.value?.is_default
})
</script>

<template>
  <div
    class="nc-tree-item nc-table-node-wrapper text-sm select-none w-full"
    :data-order="table.order"
    :data-id="table.id"
    :data-table-id="table.id"
    :class="[`nc-base-tree-tbl nc-base-tree-tbl-${table.title}`]"
    :data-active="openedTableId === table.id"
  >
    <GeneralTooltip
      class="nc-tree-item-inner nc-sidebar-node pl-11 pr-0.75 mb-0.25 rounded-md h-7.1 w-full group cursor-pointer hover:bg-gray-200"
      :class="{
        'hover:bg-gray-200': openedTableId !== table.id,
        'pl-12 xs:(pl-14)': sourceIndex !== 0,
        'pl-6.5': sourceIndex === 0,
        '!bg-primary-selected': isTableOpened,
      }"
      modifier-key="Alt"
    >
      <template #title>{{ table.table_name }}</template>
      <div
        v-e="['a:table:open']"
        class="table-context flex items-center gap-1 h-full"
        :data-testid="`nc-tbl-side-node-${table.title}`"
        @contextmenu="setMenuContext('table', table)"
        @click="onOpenTable"
      >
        <div class="flex flex-row h-full items-center">
          <NcButton
            v-e="['c:table:toggle-expand']"
            type="text"
            size="xxsmall"
            class="nc-sidebar-node-btn nc-sidebar-expand"
            @click.stop="onExpand"
          >
            <GeneralIcon
              icon="triangleFill"
              class="nc-sidebar-source-node-btns group-hover:visible invisible cursor-pointer transform transition-transform duration-500 h-1.5 w-1.5 !text-gray-600 rotate-90"
              :class="{ '!rotate-180': isExpanded }"
            />
          </NcButton>
          <div class="flex w-auto" :data-testid="`tree-view-table-draggable-handle-${table.title}`">
            <div
              class="flex items-center nc-table-icon"
              :class="{
                'pointer-events-none': !canUserEditEmote,
              }"
              @click.stop
            >
              <LazyGeneralEmojiPicker
                :key="table.meta?.icon"
                v-e="['c:table:emoji-picker']"
                :emoji="table.meta?.icon"
                size="small"
                :readonly="!canUserEditEmote || isMobileMode"
                @emoji-selected="setIcon($event, table)"
              >
                <template #default>
                  <NcTooltip class="flex" placement="topLeft" hide-on-click :disabled="!canUserEditEmote">
                    <template #title>
                      {{ $t('general.changeIcon') }}
                    </template>

                    <component
                      :is="iconMap.table"
                      v-if="table.type === 'table'"
                      class="flex w-5 !text-gray-500 text-sm"
                      :class="{
                        'group-hover:text-gray-500': isUIAllowed('tableSort', { roles: baseRole }),
                        '!text-black': openedTableId === table.id,
                      }"
                    />

                    <MdiEye
                      v-else
                      class="flex w-5 !text-gray-500 text-sm"
                      :class="{
                        'group-hover:text-gray-500': isUIAllowed('tableSort', { roles: baseRole }),
                        '!text-black': openedTableId === table.id,
                      }"
                    />
                  </NcTooltip>
                </template>
              </LazyGeneralEmojiPicker>
            </div>
          </div>
        </div>

        <span
          class="nc-tbl-title nc-sidebar-node-title text-ellipsis overflow-hidden select-none"
          :class="{
            'text-black !font-medium': isTableOpened,
          }"
          :data-testid="`nc-tbl-title-${table.title}`"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ table.title }}
        </span>
        <div class="flex flex-grow h-full"></div>
        <div class="flex flex-row items-center">
          <NcDropdown
            v-if="
              !isSharedBase &&
              (isUIAllowed('tableRename', { roles: baseRole }) || isUIAllowed('tableDelete', { roles: baseRole }))
            "
            v-e="['c:table:option']"
            :trigger="['click']"
            class="nc-sidebar-node-btn"
            @click.stop
          >
            <MdiDotsHorizontal
              data-testid="nc-sidebar-table-context-menu"
              class="min-w-5.75 min-h-5.75 mt-0.2 mr-0.25 px-0.5 !text-gray-600 transition-opacity opacity-0 group-hover:opacity-100 nc-tbl-context-menu outline-0 rounded-md hover:(bg-gray-500 bg-opacity-15 !text-black)"
            />

            <template #overlay>
              <NcMenu>
                <NcMenuItem
                  v-if="isUIAllowed('tableRename', { roles: baseRole })"
                  v-e="['c:table:rename']"
                  :data-testid="`sidebar-table-rename-${table.title}`"
                  @click="openRenameTableDialog(table, base.sources[sourceIndex].id)"
                >
                  <GeneralIcon icon="edit" class="text-gray-700" />
                  {{ $t('general.rename') }}
                </NcMenuItem>

                <NcMenuItem
                  v-if="
                    isUIAllowed('tableDuplicate') &&
                    base.sources?.[sourceIndex] &&
                    (base.sources[sourceIndex].is_meta || base.sources[sourceIndex].is_local)
                  "
                  v-e="['c:table:duplicate']"
                  :data-testid="`sidebar-table-duplicate-${table.title}`"
                  @click="duplicateTable(table)"
                >
                  <GeneralIcon icon="duplicate" class="text-gray-700" />
                  {{ $t('general.duplicate') }}
                </NcMenuItem>

                <NcMenuItem
                  v-if="isUIAllowed('tableDelete', { roles: baseRole })"
                  v-e="['c:table:delete']"
                  :data-testid="`sidebar-table-delete-${table.title}`"
                  class="!text-red-500 !hover:bg-red-50"
                  @click="isTableDeleteDialogVisible = true"
                >
                  <GeneralIcon icon="delete" />
                  {{ $t('general.delete') }}
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
        </div>
      </div>
      <DlgTableDelete
        v-if="table.id && base?.id"
        v-model:visible="isTableDeleteDialogVisible"
        :table-id="table.id"
        :base-id="base.id"
      />
    </GeneralTooltip>
    <DashboardTreeViewViewsList v-if="isExpanded" :table-id="table.id" :base-id="base.id" />
  </div>
</template>

<style scoped lang="scss">
.nc-tree-item {
  @apply relative after:(pointer-events-none content-[''] rounded absolute top-0 left-0  w-full h-full right-0 !bg-current transition duration-100 opacity-0);
}

.nc-tree-item svg {
  @apply text-primary text-opacity-60;
}
</style>
