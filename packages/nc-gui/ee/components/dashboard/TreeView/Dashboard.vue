<script setup lang="ts">
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'
import DashboardTreeViewDashboardList from './DashboardList.vue'

const props = defineProps<{
  baseId: string
}>()

const baseId = toRef(props, 'baseId')

const { loadDashboards } = useDashboardStore()

const isExpanded = ref(true)

const onExpand = async () => {
  await loadDashboards({ baseId: baseId.value })
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="nc-tree-item nc-automation-node-wrapper nc-project-home-section text-sm select-none w-full nc-base-tree-automation">
    <div v-e="['c:dashboard:toggle-expand']" class="nc-project-home-section-header w-full cursor-pointer" @click.stop="onExpand">
      <div>Dashboards</div>
      <div class="flex-1" />
      <PaymentUpgradeBadge
        :feature="PlanFeatureTypes.FEATURE_DASHBOARD"
        :title="$t('upgrade.upgradeToUseDashboards')"
        :content="
          $t('upgrade.upgradeToUseDashboardsSubtitle', {
            plan: PlanTitles.PLUS,
          })
        "
      />
      <GeneralIcon
        icon="chevronRight"
        class="flex-none text-nc-content-gray-muted nc-sidebar-source-node-btns cursor-pointer transform transition-transform duration-200 text-[20px]"
        :class="{ '!rotate-90': isExpanded }"
      />
    </div>
    <DashboardTreeViewDashboardList v-if="isExpanded" :base-id="baseId!" />
  </div>
</template>
