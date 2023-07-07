<script lang="ts" setup>
import type { ProjectType, TableType } from 'nocodb-sdk'
import { toRef } from '@vue/reactivity'
import { Dropdown, Tooltip, message } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import { useUIPermission } from '~/composables/useUIPermission'

import { useTabs } from '~/store/tab'
import { useNuxtApp } from '#app'
import { ProjectRoleInj } from '~/context'
import { TreeViewFunctions } from '#imports'

const props = withDefaults(
  defineProps<{
    project: ProjectType
    table: TableType
    baseIndex: number
  }>(),
  { baseIndex: 0 },
)

const project = $(toRef(props, 'project'))
const table = $(toRef(props, 'table'))
const baseIndex = $(toRef(props, 'baseIndex'))

const route = useRoute()

const { isUIAllowed } = useUIPermission()

const tabStore = useTabs()
const { updateTab } = tabStore

const { $e, $api } = useNuxtApp()

const { deleteTable } = useTableNew({
  projectId: project.id!,
})

const projectRole = inject(ProjectRoleInj)

const { setMenuContext, openRenameTableDialog, duplicateTable } = inject(TreeViewFunctions)!

// todo: temp
const { projectTables } = storeToRefs(useTablesStore())
const tables = computed(() => projectTables.value.get(project.id!) ?? [])

const openedTableId = computed(() => route.params.viewId)

const icon = (table: TableType) => {
  if (table.type === 'table') {
    return iconMap.table
  }
  if (table.type === 'view') {
    return iconMap.view
  }
}

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

const { isSharedBase } = useProject()

const isMultiBase = computed(() => project.bases && project.bases.length > 1)
</script>

<template>
  <div
    class="nc-tree-item text-sm cursor-pointer group select-none"
    :data-order="table.order"
    :data-id="table.id"
    :data-testid="`tree-view-table-${table.title}`"
    :data-table-id="table.id"
    :class="[
      // todo: table filter
      // { hidden: !filteredTables?.includes(table), active: openedTableId === table.id },
      `nc-project-tree-tbl nc-project-tree-tbl-${table.title}`,
      { active: openedTableId === table.id },
    ]"
  >
    <GeneralTooltip
      class="pl-11 pr-1.5 mb-0.25 rounded-md h-7.1"
      :class="{
        'hover:bg-hover': openedTableId !== table.id,
        'pl-16.75': baseIndex !== 0,
        'pl-10.5': baseIndex === 0,
      }"
      modifier-key="Alt"
    >
      <template #title>{{ table.table_name }}</template>
      <div class="table-context flex items-center gap-1 h-full" @contextmenu="setMenuContext('table', table)">
        <div class="flex w-auto" :data-testid="`tree-view-table-draggable-handle-${table.title}`">
          <component
            :is="isUIAllowed('tableIconCustomisation', false, projectRole) ? Dropdown : 'div'"
            trigger="click"
            destroy-popup-on-hide
            class="flex items-center nc-table-icon"
            @click.stop
          >
            <div class="flex items-center" @click.stop>
              <component :is="isUIAllowed('tableIconCustomisation', false, projectRole) ? Tooltip : 'div'">
                <GeneralEmojiPicker
                  :key="table.meta?.icon"
                  :emoji="table.meta?.icon"
                  size="small"
                  @emoji-selected="setIcon($event, table)"
                >
                  <template #default>
                    <MdiTable
                      class="w-5 !text-gray-500 text-sm"
                      :class="{
                        'group-hover:text-gray-500': isUIAllowed('treeview-drag-n-drop', false, projectRole),
                        '!text-black': openedTableId === table.id,
                      }"
                    />
                  </template>
                </GeneralEmojiPicker>

                <template v-if="isUIAllowed('tableIconCustomisation', false, projectRole)" #title>Change icon</template>
              </component>
            </div>
            <template v-if="isUIAllowed('tableIconCustomisation', false, projectRole)" #overlay>
              <GeneralEmojiPicker
                :key="table.meta?.icon"
                :emoji="table.meta?.icon"
                size="small"
                @emoji-selected="setIcon($event, table)"
              >
                <template #default>
                  <MdiTable
                    class="w-5 !text-gray-500"
                    :class="{
                      'group-hover:text-gray-500': isUIAllowed('treeview-drag-n-drop', false, projectRole),
                      '!text-black': openedTableId === table.id,
                    }"
                  />
                </template>
              </GeneralEmojiPicker>
            </template>
          </component>
        </div>

        <span
          class="nc-tbl-title capitalize text-ellipsis overflow-hidden select-none"
          :class="{
            'text-black !font-semibold': openedTableId === table.id,
          }"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ table.title }}
        </span>
        <div class="flex flex-grow h-full"></div>

        <a-dropdown
          v-if="
            !isSharedBase && (isUIAllowed('table-rename', false, projectRole) || isUIAllowed('table-delete', false, projectRole))
          "
          :trigger="['click']"
          @click.stop
        >
          <MdiDotsHorizontal
            class="min-w-6 transition-opacity opacity-0 group-hover:opacity-100 outline-0"
            :class="{
              '!text-gray-600': openedTableId !== table.id,
            }"
          />

          <template #overlay>
            <a-menu class="!py-0 rounded text-sm">
              <a-menu-item
                v-if="isUIAllowed('table-rename', false, projectRole)"
                @click="openRenameTableDialog(table, project.bases[baseIndex].id)"
              >
                <div class="nc-project-menu-item" :data-testid="`sidebar-table-rename-${table.title}`">
                  {{ $t('general.rename') }}
                </div>
              </a-menu-item>

              <a-menu-item v-if="isUIAllowed('table-duplicate')" @click="duplicateTable(table)">
                <div class="nc-project-menu-item" :data-testid="`sidebar-table-duplicate-${table.title}`">
                  {{ $t('general.duplicate') }}
                </div>
              </a-menu-item>

              <a-menu-item
                v-if="isUIAllowed('table-delete', false, projectRole)"
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
</template>

<style scoped lang="scss">
.nc-tree-item {
  @apply relative cursor-pointer after:(pointer-events-none content-[''] rounded absolute top-0 left-0  w-full h-full right-0 !bg-current transition transition-opactity duration-100 opacity-0);
}

.nc-tree-item svg {
  @apply text-primary text-opacity-60;
}

.nc-tree-item.active {
  @apply !bg-primary-selected rounded-md;
  //@apply border-r-3 border-primary;

  svg {
    @apply !text-opacity-100;
  }
}
</style>
