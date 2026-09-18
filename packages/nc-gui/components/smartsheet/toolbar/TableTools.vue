<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

// Table-scoped configuration surfaces, consolidated under a single "Tools"
// toolbar entry (table-scoped), deliberately separate from the view-scoped 3-dot
// menu. Grouped into Structure / Access & security / Records / Integrations.
//
// Always mounted inside the smartsheet provider scope (the toolbar), so the
// modals can be rendered in-template and resolve MetaInj / the smartsheet store.
// "Manage fields" navigates to its full-page surface; the rest open as modals.
// Record templates reuses the shared manager hosted by RecordTemplatesButton
// (grid-only), so its entry is gated to grid views where that host exists.

const { isUIAllowed } = useRoles()

const { onViewsTabChange } = useViewsStore()

const { isSqlView, isGrid } = useSmartsheetStoreOrThrow()

const { activeTable } = storeToRefs(useTablesStore())

const { showEEFeatures, isEEFeatureBlocked } = useEeConfig()

const { openManager: openRecordTemplateManager } = useRecordTemplate()

const isPublic = inject(IsPublicInj, ref(false))

const { isSharedBase } = storeToRefs(useBase())

const { isMobileMode } = useGlobal()

const isOpen = ref(false)

const isRelationsModalOpen = ref(false)

const isApiModalOpen = ref(false)

const isWebhooksModalOpen = ref(false)

const isPermissionsModalOpen = ref(false)

const isRlsModalOpen = ref(false)

const isDateDependencyModalOpen = ref(false)

// Hidden on public/shared views (no schema editing) and on mobile, matching the
// old Data | Details toggle's gating. Mounted across the grid/gallery/kanban/
// calendar/list toolbar plus the timeline/gantt toolbars, so the gate lives here.
const isVisible = computed(() => !isPublic.value && !isSharedBase.value && !isMobileMode.value)

const showFieldsAction = computed(() => isUIAllowed('fieldAdd') && !isSqlView.value)

const showWebhooksAction = computed(() => isUIAllowed('hookList') && !isSqlView.value)

const showPermissionsAction = computed(() => isEeUI && isUIAllowed('tablePermission') && !isSqlView.value && showEEFeatures.value)

const showRlsAction = computed(() => isEeUI && isUIAllowed('rlsManage') && !isSqlView.value && showEEFeatures.value)

const showDateDependencyAction = computed(
  () => isEeUI && isUIAllowed('dateDependencyManage') && !isSqlView.value && showEEFeatures.value,
)

// Record templates' manager modal is hosted by the grid-only RecordTemplatesButton,
// so only offer it where that host is mounted.
const showRecordTemplatesAction = computed(() => isEeUI && showEEFeatures.value && isGrid.value)

const showAccessSection = computed(() => showPermissionsAction.value || showRlsAction.value)

const showRecordsSection = computed(() => showRecordTemplatesAction.value || showDateDependencyAction.value)

const onManageFields = () => {
  isOpen.value = false
  onViewsTabChange('field')
}

const onOpenRelations = () => {
  isOpen.value = false
  isRelationsModalOpen.value = true
}

const onOpenApi = () => {
  isOpen.value = false
  isApiModalOpen.value = true
}

const onOpenWebhooks = () => {
  isOpen.value = false
  isWebhooksModalOpen.value = true
}

const onOpenPermissions = () => {
  isOpen.value = false
  isPermissionsModalOpen.value = true
}

const onRowLevelSecurity = () => {
  isOpen.value = false
  isRlsModalOpen.value = true
}

const onDateDependency = () => {
  isOpen.value = false
  isDateDependencyModalOpen.value = true
}

const onOpenRecordTemplates = () => {
  isOpen.value = false
  openRecordTemplateManager()
}
</script>

