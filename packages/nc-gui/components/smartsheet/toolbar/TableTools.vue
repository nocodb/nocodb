<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'
import type { ViewPageType } from '~/lib/types'

// Table-scoped configuration surfaces, consolidated under a single icon-only
// "Tools" toolbar entry, deliberately separate from the view-scoped 3-dot menu.
// Every item opens the Tools shell modal (components/smartsheet/Details.vue) at
// the matching route slug; the shell's rail then switches among tools in place.

const { isUIAllowed } = useRoles()

const { onViewsTabChange } = useViewsStore()

const { isSqlView } = useSmartsheetStoreOrThrow()

const { showEEFeatures, isEEFeatureBlocked } = useEeConfig()

const isPublic = inject(IsPublicInj, ref(false))

const { isSharedBase } = storeToRefs(useBase())

const { isMobileMode } = useGlobal()

const isOpen = ref(false)

// Hidden on public/shared views (no schema editing) and on mobile, matching the
// old Data | Details toggle's gating. Mounted across the grid/gallery/kanban/
// calendar/list toolbar plus the timeline/gantt toolbars, so the gate lives here.
const isVisible = computed(() => !isPublic.value && !isSharedBase.value && !isMobileMode.value)

// Per-tool visibility gates — kept in lockstep with the shell (Details.vue).
const showFieldsAction = computed(() => isUIAllowed('fieldAdd') && !isSqlView.value)

const showWebhooksAction = computed(() => isUIAllowed('hookList') && !isSqlView.value)

const showPermissionsAction = computed(() => isEeUI && isUIAllowed('tablePermission') && !isSqlView.value && showEEFeatures.value)

const showRlsAction = computed(() => isEeUI && isUIAllowed('rlsManage') && !isSqlView.value && showEEFeatures.value)

const showDateDependencyAction = computed(
  () => isEeUI && isUIAllowed('dateDependencyManage') && !isSqlView.value && showEEFeatures.value,
)

const showRecordTemplatesAction = computed(() => isEeUI && showEEFeatures.value)

const showAccessSection = computed(() => showPermissionsAction.value || showRlsAction.value)

const showRecordsSection = computed(() => showRecordTemplatesAction.value || showDateDependencyAction.value)

const openTool = (slug: ViewPageType) => {
  isOpen.value = false
  onViewsTabChange(slug)
}
</script>

