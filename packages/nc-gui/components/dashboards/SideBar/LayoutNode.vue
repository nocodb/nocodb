<script lang="ts" setup>
import type { LayoutType, ProjectType } from 'nocodb-sdk'
import { toRef } from '@vue/reactivity'
import { useUIPermission } from '~/composables/useUIPermission'

import { useNuxtApp } from '#app'
import { ProjectRoleInj } from '~/context'
import { TreeViewSetMenuContextInj } from '#imports'

const props = withDefaults(
  defineProps<{
    project: ProjectType
    layout: LayoutType
    baseIndex: number
  }>(),
  { baseIndex: 0 },
)

const project = $(toRef(props, 'project'))
const layout = $(toRef(props, 'layout'))
const baseIndex = $(toRef(props, 'baseIndex'))

const route = useRoute()

const { isUIAllowed } = useUIPermission()

const { $e, $api } = useNuxtApp()

// const { deleteTable } = useTableNew({
//   projectId: project.id!,
// })

const projectRole = inject(ProjectRoleInj)

const setMenuContext = inject(TreeViewSetMenuContextInj)!

const openeLayoutId = computed(() => route.params.layoutId)

function openRenameLayoutDialog(layout: LayoutType, baseId?: string, rightClick = false) {
  $e(rightClick ? 'c:table:rename:navdraw:right-click' : 'c:table:rename:navdraw:options')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableRename'), {
    'modelValue': isOpen,
    'tableMeta': layout,
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
    class="nc-tree-item text-sm cursor-pointer group"
    :data-order="layout.order"
    :data-id="layout.id"
    :data-testid="`tree-view-table-${layout.title}`"
    :class="[
      // todo: table filter
      // { hidden: !filteredTables?.includes(table), active: openedTableId === table.id },
      `nc-project-tree-tbl nc-project-tree-tbl-${layout.title}`,
      { active: openeLayoutId === layout.id },
    ]"
  >
    <GeneralTooltip
      class="pl-4 pr-3 py-1.5 mt-0.65 rounded-md"
      :class="{
        'hover:bg-gray-200': openeLayoutId !== layout.id,
      }"
      modifier-key="Alt"
    >
      <template #title>{{ layout.title }}</template>
      <div class="table-context flex items-center gap-2 h-full" @contextmenu="setMenuContext('table', layout)">
        <div class="nc-tbl-title flex-1">
          <GeneralTruncateText :key="layout.title" :length="openeLayoutId === layout.id ? 18 : 20"
            >{{ layout.title }}
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
              '!text-gray-600': openeLayoutId !== layout.id,
            }"
          />

          <template #overlay>
            <a-menu class="!py-0 rounded text-sm">
              <a-menu-item
                v-if="isUIAllowed('table-rename', false, projectRole)"
                @click="openRenameLayoutDialog(layout, project.bases[baseIndex].id)"
              >
                <div class="nc-project-menu-item" :data-testid="`sidebar-table-rename-${layout.title}`">
                  {{ $t('general.rename') }}
                </div>
              </a-menu-item>

              <a-menu-item
                v-if="isUIAllowed('table-delete', false, projectRole)"
                :data-testid="`sidebar-table-delete-${layout.title}`"
                @click="deleteTable(layout)"
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
