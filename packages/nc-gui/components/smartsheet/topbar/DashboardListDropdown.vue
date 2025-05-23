<script setup lang="ts">
import type { DashboardType } from 'nocodb-sdk'

const { $e } = useNuxtApp()

const { ncNavigateTo, isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { base } = storeToRefs(useBase())

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const dashboardStore = useDashboardStore()

const { openDashboard, loadDashboards } = dashboardStore

const { activeDashboard, activeBaseDashboards } = storeToRefs(dashboardStore)

const isOpen = ref<boolean>(false)

/**
 * Handles navigation to a selected dashboard.
 *
 * @param dashboard - The dashboard to navigate to.
 *
 * @remarks
 * This function is called when a user selects a dashboard from the dropdown list.
 * It checks if the dashboard has a valid ID and then opens the selected dashboard.
 */
const handleNavigateToDashboard = (dashboard: DashboardType) => {
  if (dashboard?.id) {
    openDashboard(dashboard)
  }
}

function openDashboardCreateDialog() {
  $e('c:dashboard:create:topbar')

  isOpen.value = false

  const isCreateDashboardOpen = ref(true)

  if (!base.value?.id) return

  const { close } = useDialog(resolveComponent('DlgDashboardCreate'), {
    modelValue: isCreateDashboardOpen,
    baseId: base.value!.id,
    onCreated: closeDialog,
  })

  async function closeDialog(dashboard?: DashboardType) {
    isCreateDashboardOpen.value = false

    await loadDashboards({ baseId: base.value!.id, force: true })

    ncNavigateTo({
      workspaceId: activeWorkspaceId.value,
      baseId: base.value.id,
      dashboardId: dashboard.id,
    })

    if (!dashboard) return

    // TODO: Better way to know when the dashboard node dom is available
    setTimeout(() => {
      const newDashboardDom = document.querySelector(`[data-dashboard-id="${dashboard.id}"]`)
      if (!newDashboardDom) return

      // Scroll to the dashboard node
      newDashboardDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 1000)

    close(1000)
  }
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen">
    <slot name="default" :is-open="isOpen"></slot>
    <template #overlay>
      <LazyNcList
        v-model:open="isOpen"
        :value="activeDashboard.id"
        :list="activeBaseDashboards"
        option-value-key="id"
        option-label-key="title"
        search-input-placeholder="Search dashboards"
        @change="handleNavigateToDashboard"
      >
        <template #listItem="{ option }">
          <div>
            <LazyGeneralEmojiPicker :emoji="option?.meta?.icon" readonly size="xsmall">
              <template #default>
                <GeneralIcon icon="ncBarChart2" class="min-w-4 !text-gray-500" />
              </template>
            </LazyGeneralEmojiPicker>
          </div>
          <NcTooltip class="truncate flex-1" show-on-truncate-only>
            <template #title>
              {{ option?.title }}
            </template>
            {{ option?.title }}
          </NcTooltip>
          <GeneralIcon
            v-if="option.id === activeDashboard.id"
            id="nc-selected-item-icon"
            icon="check"
            class="flex-none text-primary w-4 h-4"
          />
        </template>

        <template v-if="!isMobileMode && isUIAllowed('dashboardCreate')" #listFooter>
          <NcDivider class="!mt-0 !mb-2" />
          <div class="px-2 mb-2" @click="openDashboardCreateDialog()">
            <div
              class="px-2 py-1.5 flex items-center justify-between gap-2 text-sm font-weight-500 !text-brand-500 hover:bg-gray-100 rounded-md cursor-pointer"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="plus" />
                <div>
                  {{
                    $t('general.createEntity', {
                      entity: $t('objects.dashboard'),
                    })
                  }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </LazyNcList>
    </template>
  </NcDropdown>
</template>
