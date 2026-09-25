<script setup lang="ts">
import { PlanFeatureTypes } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'
import type { ShellRailGroup } from '../shell/Rail.vue'
import type { ViewPageType } from '~/lib/types'

// Unified "Tools" shell: a modal with a left tool-nav rail and a content area
// (per-tool header band, body, unified save bar) hosting every table-scoped tool.
// Route-driven: open while the route slug (openedViewsTab) names a tool, and the
// rail switches tools by changing that slug, so deep links / back button keep
// working and the view stays rendered underneath. Closing routes back to 'view'.

const { openedViewsTab } = storeToRefs(useViewsStore())
const { onViewsTabChange } = useViewsStore()

const { isSqlView } = useSmartsheetStoreOrThrow()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { isUIAllowed, isBaseRolesLoaded } = useRoles()

const {
  showUpgradeToUseTableAndFieldPermissions,
  showUpgradeToUseRls,
  showUpgradeToUseDateDependency,
  showUpgradeToUseRecordTemplates,
  showEEFeatures,
} = useEeConfig()

const { base } = storeToRefs(useBase())
const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())

// Provide the shell's unified save-bar contract. Editing tool bodies (Fields,
// Date Dependencies) register their dirty/save/reset; the bar shows only then.
const { hasSaveBar } = useProvideShell()

const isOpen = computed(() => openedViewsTab.value !== 'view')

// Tool bodies expose their primary/secondary actions so the title band can
// surface them (the page contract: one action zone, top-right of the band).
const recordTemplatesRef = ref<{ openTemplateForm: () => void }>()

const rlsRef = ref<{ addPolicy: () => void; addDefaultPolicy: () => void; hasDefaultPolicy: boolean }>()

const webhooksRef = ref<{ createWebhook: () => void }>()

const permissionsRef = ref<{ resetPermissions: () => void }>()

const onCreateTemplate = () => recordTemplatesRef.value?.openTemplateForm()

const WEBHOOK_DOCS_URL = 'https://nocodb.com/docs/product-docs/automation/webhook'

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '2rem',
  },
  spin: true,
})

// Per-tool visibility gates — kept in lockstep with the toolbar Tools menu
// (components/smartsheet/toolbar/TableTools.vue).
const showFieldsAction = computed(() => isUIAllowed('fieldAdd') && !isSqlView.value)

const showWebhooksAction = computed(() => isUIAllowed('hookList') && !isSqlView.value)

const showPermissionsAction = computed(() => isEeUI && isUIAllowed('tablePermission') && !isSqlView.value && showEEFeatures.value)

const showRlsAction = computed(() => isEeUI && isUIAllowed('rlsManage') && !isSqlView.value && showEEFeatures.value)

const showDateDependencyAction = computed(
  () => isEeUI && isUIAllowed('dateDependencyManage') && !isSqlView.value && showEEFeatures.value,
)

// Record templates are base-level data; unlike the toolbar dropdown (which
// gates to grid because its manager modal is grid-hosted), the shell embeds the
// manager itself, so it's reachable from any view's Tools surface.
// recordTemplate* is an EDITOR-and-up ACL block, so keep the role gate.
const showRecordTemplatesAction = computed(() => isEeUI && isUIAllowed('viewOperations') && showEEFeatures.value)

// Slug → "is this tool reachable" map. Relations / API are always available;
// a deep link to a tool that isn't reachable (or isn't yet wired) bounces to
// 'relation' once roles have loaded.
const tabAvailability = computed<Partial<Record<ViewPageType, boolean>>>(() => ({
  field: showFieldsAction.value,
  relation: true,
  permissions: showPermissionsAction.value,
  rls: showRlsAction.value,
  templates: showRecordTemplatesAction.value,
  dates: showDateDependencyAction.value,
  api: true,
  webhook: showWebhooksAction.value,
}))

