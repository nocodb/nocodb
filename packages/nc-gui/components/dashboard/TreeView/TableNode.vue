<script lang="ts" setup>
import type { ProjectType, TableType } from 'nocodb-sdk'
import { toRef } from '@vue/reactivity'
import { message } from 'ant-design-vue'
import { storeToRefs } from 'pinia'

import { useNuxtApp } from '#app'
import { ProjectRoleInj, TreeViewInj, useTabs, useUIPermission } from '#imports'

const props = withDefaults(
  defineProps<{
    project: ProjectType
    table: TableType
    baseIndex: number
  }>(),
  { baseIndex: 0 },
)

const project = toRef(props, 'project')
const table = toRef(props, 'table')
const baseIndex = toRef(props, 'baseIndex')

const route = useRoute()

const { isUIAllowed } = useUIPermission()

const tabStore = useTabs()
const { updateTab } = tabStore

const { $e, $api } = useNuxtApp()

useTableNew({
  projectId: project.value.id!,
})

const projectRole = inject(ProjectRoleInj)

const { setMenuContext, openRenameTableDialog, duplicateTable } = inject(TreeViewInj)!

// todo: temp
const { projectTables } = storeToRefs(useTablesStore())
const tables = computed(() => projectTables.value.get(project.value.id!) ?? [])

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

const { isSharedBase } = useProject()
// const isMultiBase = computed(() => project.bases && project.bases.length > 1)

const canUserEditEmote = computed(() => {
  return isUIAllowed('tableIconCustomisation', false, projectRole?.value)
})
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
      class="pl-11 pr-0.75 mb-0.25 rounded-md h-7.1"
      :class="{
        'hover:bg-gray-200': openedTableId !== table.id,
        'pl-17.75': baseIndex !== 0,
        'pl-12.25': baseIndex === 0,
      }"
      modifier-key="Alt"
    >
      <template #title>{{ table.table_name }}</template>
      <div class="table-context flex items-center gap-1 h-full" @contextmenu="setMenuContext('table', table)">
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
              :emoji="table.meta?.icon"
              size="small"
              :readonly="!canUserEditEmote"
              @emoji-selected="setIcon($event, table)"
            >
              <template #default>
                <NcTooltip class="flex" placement="topLeft" hide-on-click :disabled="!canUserEditEmote">
                  <template #title>
                    {{ 'Change icon' }}
                  </template>

                  <MdiTable
                    v-if="table.type === 'table'"
                    class="flex w-5 !text-gray-500 text-sm"
                    :class="{
                      'group-hover:text-gray-500': isUIAllowed('treeview-drag-n-drop', false, projectRole),
                      '!text-black': openedTableId === table.id,
                    }"
                  />
                  <MdiEye
                    v-else
                    class="flex w-5 !text-gray-500 text-sm"
                    :class="{
                      'group-hover:text-gray-500': isUIAllowed('treeview-drag-n-drop', false, projectRole),
                      '!text-black': openedTableId === table.id,
                    }"
                  />
                </NcTooltip>
              </template>
            </LazyGeneralEmojiPicker>
          </div>
        </div>

        <span
          class="nc-tbl-title capitalize text-ellipsis overflow-hidden select-none"
          :class="{
            'text-black !font-semibold': openedTableId === table.id,
          }"
          :data-testid="`nc-tbl-title-${table.title}`"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ table.title }}
        </span>
        <div class="flex flex-grow h-full"></div>

        <NcDropdown
          v-if="
            !isSharedBase && (isUIAllowed('table-rename', false, projectRole) || isUIAllowed('table-delete', false, projectRole))
          "
          :trigger="['click']"
          @click.stop
        >
          <MdiDotsHorizontal
            class="min-w-5.75 min-h-5.75 mt-0.2 mr-0.25 px-0.5 transition-opacity opacity-0 group-hover:opacity-100 nc-tbl-context-menu outline-0 rounded-md hover:(bg-gray-500 bg-opacity-15 !text-black)"
            :class="{
              '!text-gray-600': openedTableId !== table.id,
              '!text-black': openedTableId === table.id,
            }"
          />

          <template #overlay>
            <NcMenu>
              <NcMenuItem
                v-if="isUIAllowed('table-rename', false, projectRole)"
                :data-testid="`sidebar-table-rename-${table.title}`"
                @click="openRenameTableDialog(table, project.bases[baseIndex].id)"
              >
                <GeneralIcon icon="edit" class="text-gray-700" />
                {{ $t('general.rename') }}
              </NcMenuItem>

              <NcMenuItem
                v-if="
                  isUIAllowed('table-duplicate') &&
                  project.bases?.[baseIndex] &&
                  (project.bases[baseIndex].is_meta || project.bases[baseIndex].is_local)
                "
                :data-testid="`sidebar-table-duplicate-${table.title}`"
                @click="duplicateTable(table)"
              >
                <GeneralIcon icon="duplicate" class="text-gray-700" />
                {{ $t('general.duplicate') }}
              </NcMenuItem>

              <NcMenuItem
                v-if="isUIAllowed('table-delete', false, projectRole)"
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
      <DlgTableDelete
        v-if="table.id && project?.id"
        v-model:visible="isTableDeleteDialogVisible"
        :table-id="table.id"
        :project-id="project.id"
      />
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
