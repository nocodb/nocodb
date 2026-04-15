<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const emits = defineEmits<{
  (event: 'close'): void
}>()

const { getPlanTitle, blockViewSections } = useEeConfig()

const { isUIAllowed } = useRoles()

const { $e } = useNuxtApp()

const { t } = useI18n()

const table = inject(SidebarTableInj)!

const viewSectionsStore = useViewSectionsStore()

const viewsStore = useViewsStore()

const { views } = storeToRefs(viewsStore)

const canCreateSection = computed(() => isUIAllowed('sectionCreateOrEdit'))

const tooltipTitle = computed(() =>
  canCreateSection.value ? t('tooltip.organizeViewsIntoSections') : t('tooltip.onlyCreatorsCanManageSections'),
)

async function onCreateSection() {
  if (!table.value.id || !table.value.base_id) return

  const topLevelViewOrders = views.value.filter((v) => !v.fk_view_section_id).map((v) => v.order || 0)

  const section = await viewSectionsStore.createSectionForTable(table.value.base_id, table.value.id, topLevelViewOrders)

  if (section) {
    $e('a:view-section:create')
  }
}
</script>

<template>
  <NcTooltip :title="tooltipTitle" placement="right" class="w-full">
    <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_VIEW_SECTIONS">
      <template #default="{ click }">
        <NcMenuItem
          data-testid="sidebar-view-create-section"
          inner-class="w-full"
          :disabled="!canCreateSection"
          @click="
            () => {
              if (!canCreateSection) return
              emits('close')
              click(PlanFeatureTypes.FEATURE_VIEW_SECTIONS, () => onCreateSection())
            }
          "
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
                show-as-lock
              />
              <GeneralIcon v-if="!blockViewSections && canCreateSection" class="plus" icon="plus" />
            </div>
          </div>
        </NcMenuItem>
      </template>
    </PaymentUpgradeBadgeProvider>
  </NcTooltip>
</template>
