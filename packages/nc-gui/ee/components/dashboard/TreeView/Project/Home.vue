<script lang="ts" setup>
import Automation from '../Automation/index.vue'
import Data from '../Data/index.vue'

const sidebarStore = useSidebarStore()

const { activeSidebarTab } = storeToRefs(sidebarStore)

const { isSharedBase } = storeToRefs(useBase())

const workflowStore = useWorkflowStore()

const { openNewWorkflowModal } = workflowStore
const { openNewScriptModal } = useScriptStore()
const { openNewDashboardModal } = useDashboardStore()

const base = inject(ProjectInj)!

const baseRole = inject(ProjectRoleInj)!

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const { isDark } = useTheme()

const projectNodeRef = ref()

const addNewProjectChildEntity = async (showSourceSelector = true) => {
  if (!projectNodeRef.value) return

  projectNodeRef.value?.addNewProjectChildEntity?.(showSourceSelector)
}

const isVisibleCreateNew = ref(false)

const hasTableCreatePermission = computed(() => {
  return isUIAllowed('tableCreate', {
    roles: baseRole.value,
    source: base.value?.sources?.[0],
  })
})
</script>

<template>
  <div v-if="base?.id && !base.isLoading" class="nc-treeview-active-base">
    <div>
      <DashboardSidebarHeaderWrapper>
        <div v-if="isSharedBase" class="flex-1">
          <div
            data-testid="nc-workspace-menu"
            class="flex items-center nc-workspace-menu overflow-hidden py-1.25 pr-0.25 justify-center w-full"
          >
            <a
              class="w-24 min-w-10 transition-all duration-200 p-1 transform"
              href="https://github.com/nocodb/nocodb"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img v-if="isDark" alt="NocoDB" src="~/assets/img/brand/text.png" />
              <img v-else alt="NocoDB" src="~/assets/img/brand/nocodb.png" />
            </a>

            <div class="flex flex-grow"></div>
          </div>
        </div>

        <DashboardTreeViewProjectNode v-else ref="projectNodeRef" is-project-header />
      </DashboardSidebarHeaderWrapper>

      <div v-if="!isSharedBase && activeSidebarTab !== 'settings'" class="nc-project-home-section pt-1 !pb-0.5 flex flex-col gap-2">
        <div v-if="hasTableCreatePermission" class="flex items-center w-full xs:hidden">
          <NcDropdown v-model:visible="isVisibleCreateNew">
            <NcButton
              type="text"
              size="small"
              full-width
              class="nc-home-create-new-btn nc-home-create-new-dropdown-btn !text-nc-content-gray-subtle !hover:(text-nc-content-gray) !xs:hidden !w-full !px-3"
              :class="isVisibleCreateNew ? 'active' : ''"
              data-testid="nc-home-create-new-btn"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="ncPlusCircle" class="!text-nc-content-brand" />

                <div>{{ $t('labels.createNew') }}</div>
              </div>
            </NcButton>

            <template #overlay>
              <DashboardTreeViewProjectCreateNewMenu
                v-model:visible="isVisibleCreateNew"
                @new-table="addNewProjectChildEntity()"
                @empty-script="openNewScriptModal({ baseId: base.id })"
                @empty-workflow="openNewWorkflowModal({ baseId: base.id })"
                @empty-dashboard="openNewDashboardModal({ baseId: base.id })"
              />
            </template>
          </NcDropdown>
        </div>
      </div>
    </div>
    <div class="flex-1 relative overflow-y-auto nc-scrollbar-thin">
      <!-- Data tab -->
      <template v-if="activeSidebarTab === 'data'">
        <Data :base-id="base.id" hide-header />
      </template>

      <!-- Automation/Workflows tab -->
      <template v-else-if="activeSidebarTab === 'workflows'">
        <Automation v-if="!isSharedBase && !isMobileMode" :base-id="base.id" hide-header hide-create-button />
      </template>

      <!-- Agents tab: placeholder -->
      <template v-else-if="activeSidebarTab === 'agents'">
        <div class="flex items-center justify-center h-32 text-nc-content-gray-muted text-bodySm">
          {{ $t('general.comingSoon') }}
        </div>
      </template>

      <!-- Admin panel -->
      <template v-else-if="activeSidebarTab === 'settings'">
        <DashboardTreeViewProjectBaseSettingsMenu v-if="!isSharedBase" />
        <div v-if="!isSharedBase && !isMobileMode" class="mx-3 border-t border-nc-border-gray-medium"></div>
        <DashboardTreeViewProjectWsSettingsMenu />
      </template>
    </div>

    <slot name="footer"> </slot>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-sidebar-header) {
  @apply border-b-1 border-nc-border-gray-medium;
}

:deep(.ant-collapse-header) {
  @apply !mx-0 !pl-2 h-7 !xs:(pl-2 h-[3rem]) !pr-0.5 !py-0 hover:bg-nc-bg-gray-medium xs:(hover:bg-nc-bg-gray-extralight) !rounded-md;

  .ant-collapse-arrow {
    @apply !right-1 !xs:(flex-none border-1 border-nc-border-gray-medium w-6.5 h-6.5 mr-1);
  }
}

:deep(.ant-collapse-item) {
  @apply h-full;
}

:deep(.ant-collapse-header) {
  .nc-sidebar-upgrade-badge {
    @apply -mr-6;

    &.nc-sidebar-option-open {
      @apply mr-0.5;
    }
  }

  &:hover {
    .nc-sidebar-node-btn {
      &:not(.nc-sidebar-upgrade-badge) {
        @apply !opacity-100 !inline-block;
      }

      &.nc-sidebar-upgrade-badge {
        @apply mr-0.5;
      }

      &:not(.nc-sidebar-expand) {
        @apply !xs:hidden;
      }
    }
  }
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-0.25;
}

:deep(.nc-home-create-new-btn.nc-button) {
  &:not(.active) {
    @apply hover:bg-nc-bg-brand;
  }
}
</style>
