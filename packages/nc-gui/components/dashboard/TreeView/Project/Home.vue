<script lang="ts" setup>
import Table from '~/components/dashboard/TreeView/Table/index.vue'

const router = useRouter()
const route = router.currentRoute

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isSharedBase } = storeToRefs(useBase())
const { baseUrl } = useBase()

const base = inject(ProjectInj)!

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const { meta: metaKey, control } = useMagicKeys()

const projectNodeRef = ref()

// If only base is open, i.e in case of docs, base view is open and not the page view
const baseViewOpen = computed(() => {
  const routeNameSplit = String(route.value?.name).split('baseId-index-index')
  if (routeNameSplit.length <= 1) return false

  const routeNameAfterProjectView = routeNameSplit[routeNameSplit.length - 1]
  return routeNameAfterProjectView.split('-').length === 2 || routeNameAfterProjectView.split('-').length === 1
})

async function addNewProjectChildEntity(showSourceSelector = true) {
  if (!projectNodeRef.value) return

  projectNodeRef.value?.addNewProjectChildEntity?.(showSourceSelector)
}

const openBaseHomePage = async () => {
  if (isMobileMode.value && isLeftSidebarOpen.value && route.value.name === 'index-typeOrId-baseId-index-index') {
    isLeftSidebarOpen.value = false

    return
  }
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  await navigateTo(
    `${cmdOrCtrl ? '#' : ''}${baseUrl({
      id: base.value.id!,
      type: 'database',
      isSharedBase: isSharedBase.value,
      projectPage: !isUIAllowed('projectOverviewTab') || isMobileMode.value ? 'collaborator' : undefined,
    })}`,
    cmdOrCtrl
      ? {
          open: navigateToBlankTargetOpenOption,
        }
      : undefined,
  )
}

const isVisibleCreateNew = ref(false)

const hasTableCreatePermission = computed(() => {
  return isUIAllowed('tableCreate', { roles: base.value.project_role, source: base.value?.sources?.[0] })
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
              <img alt="NocoDB" src="~/assets/img/brand/nocodb.png" />
            </a>

            <div class="flex flex-grow"></div>
          </div>
        </div>
        <DashboardTreeViewProjectNode v-else ref="projectNodeRef" is-project-header />
      </DashboardSidebarHeaderWrapper>

      <DashboardTreeViewProjectHomeSearchInput placeholder="Search table, view" />

      <div v-if="!isSharedBase" class="nc-project-home-section pt-1 !pb-2 flex flex-col gap-2">
        <div v-if="hasTableCreatePermission" class="flex items-center w-full xs:hidden">
          <NcDropdown v-model:visible="isVisibleCreateNew">
            <NcButton
              type="text"
              size="small"
              full-width
              class="nc-home-create-new-btn nc-home-create-new-dropdown-btn !text-nc-content-brand !hover:(text-nc-content-brand-disabled) !xs:hidden !w-full !px-3"
              :class="isVisibleCreateNew ? 'active' : ''"
              icon-position="right"
              data-testid="nc-home-create-new-btn"
            >
              <template #icon>
                <GeneralIcon icon="chevronDown" class="flex-none" />
              </template>
              <div class="flex items-center gap-2">
                <GeneralIcon icon="ncPlusCircleSolid" />

                <div>{{ $t('labels.createNew') }}</div>
              </div>
            </NcButton>

            <template #overlay>
              <DashboardTreeViewProjectCreateNewMenu
                v-model:visible="isVisibleCreateNew"
                @new-table="addNewProjectChildEntity()"
              />
            </template>
          </NcDropdown>
        </div>
        <NcButton
          v-e="['c:base:home']"
          type="text"
          size="xsmall"
          class="nc-sidebar-top-button !h-8 w-full !pl-0"
          :centered="false"
          :class="{
            '!text-nc-content-brand-disabled !bg-nc-bg-brand !hover:bg-nc-bg-brand': activeProjectId === base.id && baseViewOpen,
            '!hover:(bg-nc-bg-gray-medium text-nc-content-gray-subtle)': !(activeProjectId === base.id && baseViewOpen),
          }"
          data-testid="nc-sidebar-base-overview-btn"
          @click="openBaseHomePage"
        >
          <div
            class="flex items-center gap-2 pl-3 pr-1"
            :class="{
              'font-semibold': activeProjectId === base.id && baseViewOpen,
            }"
          >
            <GeneralIcon icon="home1" class="!h-4 w-4" />
            <div>{{ $t('general.overview') }}</div>
          </div>
        </NcButton>
      </div>
    </div>

    <div class="flex-1 relative overflow-y-auto nc-scrollbar-thin">
      <Table :base-id="base.id" @create-table="addNewProjectChildEntity()" />
    </div>

    <slot name="footer"> </slot>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-collapse-header) {
  @apply !mx-0 !pl-2 h-7 !xs:(pl-2 h-[3rem]) !pr-0.5 !py-0 hover:bg-nc-bg-gray-medium xs:(hover:bg-nc-bg-brand) !rounded-md;

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
  @apply hover:bg-nc-bg-brand !pr-1.5;

  &.active {
    @apply !bg-nc-bg-brand;
  }
}
</style>
