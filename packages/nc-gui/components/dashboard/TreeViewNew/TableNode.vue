<script lang="ts" setup>
import type { ProjectType, TableType } from 'nocodb-sdk'
import { toRef } from '@vue/reactivity'
import { Icon as IconifyIcon } from '@iconify/vue'
import { Dropdown, Tooltip, message } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import { useUIPermission } from '~/composables/useUIPermission'

import MdiView from '~icons/mdi/eye-circle-outline'
import PhTableThin from '~icons/ph/table-thin'
import { useTabs } from '~/store/tab'
import { useNuxtApp } from '#app'
import { ProjectRoleInj } from '~/context'

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
const { activeTab } = storeToRefs(tabStore)
const { $e, $api } = useNuxtApp()

const { deleteTable } = useTable()

const projectRole = inject(ProjectRoleInj)

// todo: temp
const { projectTableList } = storeToRefs(useProjects())

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
    projectTableList.value[project.id!].splice(projectTableList.value[project.id!].indexOf(table), 1, { ...table })

    updateTab({ id: table.id }, { meta: table.meta })

    await $api.dbTable.update(table.id as string, {
      meta: table.meta,
    })

    $e('a:table:icon:navdraw', { icon })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

function openRenameTableDialog(table: TableType, baseId?: string, rightClick = false) {
  $e(rightClick ? 'c:table:rename:navdraw:right-click' : 'c:table:rename:navdraw:options')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableRename'), {
    'modelValue': isOpen,
    'tableMeta': table,
    'baseId': baseId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

// Todo: temp

const { isSharedBase } = useProject()
</script>

<template>
  <div
    v-e="['a:table:open']"
    class="nc-tree-item text-sm cursor-pointer group"
    :data-order="table.order"
    :data-id="table.id"
    :data-testid="`tree-view-table-${table.title}`"
    :class="[
      // todo: table filter
      // { hidden: !filteredTables?.includes(table), active: openedTableId === table.id },
      `nc-project-tree-tbl nc-project-tree-tbl-${table.title}`,
      { active: openedTableId === table.id },
    ]"
  >
    <GeneralTooltip
      class="pl-4 pr-3 py-1.5 mt-0.65 rounded-md"
      :class="{
        'hover:bg-gray-200': openedTableId !== table.id,
      }"
      modifier-key="Alt"
    >
      <template #title>{{ table.table_name }}</template>
      <div class="table-context flex items-center gap-2 h-full" @contextmenu="setMenuContext('table', table)">
        <div class="flex w-auto" :data-testid="`tree-view-table-draggable-handle-${table.title}`">
          <component
            :is="isUIAllowed('tableIconCustomisation', false, projectRole) ? Dropdown : 'div'"
            trigger="click"
            destroy-popup-on-hide
            class="flex items-center"
            @click.stop
          >
            <div class="flex items-center" @click.stop>
              <component :is="isUIAllowed('tableIconCustomisation', false, projectRole) ? Tooltip : 'div'">
                <span v-if="table.meta?.icon" :key="table.meta?.icon" class="nc-table-icon flex items-center">
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
                  :class="{ 'group-hover:text-gray-500': isUIAllowed('treeview-drag-n-drop', false, projectRole) }"
                />

                <template v-if="isUIAllowed('tableIconCustomisation', false, projectRole)" #title>Change icon</template>
              </component>
            </div>
            <template v-if="isUIAllowed('tableIconCustomisation', false, projectRole)" #overlay>
              <GeneralEmojiIcons class="shadow bg-white p-2" @select-icon="setIcon($event, table)" />
            </template>
          </component>
        </div>

        <div class="nc-tbl-title flex-1">
          <GeneralTruncateText :key="table.title" :length="openedTableId === table.id ? 18 : 20"
            >{{ table.title }}
          </GeneralTruncateText>
        </div>

        <a-dropdown
          v-if="
            !isSharedBase && (isUIAllowed('table-rename', false, projectRole) || isUIAllowed('table-delete', false, projectRole))
          "
          :trigger="['click']"
          @click.stop
        >
          <GeneralIcon
            icon="threeDotVertical"
            class="transition-opacity opacity-0 group-hover:opacity-100 outline-0"
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
  @apply mr-2 relative cursor-pointer after:(pointer-events-none content-[''] rounded absolute top-0 left-0  w-full h-full right-0 !bg-current transition transition-opactity duration-100 opacity-0);
}

.nc-tree-item svg {
  @apply text-primary text-opacity-60;
}

.nc-tree-item.active {
  @apply !bg-primary-selected-sidebar font-weight-bold rounded-md;
  //@apply border-r-3 border-primary;

  svg {
    @apply !text-opacity-100;
  }
}
</style>