<template>
  <NcDropdown v-if="isVisible" v-model:visible="isOpen" overlay-class-name="nc-dropdown-table-tools">
    <NcTooltip :title="$t('general.tools')" placement="bottom">
      <NcButton
        v-e="['c:table:tools']"
        class="nc-table-tools-btn nc-toolbar-btn !border-0 !h-7 !px-1.5 !min-w-7"
        size="small"
        type="secondary"
        data-testid="nc-table-tools-btn"
        :class="{ '!bg-nc-bg-gray-medium': isOpen }"
      >
        <GeneralIcon icon="ncTool" class="!h-4 !w-4" />
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <NcMenu class="!w-90" data-id="table-tools">
        <!-- Structure -->
        <NcMenuItemLabel class="nc-tools-section">{{ $t('labels.toolsSectionStructure') }}</NcMenuItemLabel>
        <NcMenuItem
          v-if="showFieldsAction"
          v-e="['c:table:fields']"
          inner-class="!items-start gap-3 w-full"
          @click="onManageFields"
        >
          <div class="nc-tools-tile">
            <GeneralIcon icon="ncList" class="!h-4.5 !w-4.5 text-nc-content-gray-subtle2" />
          </div>
          <div class="flex flex-col gap-0.5 min-w-0 flex-1">
            <span class="nc-tools-title">{{ $t('general.manageFields') }}</span>
            <span class="nc-tools-subtext">{{ $t('labels.manageFieldsSubtext') }}</span>
          </div>
        </NcMenuItem>
        <NcMenuItem v-e="['c:table:relations']" inner-class="!items-start gap-3 w-full" @click="onOpenRelations">
          <div class="nc-tools-tile">
            <GeneralIcon icon="ncErd" class="!h-4.5 !w-4.5 text-nc-content-gray-subtle2" />
          </div>
          <div class="flex flex-col gap-0.5 min-w-0 flex-1">
            <span class="nc-tools-title">{{ $t('title.relations') }}</span>
            <span class="nc-tools-subtext">{{ $t('labels.relationsSubtext') }}</span>
          </div>
        </NcMenuItem>

        <!-- Access & security -->
        <template v-if="showAccessSection">
          <NcMenuItemLabel class="nc-tools-section">{{ $t('labels.toolsSectionAccess') }}</NcMenuItemLabel>
          <PaymentUpgradeBadgeProvider
            v-if="showPermissionsAction"
            :feature="PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS"
          >
            <template #default="{ click }">
              <NcMenuItem
                inner-class="!items-start gap-3 w-full"
                @click="click(PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS, () => onOpenPermissions())"
              >
                <div v-e="['c:table:permissions']" style="display: contents">
                  <div class="nc-tools-tile">
                    <GeneralIcon icon="ncLock" class="!h-4.5 !w-4.5 text-nc-content-gray-subtle2" />
                  </div>
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="nc-tools-title">{{ $t('upgrade.features.permissions') }}</span>
                      <LazyPaymentUpgradeBadge
                        :feature="PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS"
                        :feature-enabled-callback="() => !isEEFeatureBlocked"
                        :title="$t('upgrade.upgradeToUseTableAndFieldPermissions')"
                        :content="$t('upgrade.upgradeToUseTableAndFieldPermissionsSubtitle', { plan: PlanTitles.PLUS })"
                        :on-click-callback="() => (isOpen = false)"
                        show-as-lock
                      />
                    </div>
                    <span class="nc-tools-subtext">{{ $t('labels.permissionsSubtext') }}</span>
                  </div>
                </div>
              </NcMenuItem>
            </template>
          </PaymentUpgradeBadgeProvider>
          <PaymentUpgradeBadgeProvider v-if="showRlsAction" :feature="PlanFeatureTypes.FEATURE_RLS">
            <template #default="{ click }">
              <NcMenuItem
                inner-class="!items-start gap-3 w-full"
                @click="click(PlanFeatureTypes.FEATURE_RLS, () => onRowLevelSecurity())"
              >
                <div v-e="['c:table:rls']" style="display: contents">
                  <div class="nc-tools-tile">
                    <GeneralIcon icon="ncShield" class="!h-4.5 !w-4.5 text-nc-content-gray-subtle2" />
                  </div>
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="nc-tools-title">{{ $t('objects.permissions.rlsPolicy.rowLevelSecurity') }}</span>
                      <LazyPaymentUpgradeBadge
                        :feature="PlanFeatureTypes.FEATURE_RLS"
                        :feature-enabled-callback="() => !isEEFeatureBlocked"
                        :title="$t('upgrade.upgradeToUseRls')"
                        :content="$t('upgrade.upgradeToUseRlsSubtitle', { plan: PlanTitles.ENTERPRISE })"
                        :on-click-callback="() => (isOpen = false)"
                        show-as-lock
                      />
                    </div>
                    <span class="nc-tools-subtext">{{ $t('labels.rlsSubtext') }}</span>
                  </div>
                </div>
              </NcMenuItem>
            </template>
          </PaymentUpgradeBadgeProvider>
        </template>

        <!-- Records -->
        <template v-if="showRecordsSection">
          <NcMenuItemLabel class="nc-tools-section">{{ $t('labels.toolsSectionRecords') }}</NcMenuItemLabel>
          <PaymentUpgradeBadgeProvider v-if="showRecordTemplatesAction" :feature="PlanFeatureTypes.FEATURE_RECORD_TEMPLATES">
            <template #default="{ click }">
              <NcMenuItem
                inner-class="!items-start gap-3 w-full"
                @click="click(PlanFeatureTypes.FEATURE_RECORD_TEMPLATES, () => onOpenRecordTemplates())"
              >
                <div v-e="['c:table:record-templates']" style="display: contents">
                  <div class="nc-tools-tile">
                    <GeneralIcon icon="ncClipboard" class="!h-4.5 !w-4.5 text-nc-content-gray-subtle2" />
                  </div>
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="nc-tools-title">{{ $t('objects.recordTemplates') }}</span>
                      <LazyPaymentUpgradeBadge
                        :feature="PlanFeatureTypes.FEATURE_RECORD_TEMPLATES"
                        :feature-enabled-callback="() => !isEEFeatureBlocked"
                        :title="$t('upgrade.upgradeToUseRecordTemplates')"
                        :content="$t('upgrade.upgradeToUseRecordTemplatesSubtitle', { plan: PlanTitles.PLUS })"
                        :on-click-callback="() => (isOpen = false)"
                        show-as-lock
                      />
                    </div>
                    <span class="nc-tools-subtext">{{ $t('labels.recordTemplatesSubtext') }}</span>
                  </div>
                </div>
              </NcMenuItem>
            </template>
          </PaymentUpgradeBadgeProvider>
          <PaymentUpgradeBadgeProvider v-if="showDateDependencyAction" :feature="PlanFeatureTypes.FEATURE_DATE_DEPENDENCY">
            <template #default="{ click }">
              <NcMenuItem
                inner-class="!items-start gap-3 w-full"
                @click="click(PlanFeatureTypes.FEATURE_DATE_DEPENDENCY, () => onDateDependency())"
              >
                <div v-e="['c:table:date-dependency']" style="display: contents">
                  <div class="nc-tools-tile">
                    <GeneralIcon icon="ncCalendar" class="!h-4.5 !w-4.5 text-nc-content-gray-subtle2" />
                  </div>
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="nc-tools-title">{{ $t('labels.dateDependency.title') }}</span>
                      <LazyPaymentUpgradeBadge
                        :feature="PlanFeatureTypes.FEATURE_DATE_DEPENDENCY"
                        :feature-enabled-callback="() => !isEEFeatureBlocked"
                        :title="$t('upgrade.upgradeToUseDateDependency')"
                        :content="$t('upgrade.upgradeToUseDateDependencySubtitle')"
                        :on-click-callback="() => (isOpen = false)"
                        show-as-lock
                      />
                    </div>
                    <span class="nc-tools-subtext">{{ $t('labels.dateDependencySubtext') }}</span>
                  </div>
                </div>
              </NcMenuItem>
            </template>
          </PaymentUpgradeBadgeProvider>
        </template>

        <!-- Integrations -->
        <NcMenuItemLabel class="nc-tools-section">{{ $t('labels.toolsSectionIntegrations') }}</NcMenuItemLabel>
        <NcMenuItem
          v-if="showWebhooksAction"
          v-e="['c:table:webhooks']"
          inner-class="!items-start gap-3 w-full"
          @click="onOpenWebhooks"
        >
          <div class="nc-tools-tile">
            <GeneralIcon icon="ncWebhook" class="!h-4.5 !w-4.5 text-nc-content-gray-subtle2" />
          </div>
          <div class="flex flex-col gap-0.5 min-w-0 flex-1">
            <span class="nc-tools-title">{{ $t('objects.webhooks') }}</span>
            <span class="nc-tools-subtext">{{ $t('labels.webhooksSubtext') }}</span>
          </div>
        </NcMenuItem>
        <NcMenuItem v-e="['c:table:api']" inner-class="!items-start gap-3 w-full" @click="onOpenApi">
          <div class="nc-tools-tile">
            <GeneralIcon icon="ncCode" class="!h-4.5 !w-4.5 text-nc-content-gray-subtle2" />
          </div>
          <div class="flex flex-col gap-0.5 min-w-0 flex-1">
            <span class="nc-tools-title">{{ $t('labels.apiSnippet') }}</span>
            <span class="nc-tools-subtext">{{ $t('labels.apiSnippetSubtext') }}</span>
          </div>
        </NcMenuItem>
      </NcMenu>
    </template>
  </NcDropdown>

  <DlgTableRelations v-model:visible="isRelationsModalOpen" />

  <DlgTableApi v-model:visible="isApiModalOpen" />

  <DlgTableWebhooks v-model:visible="isWebhooksModalOpen" />

  <PermissionsModal
    v-if="isEeUI && activeTable?.id && activeTable?.base_id"
    v-model:visible="isPermissionsModalOpen"
    :base-id="activeTable.base_id"
    :table-id="activeTable.id"
  />

  <DlgTableRowLevelSecurity
    v-if="isEeUI && activeTable?.id"
    v-model:visible="isRlsModalOpen"
    :table-id="activeTable.id"
    :title="activeTable.title"
  />

  <DlgTableDateDependency
    v-if="isEeUI && activeTable?.id"
    v-model:visible="isDateDependencyModalOpen"
    :table-id="activeTable.id"
    :title="activeTable.title"
  />
</template>

<style lang="scss" scoped>
.nc-tools-tile {
  @apply flex-none w-9 h-9 rounded-lg bg-nc-bg-gray-light flex items-center justify-center;
}

.nc-tools-title {
  @apply text-sm font-normal text-nc-content-gray-emphasis leading-5;
}

.nc-tools-subtext {
  @apply text-bodySm text-nc-content-gray-muted truncate;
}

// Section headers (STRUCTURE / ACCESS & SECURITY / …) — lighter and smaller than
// the shared NcMenuItemLabel default.
.nc-tools-section {
  @apply !text-[11px] !font-medium;
}
</style>
