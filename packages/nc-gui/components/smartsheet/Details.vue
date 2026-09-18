<script setup lang="ts">
import { PlanFeatureTypes } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'
import type { ToolRailGroup } from './details/ToolsRail.vue'
import type { ViewPageType } from '~/lib/types'

// Unified "Tools" shell: a two-pane full-page surface (left tool-nav rail +
// content area with a per-tool header band) that hosts every table-scoped tool.
// The rail navigates among tools in place via the route slug (openedViewsTab);
// the table sidebar (TreeView) stays put as a separate left pane in the layout.
// Reached via the toolbar "Tools" menu (e.g. "Manage fields") or a deep link.

const { openedViewsTab } = storeToRefs(useViewsStore())
const { onViewsTabChange } = useViewsStore()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

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
const { hasSaveBar } = useProvideToolsShell()

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
const showRecordTemplatesAction = computed(() => isEeUI && showEEFeatures.value)

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

const railGroups = computed<ToolRailGroup[]>(() => {
  const structure = [
    showFieldsAction.value && { slug: 'field' as const, icon: 'ncList', title: t('general.manageFields') },
    { slug: 'relation' as const, icon: 'ncErd', title: t('title.relations') },
  ].filter(Boolean) as ToolRailGroup['items']

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
  ].filter(Boolean) as ToolRailGroup['items']

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
  ].filter(Boolean) as ToolRailGroup['items']

  const integrations = [
    showWebhooksAction.value && { slug: 'webhook' as const, icon: 'ncWebhook', title: t('objects.webhooks') },
    { slug: 'api' as const, icon: 'ncCode', title: t('labels.apiSnippet') },
  ].filter(Boolean) as ToolRailGroup['items']

  return [
    { label: t('labels.toolsSectionStructure'), items: structure },
    { label: t('labels.toolsSectionAccess'), items: access },
    { label: t('labels.toolsSectionRecords'), items: records },
    { label: t('labels.toolsSectionIntegrations'), items: integrations },
  ]
})

// Header band copy per tool (icon tile + title).
const toolHeader = computed(() => {
  switch (openedViewsTab.value) {
    case 'permissions':
      return { icon: 'ncLock', title: t('general.permissions') }
    case 'rls':
      return { icon: 'ncShield', title: t('objects.permissions.rlsPolicy.rowLevelSecurity') }
    case 'templates':
      return { icon: 'ncClipboard', title: t('objects.recordTemplates') }
    case 'dates':
      return { icon: 'ncCalendar', title: t('labels.dateDependency.title') }
    case 'relation':
      return { icon: 'ncErd', title: t('title.relations') }
    case 'api':
      return { icon: 'ncCode', title: t('labels.apiSnippet') }
    case 'webhook':
      return { icon: 'ncWebhook', title: t('objects.webhooks'), docsHref: WEBHOOK_DOCS_URL }
    case 'field':
    default:
      return { icon: 'ncList', title: t('general.manageFields') }
  }
})

const onSelectTool = (slug: ViewPageType) => {
  if (slug === openedViewsTab.value) return

  // Intercept locked EE features → show the upgrade modal instead of navigating.
  if (slug === 'permissions' && showUpgradeToUseTableAndFieldPermissions({ triggerSource: 'table-tools-shell-permissions' })) {
    return
  }

  if (slug === 'rls' && showUpgradeToUseRls({ triggerSource: 'table-tools-shell-rls' })) {
    return
  }

  if (slug === 'dates' && showUpgradeToUseDateDependency({ triggerSource: 'table-tools-shell-date-dependency' })) {
    return
  }

  if (slug === 'templates' && showUpgradeToUseRecordTemplates({ triggerSource: 'table-tools-shell-record-templates' })) {
    return
  }

  onViewsTabChange(slug)
}

const onBackToGrid = () => {
  onViewsTabChange('view')
}

watch(
  [openedViewsTab, isBaseRolesLoaded],
  () => {
    if (!isBaseRolesLoaded.value) return

    // Bounce un-entitled / not-yet-wired tabs (incl. CE deep links) to Relations.
    if (tabAvailability.value[openedViewsTab.value] === false || tabAvailability.value[openedViewsTab.value] === undefined) {
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
  <div
    class="flex h-full w-full"
    data-testid="nc-details-wrapper"
    :class="{
      'nc-details-tab-left-sidebar-close': !isLeftSidebarOpen,
    }"
  >
    <SmartsheetDetailsToolsRail :groups="railGroups" :active="openedViewsTab" @select="onSelectTool" @back="onBackToGrid" />

    <div class="flex-1 flex flex-col min-w-0 min-h-0">
      <SmartsheetDetailsToolHeader :icon="toolHeader.icon" :title="toolHeader.title" :docs-href="toolHeader.docsHref">
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
      </SmartsheetDetailsToolHeader>

      <div class="flex-1 min-h-0">
        <LazySmartsheetDetailsFields v-if="openedViewsTab === 'field'" in-shell />

        <PermissionsModalContent
          v-else-if="openedViewsTab === 'permissions' && meta?.id"
          ref="permissionsRef"
          :table-id="meta.id"
          class="h-full"
          hide-section-title
          permissions-table-wrapper-class="!min-w-0 max-w-200"
          permissions-field-wrapper-class="!min-w-0 max-w-200 !top-4"
          permissions-table-toolbar-class-name="pt-4"
        />

        <div v-else-if="openedViewsTab === 'rls' && isEeUI && meta?.id" class="h-full overflow-hidden">
          <RlsPolicyList ref="rlsRef" :table-id="meta.id" :base="base" :table-name="meta.title" in-shell />
        </div>

        <div v-else-if="openedViewsTab === 'dates' && isEeUI && meta?.id" class="h-full px-6 py-5">
          <SmartsheetDetailsDateDependency :table-id="meta.id" :title="meta.title" in-shell />
        </div>

        <div v-else-if="openedViewsTab === 'templates' && isEeUI" class="h-full px-6 py-5">
          <SmartsheetDetailsRecordTemplates ref="recordTemplatesRef" in-shell />
        </div>

        <LazySmartsheetDetailsErd v-else-if="openedViewsTab === 'relation'" />

        <template v-else-if="openedViewsTab === 'api'">
          <LazySmartsheetDetailsApi v-if="base && meta && view" />
          <div v-else class="h-full w-full flex flex-col justify-center items-center mt-28 mb-4">
            <a-spin size="large" :indicator="indicator" />
          </div>
        </template>

        <LazySmartsheetDetailsWebhooks v-else-if="openedViewsTab === 'webhook'" ref="webhooksRef" in-shell />
      </div>

      <SmartsheetDetailsToolSaveBar v-if="hasSaveBar" />
    </div>
  </div>
</template>
