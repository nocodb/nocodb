<script lang="ts" setup>
import type { LayoutType, ProjectType } from 'nocodb-sdk'
import { toRef } from '@vue/reactivity'
import { useUIPermission } from '~/composables/useUIPermission'

import { useNuxtApp } from '#app'
import { ProjectRoleInj } from '~/context'
import { TreeViewFunctions } from '#imports'

const props = defineProps<{
  project: ProjectType
  layout: LayoutType
}>()

const project = $(toRef(props, 'project'))
const layout = $(toRef(props, 'layout'))

const route = useRoute()

const { isUIAllowed } = useUIPermission()

const { $e } = useNuxtApp()

const { deleteLayout } = useDashboardStore()

const projectRole = inject(ProjectRoleInj)

const { setMenuContext } = inject(TreeViewFunctions)!

const openeLayoutId = computed(() => route.params.layoutId)

function openRenameLayoutDialog(layout: LayoutType, rightClick = false) {
  $e(rightClick ? 'c:layout:rename:navdraw:right-click' : 'c:layout:rename:navdraw:options')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgLayoutRename'), {
    'modelValue': isOpen,
    'layout': layout,
    'dashboardProject': project,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const { isSharedBase } = useProject()
</script>

<template>
  <div
    class="nc-tree-item text-sm cursor-pointer group"
    :data-order="layout.order"
    :data-id="layout.id"
    :data-testid="`tree-view-layout-${layout.title}`"
    :class="[`nc-project-tree-tbl nc-project-tree-tbl-${layout.title}`, { active: openeLayoutId === layout.id }]"
  >
    <GeneralTooltip
      class="pl-4 pr-2 mb-0.25 rounded-md h-7.25 select-none"
      :class="{
        '!hover:bg-hover': openeLayoutId !== layout.id,
      }"
      modifier-key="Alt"
    >
      <template #title>{{ layout.title }}</template>
      <div class="layout-context flex items-center gap-2 h-full ml-7.25" @contextmenu="setMenuContext('layout', layout)">
        <MaterialSymbolsSpaceDashboardOutlineRounded class="flex !text-gray-500" />
        <div class="nc-tbl-title flex-1">
          <GeneralTruncateText :key="layout.title" :length="openeLayoutId === layout.id ? 18 : 20"
            >{{ layout.title }}
          </GeneralTruncateText>
        </div>

        <a-dropdown
          v-if="
            !isSharedBase &&
            (isUIAllowed('layout-rename', false, projectRole) || isUIAllowed('layout-delete', false, projectRole))
          "
          :trigger="['click']"
          @click.stop
        >
          <MdiDotsHorizontal
            class="transition-opacity opacity-0 group-hover:opacity-100 outline-0"
            :class="{
              '!text-gray-600': openeLayoutId !== layout.id,
            }"
          />

          <template #overlay>
            <a-menu class="!py-0 rounded text-sm">
              <a-menu-item v-if="isUIAllowed('layout-rename', false, projectRole)" @click="openRenameLayoutDialog(layout)">
                <div class="nc-project-menu-item" :data-testid="`sidebar-layout-rename-${layout.title}`">
                  {{ $t('general.rename') }}
                </div>
              </a-menu-item>

              <a-menu-item
                v-if="isUIAllowed('layout-delete', false, projectRole)"
                :data-testid="`sidebar-layout-delete-${layout.title}`"
                @click="deleteLayout(project, layout)"
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

  svg {
    @apply !text-opacity-100;
  }
}
</style>
