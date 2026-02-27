<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const emits = defineEmits<{
  (event: 'createSection'): void
}>()

const { getPlanTitle, blockViewSections } = useEeConfig()
</script>

<template>
  <NcTooltip :title="$t('tooltip.organizeViewsIntoSections')" placement="right">
    <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_VIEW_SECTIONS">
      <template #default="{ click }">
        <NcMenuItem
          data-testid="sidebar-view-create-section"
          inner-class="w-full"
          @click="click(PlanFeatureTypes.FEATURE_VIEW_SECTIONS, () => emits('createSection'))"
        >
          <div class="item">
            <div class="item-inner">
              <GeneralIcon icon="ncFolderOpen" class="!w-4 !h-4" style="color: #3f8292" />
              <div>{{ $t('objects.section') }}</div>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
              <LazyPaymentUpgradeBadge
                :feature="PlanFeatureTypes.FEATURE_VIEW_SECTIONS"
                :plan-title="PlanTitles.BUSINESS"
                :limit-or-feature="PlanFeatureTypes.FEATURE_VIEW_SECTIONS"
                :content="
                  $t('upgrade.upgradeToAccessViewSectionsSubtitle', {
                    plan: getPlanTitle(PlanTitles.BUSINESS),
                  })
                "
              />
              <GeneralIcon v-if="!blockViewSections" class="plus" icon="plus" />
            </div>
          </div>
        </NcMenuItem>
      </template>
    </PaymentUpgradeBadgeProvider>
  </NcTooltip>
</template>
