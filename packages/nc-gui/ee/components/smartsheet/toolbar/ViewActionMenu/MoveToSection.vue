<script lang="ts" setup>
import type { TableType, ViewType } from 'nocodb-sdk'
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

interface Props {
  view: ViewType
  table: TableType
  inSidebar?: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['closeModal'])

const { view, table } = toRefs(props)

const { $e } = useNuxtApp()

const { getPlanTitle } = useEeConfig()

const viewsStore = useViewsStore()

const { updateView } = viewsStore

const viewSectionsStore = useViewSectionsStore()

const sections = computed(() => {
  if (!table.value.base_id || !table.value.id) return []
  return viewSectionsStore.getSections(table.value.base_id, table.value.id)
})

const currentSectionId = computed(() => view.value?.fk_view_section_id || null)

async function onMoveToSection(sectionId: string | null) {
  if (!view.value?.id) return

  try {
    await updateView(view.value.id, {
      fk_view_section_id: sectionId,
    } as Partial<ViewType>)

    viewSectionsStore.requestSectionExpand(sectionId ?? DEFAULT_SECTION_ID)

    $e('a:view:move-to-section', { sectionId })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  emits('closeModal')
}

async function onMoveToNewSection() {
  if (!view.value?.id || !table.value?.id || !table.value?.base_id) return

  try {
    const section = await viewSectionsStore.createSectionForTable(table.value.base_id, table.value.id, [view.value.order || 0])

    if (section?.id) {
      await updateView(view.value.id, {
        fk_view_section_id: section.id,
      } as Partial<ViewType>)

      $e('a:view:move-to-new-section')
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  emits('closeModal')
}
</script>

<template>
  <PaymentUpgradeBadgeProvider v-if="inSidebar" :feature="PlanFeatureTypes.FEATURE_VIEW_SECTIONS">
    <template #default="{ click }">
      <NcSubMenu key="move-to-section" variant="small">
        <template #title>
          <div class="nc-base-menu-item group w-full flex items-center">
            <GeneralIcon icon="ncArrowRight" class="opacity-80" />
            <span class="flex-1">{{ $t('labels.moveTo') }}</span>
            <LazyPaymentUpgradeBadge
              :feature="PlanFeatureTypes.FEATURE_VIEW_SECTIONS"
              :plan-title="PlanTitles.BUSINESS"
              :limit-or-feature="PlanFeatureTypes.FEATURE_VIEW_SECTIONS"
              :content="
                $t('upgrade.upgradeToAccessViewSectionsSubtitle', {
                  plan: getPlanTitle(PlanTitles.BUSINESS),
                })
              "
              :on-click-callback="() => emits('closeModal')"
            />
          </div>
        </template>

        <!-- Existing sections -->
        <template v-if="sections.length > 0">
          <NcMenuItem
            v-for="section in sections"
            :key="section.id"
            @click="click(PlanFeatureTypes.FEATURE_VIEW_SECTIONS, () => onMoveToSection(section.id || null))"
          >
            <GeneralIcon
              icon="ncFolderOpen"
              class="opacity-80"
              :style="{ color: parseProp(section.meta)?.iconColor || '#3f8292' }"
            />
            {{ section.title }}
          </NcMenuItem>
          <NcDivider class="!my-1" />
        </template>

        <!-- New section -->
        <NcMenuItem @click="click(PlanFeatureTypes.FEATURE_VIEW_SECTIONS, () => onMoveToNewSection())">
          <GeneralIcon icon="plus" class="opacity-80" />
          {{ $t('labels.newSection') }}
        </NcMenuItem>

        <!-- Remove from section (only if view is in a section) -->
        <NcMenuItem v-if="currentSectionId" @click="click(PlanFeatureTypes.FEATURE_VIEW_SECTIONS, () => onMoveToSection(null))">
          <GeneralIcon icon="minus" class="opacity-80" />
          {{ $t('labels.removeFromSection') }}
        </NcMenuItem>
      </NcSubMenu>
    </template>
  </PaymentUpgradeBadgeProvider>
</template>

<style lang="scss" scoped>
.nc-base-menu-item {
  @apply !py-0;
}
</style>
