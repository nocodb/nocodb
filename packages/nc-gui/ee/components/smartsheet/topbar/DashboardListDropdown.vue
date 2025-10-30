<script setup lang="ts">
import type { DashboardType } from 'nocodb-sdk'

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { base } = storeToRefs(useBase())

const dashboardStore = useDashboardStore()

const { openDashboard, openNewDashboardModal } = dashboardStore

const { activeBaseDashboards, activeDashboardId } = storeToRefs(dashboardStore)

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
  isOpen.value = false

  openNewDashboardModal({
    baseId: base.value?.id,
    e: 'c:dashboard:create:topbar',
    loadBasesOnClose: true,
    scrollOnCreate: true,
  })
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen" v-e="['c:dashboard:dropdown:open']">
    <slot name="default" :is-open="isOpen"></slot>
    <template #overlay>
      <LazyNcList
        v-model:open="isOpen"
        v-e="['c:dashboard:open']"
        :value="activeDashboardId"
        :list="activeBaseDashboards"
        option-value-key="id"
        option-label-key="title"
        class="min-w-63.5 !w-auto"
        search-input-placeholder="Search dashboards"
        variant="medium"
        @change="handleNavigateToDashboard"
      >
        <template #listItem="{ option }">
          <div>
            <LazyGeneralEmojiPicker :emoji="option?.meta?.icon" readonly size="xsmall">
              <template #default>
                <GeneralIcon icon="dashboards" class="min-w-4 !text-nc-content-gray-muted" />
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
            v-if="option.id === activeDashboardId"
            id="nc-selected-item-icon"
            icon="check"
            class="flex-none text-primary w-4 h-4"
          />
        </template>

        <template v-if="!isMobileMode && isUIAllowed('dashboardCreate')" #listFooter>
          <NcDivider class="!mt-0 !mb-2" />
          <div class="px-2 mb-2" @click="openDashboardCreateDialog()">
            <div
              class="px-2 py-1.5 flex items-center justify-between gap-2 text-sm font-weight-500 !text-nc-content-brand hover:bg-nc-bg-gray-light rounded-md cursor-pointer"
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