<template>
  <NcDropdown v-if="isVisible" v-model:visible="isOpen" overlay-class-name="nc-dropdown-table-tools">
    <NcTooltip :title="$t('general.tools')" placement="bottom">
      <NcButton
        v-e="['c:table:tools']"
        class="nc-table-tools-btn nc-toolbar-btn !border-0 !h-7 !px-1.5 !min-w-7"
        size="small"
        type="text"
        data-testid="nc-table-tools-btn"
        :class="{ '!bg-nc-bg-gray-medium': isOpen }"
      >
        <GeneralIcon icon="ncSliders" class="!h-4 !w-4" />
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <NcMenu class="!min-w-70 nc-table-tools-menu" data-id="table-tools">
        <!-- Structure -->
        <NcMenuItem v-if="showFieldsAction" v-e="['c:table:fields']" @click="openTool('field')">
          <GeneralIcon icon="ncList" class="opacity-80" />
          {{ $t('general.manageFields') }}
        </NcMenuItem>
        <NcMenuItem v-e="['c:table:relations']" @click="openTool('relation')">
          <GeneralIcon icon="ncErd" class="opacity-80" />
          {{ $t('title.relations') }}
        </NcMenuItem>

        <!-- Access & security -->
        <template v-if="showAccessSection">
          <NcDivider />
          <PaymentUpgradeBadgeProvider
            v-if="showPermissionsAction"
            :feature="PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS"
          >
            <template #default="{ click }">
              <NcMenuItem
                inner-class="w-full"
                @click="click(PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS, () => openTool('permissions'))"
              >
                <div v-e="['c:table:permissions']" class="flex items-center gap-2 w-full">
                  <GeneralIcon icon="ncLock" class="opacity-80" />
                  <span class="flex-1 truncate">{{ $t('upgrade.features.permissions') }}</span>
                  <LazyPaymentUpgradeBadge
                    :feature="PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS"
                    :feature-enabled-callback="() => !isEEFeatureBlocked"
                    :title="$t('upgrade.upgradeToUseTableAndFieldPermissions')"
                    :content="$t('upgrade.upgradeToUseTableAndFieldPermissionsSubtitle', { plan: PlanTitles.PLUS })"
                    :on-click-callback="() => (isOpen = false)"
                    show-as-lock
                  />
                </div>
              </NcMenuItem>
            </template>
          </PaymentUpgradeBadgeProvider>
          <PaymentUpgradeBadgeProvider v-if="showRlsAction" :feature="PlanFeatureTypes.FEATURE_RLS">
            <template #default="{ click }">
              <NcMenuItem inner-class="w-full" @click="click(PlanFeatureTypes.FEATURE_RLS, () => openTool('rls'))">
                <div v-e="['c:table:rls']" class="flex items-center gap-2 w-full">
                  <GeneralIcon icon="ncShield" class="opacity-80" />
                  <span class="flex-1 truncate">{{ $t('objects.permissions.rlsPolicy.rowLevelSecurity') }}</span>
                  <LazyPaymentUpgradeBadge
                    :feature="PlanFeatureTypes.FEATURE_RLS"
                    :feature-enabled-callback="() => !isEEFeatureBlocked"
                    :title="$t('upgrade.upgradeToUseRls')"
                    :content="$t('upgrade.upgradeToUseRlsSubtitle', { plan: PlanTitles.ENTERPRISE })"
                    :on-click-callback="() => (isOpen = false)"
                    show-as-lock
                  />
                </div>
              </NcMenuItem>
            </template>
          </PaymentUpgradeBadgeProvider>
        </template>

        <!-- Records -->
        <template v-if="showRecordsSection">
          <NcDivider />
          <PaymentUpgradeBadgeProvider v-if="showRecordTemplatesAction" :feature="PlanFeatureTypes.FEATURE_RECORD_TEMPLATES">
            <template #default="{ click }">
              <NcMenuItem
                inner-class="w-full"
                @click="click(PlanFeatureTypes.FEATURE_RECORD_TEMPLATES, () => openTool('templates'))"
              >
                <div v-e="['c:table:record-templates']" class="flex items-center gap-2 w-full">
                  <GeneralIcon icon="ncClipboard" class="opacity-80" />
                  <span class="flex-1 truncate">{{ $t('objects.recordTemplates') }}</span>
                  <LazyPaymentUpgradeBadge
                    :feature="PlanFeatureTypes.FEATURE_RECORD_TEMPLATES"
                    :feature-enabled-callback="() => !isEEFeatureBlocked"
                    :title="$t('upgrade.upgradeToUseRecordTemplates')"
                    :content="$t('upgrade.upgradeToUseRecordTemplatesSubtitle', { plan: PlanTitles.PLUS })"
                    :on-click-callback="() => (isOpen = false)"
                    show-as-lock
                  />
                </div>
              </NcMenuItem>
            </template>
          </PaymentUpgradeBadgeProvider>
          <PaymentUpgradeBadgeProvider v-if="showDateDependencyAction" :feature="PlanFeatureTypes.FEATURE_DATE_DEPENDENCY">
            <template #default="{ click }">
              <NcMenuItem inner-class="w-full" @click="click(PlanFeatureTypes.FEATURE_DATE_DEPENDENCY, () => openTool('dates'))">
                <div v-e="['c:table:date-dependency']" class="flex items-center gap-2 w-full">
                  <GeneralIcon icon="ncCalendar" class="opacity-80" />
                  <span class="flex-1 truncate">{{ $t('labels.dateDependency.title') }}</span>
                  <LazyPaymentUpgradeBadge
                    :feature="PlanFeatureTypes.FEATURE_DATE_DEPENDENCY"
                    :feature-enabled-callback="() => !isEEFeatureBlocked"
                    :title="$t('upgrade.upgradeToUseDateDependency')"
                    :content="$t('upgrade.upgradeToUseDateDependencySubtitle')"
                    :on-click-callback="() => (isOpen = false)"
                    show-as-lock
                  />
                </div>
              </NcMenuItem>
            </template>
          </PaymentUpgradeBadgeProvider>
        </template>

        <!-- Integrations -->
        <NcDivider />
        <NcMenuItem v-if="showWebhooksAction" v-e="['c:table:webhooks']" @click="openTool('webhook')">
          <GeneralIcon icon="ncWebhook" class="opacity-80" />
          {{ $t('objects.webhooks') }}
        </NcMenuItem>
        <NcMenuItem v-e="['c:table:api']" @click="openTool('api')">
          <GeneralIcon icon="ncCode" class="opacity-80" />
          {{ $t('labels.apiSnippet') }}
        </NcMenuItem>
      </NcMenu>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
// One step smaller than the default 14px menu row.
.nc-table-tools-menu .nc-menu-item-inner {
  @apply !text-[13px];
}
</style>