const railGroups = computed<ShellRailGroup[]>(() => {
  const structure = [
    showFieldsAction.value && { slug: 'field' as const, icon: 'ncList', title: t('general.manageFields') },
    { slug: 'relation' as const, icon: 'ncErd', title: t('title.relations') },
  ].filter(Boolean) as ShellRailGroup['items']

  const access = [
    showPermissionsAction.value && {
      slug: 'permissions' as const,
      icon: 'ncLock',
      title: t('general.permissions'),
      feature: PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS,
    },
    showRlsAction.value && {
      slug: 'rls' as const,
      icon: 'ncShield',
      title: t('objects.permissions.rlsPolicy.rowLevelSecurity'),
      feature: PlanFeatureTypes.FEATURE_RLS,
    },
  ].filter(Boolean) as ShellRailGroup['items']

  const records = [
    showRecordTemplatesAction.value && {
      slug: 'templates' as const,
      icon: 'ncClipboard',
      title: t('objects.recordTemplates'),
      feature: PlanFeatureTypes.FEATURE_RECORD_TEMPLATES,
    },
    showDateDependencyAction.value && {
      slug: 'dates' as const,
      icon: 'ncCalendar',
      title: t('labels.dateDependency.title'),
      feature: PlanFeatureTypes.FEATURE_DATE_DEPENDENCY,
    },
  ].filter(Boolean) as ShellRailGroup['items']

  const developer = [
    showWebhooksAction.value && { slug: 'webhook' as const, icon: 'ncWebhook', title: t('objects.webhooks') },
    { slug: 'api' as const, icon: 'ncCode', title: t('labels.apiSnippet') },
  ].filter(Boolean) as ShellRailGroup['items']

  return [
    { label: t('labels.toolsSectionStructure'), items: structure },
    { label: t('labels.toolsSectionAccess'), items: access },
    { label: t('labels.toolsSectionRecords'), items: records },
    { label: t('labels.toolsSectionDeveloper'), items: developer },
  ]
})

// Title-block copy per tool.
const toolHeader = computed(() => {
  switch (openedViewsTab.value) {
    case 'permissions':
      return { title: t('general.permissions'), description: t('labels.permissionsSubtext') }
    case 'rls':
      return { title: t('objects.permissions.rlsPolicy.rowLevelSecurity'), description: t('labels.rlsSubtext') }
    case 'templates':
      return { title: t('objects.recordTemplates'), description: t('labels.recordTemplatesSubtext') }
    case 'dates':
      return { title: t('labels.dateDependency.title'), description: t('labels.dateDependencySubtext') }
    case 'relation':
      return { title: t('title.relations'), description: t('labels.relationsSubtext') }
    case 'api':
      return { title: t('labels.apiSnippet'), description: t('labels.apiSnippetSubtext') }
    case 'webhook':
      return { title: t('objects.webhooks'), description: t('labels.webhooksSubtext'), docsHref: WEBHOOK_DOCS_URL }
    case 'field':
    default:
      return { title: t('general.manageFields'), description: t('labels.manageFieldsSubtext') }
  }
})

// True when the tool is locked on the current plan, having shown the upgrade
// modal. Shared by the rail click and the deep-link guard below so a URL can't
// walk past a gate the rail respects.
const showUpgradeForTool = (slug: ViewPageType) => {
  switch (slug) {
    case 'permissions':
      return !!showUpgradeToUseTableAndFieldPermissions({ triggerSource: 'table-tools-shell-permissions' })
    case 'rls':
      return !!showUpgradeToUseRls({ triggerSource: 'table-tools-shell-rls' })
    case 'dates':
      return !!showUpgradeToUseDateDependency({ triggerSource: 'table-tools-shell-date-dependency' })
    case 'templates':
      return !!showUpgradeToUseRecordTemplates({ triggerSource: 'table-tools-shell-record-templates' })
    default:
      return false
  }
}

const onSelectTool = (rawSlug: string) => {
  const slug = rawSlug as ViewPageType

  if (slug === openedViewsTab.value) return

  // Intercept locked EE features → show the upgrade modal instead of navigating.
  if (showUpgradeForTool(slug)) return

  onViewsTabChange(slug)
}

const onClose = () => {
  onViewsTabChange('view')
}

const onVisibleChange = (visible: boolean) => {
  if (!visible) onClose()
}

watch(
  [openedViewsTab, isBaseRolesLoaded],
  () => {
    if (!isBaseRolesLoaded.value || !isOpen.value) return

    // Bounce un-entitled / not-yet-wired tabs (incl. CE deep links) to Relations.
    if (!tabAvailability.value[openedViewsTab.value]) {
      onViewsTabChange('relation')
      return
    }

    // A deep link (or Back into one) must clear the same plan gate a click does.
    if (showUpgradeForTool(openedViewsTab.value)) {
      onViewsTabChange('relation')
      return
    }

    $e(`c:table:tab-open:${openedViewsTab.value}`)
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <NcModal
    :visible="isOpen"
    size="xl"
    nc-modal-class-name="!p-0"
    wrap-class-name="nc-modal-table-tools"
    @update:visible="onVisibleChange"
  >
    <div class="relative flex h-full w-full" data-testid="nc-details-wrapper">
      <ShellClose @close="onClose" />

      <ShellRail :groups="railGroups" :active="openedViewsTab" @select="onSelectTool">
        <template v-if="meta" #subject>
          <GeneralTableIcon :meta="meta" class="!h-5 !w-5 !mx-0 flex-none text-nc-content-gray-subtle2" />
          <NcTooltip show-on-truncate-only class="truncate">{{ meta.title }}</NcTooltip>
        </template>
      </ShellRail>

      <div class="flex-1 flex flex-col min-w-0 min-h-0">
        <ShellHeader :title="toolHeader.title" :description="toolHeader.description" :docs-href="toolHeader.docsHref">
          <template #actions>
            <!-- Record Templates -->
            <NcButton
              v-if="openedViewsTab === 'templates' && isEeUI"
              v-e="['c:table:tools:create-template']"
              size="small"
              type="primary"
              @click="onCreateTemplate"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="plus" class="h-4 w-4" />
                {{ $t('activity.createTemplate') }}
              </div>
            </NcButton>

            <!-- Record-Level Security -->
            <template v-else-if="openedViewsTab === 'rls' && isEeUI">
              <NcButton
                v-if="!rlsRef?.hasDefaultPolicy"
                size="small"
                type="text"
                class="!text-nc-content-brand"
                @click="rlsRef?.addDefaultPolicy()"
              >
                <div class="flex items-center gap-1.5">
                  <GeneralIcon icon="plus" class="h-4 w-4" />
                  {{ $t('objects.permissions.rlsPolicy.addDefaultPolicy') }}
                </div>
              </NcButton>
              <NcButton size="small" type="primary" @click="rlsRef?.addPolicy()">
                <div class="flex items-center gap-1.5">
                  <GeneralIcon icon="plus" class="h-4 w-4" />
                  {{ $t('objects.permissions.rlsPolicy.addPolicy') }}
                </div>
              </NcButton>
            </template>

            <!-- Permissions: secondary Reset -->
            <NcButton
              v-else-if="openedViewsTab === 'permissions' && isEeUI"
              v-e="['c:table:tools:reset-permissions']"
              size="small"
              type="secondary"
              @click="permissionsRef?.resetPermissions()"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon icon="ncRotateCcw" class="h-4 w-4" />
                {{ $t('activity.resetPermissions') }}
              </div>
            </NcButton>

            <!-- Webhooks -->
            <NcButton
              v-else-if="openedViewsTab === 'webhook'"
              v-e="['c:actions:webhook']"
              size="small"
              type="primary"
              @click="webhooksRef?.createWebhook()"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon icon="plus" class="h-4 w-4" />
                {{ $t('activity.newWebhook') }}
              </div>
            </NcButton>
          </template>
        </ShellHeader>

        <div class="flex-1 min-h-0">
          <LazySmartsheetDetailsFields v-if="openedViewsTab === 'field'" />

          <PermissionsModalContent
            v-else-if="openedViewsTab === 'permissions' && meta?.id"
            ref="permissionsRef"
            :table-id="meta.id"
            class="nc-tools-permissions h-full pt-5"
            hide-section-title
            permissions-table-wrapper-class="!min-w-0 !mx-0"
            permissions-field-wrapper-class="!min-w-0 !mx-0"
          />

          <div v-else-if="openedViewsTab === 'rls' && isEeUI && meta?.id" class="h-full px-6 py-5 overflow-hidden">
            <RlsPolicyList ref="rlsRef" :table-id="meta.id" :base="base" :table-name="meta.title" in-shell />
          </div>

          <div v-else-if="openedViewsTab === 'dates' && isEeUI && meta?.id" class="h-full px-6 py-5">
            <SmartsheetDetailsDateDependency :table-id="meta.id" :title="meta.title" in-shell />
          </div>

          <div v-else-if="openedViewsTab === 'templates' && isEeUI" class="h-full px-6 py-5">
            <SmartsheetDetailsRecordTemplates ref="recordTemplatesRef" in-shell />
          </div>

          <!-- Erd / Api / Webhooks size themselves off the viewport unless told they're in a modal. -->
          <LazySmartsheetDetailsErd v-else-if="openedViewsTab === 'relation'" in-modal />

          <template v-else-if="openedViewsTab === 'api'">
            <LazySmartsheetDetailsApi v-if="base && meta && view" in-modal />
            <div v-else class="h-full w-full flex flex-col justify-center items-center mt-28 mb-4">
              <a-spin size="large" :indicator="indicator" />
            </div>
          </template>

          <LazySmartsheetDetailsWebhooks v-else-if="openedViewsTab === 'webhook'" ref="webhooksRef" in-modal in-shell />
        </div>

        <ShellSaveBar v-if="hasSaveBar" />
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
// Field names one step down (13px), matching the Manage fields rows.
.nc-tools-permissions :deep(.nc-field-permissions-name) {
  @apply !text-[13px];
}
</style>
