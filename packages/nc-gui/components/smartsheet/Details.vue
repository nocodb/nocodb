<script setup lang="ts">
import { PlanFeatureTypes } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'
import type { ViewPageType } from '~/lib/types'

// Unified "Tools" shell: a modal with a left tool-nav rail and a content area
// (per-tool header band, body, unified save bar) hosting every table-scoped tool.
// Route-driven: open while the route slug (openedViewsTab) names a tool, and the
// rail switches tools by changing that slug, so deep links / back button keep
// working and the view stays rendered underneath. Closing routes back to 'view'.

const { openedViewsTab } = storeToRefs(useViewsStore())
const { onViewsTabChange } = useViewsStore()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { isBaseRolesLoaded } = useRoles()

const { blockTableAndFieldPermissions, blockRls, blockDateDependency, blockRecordTemplates } = useEeConfig()

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

// Base-wide ERD, stacked over the shell so closing it lands back on this table's relations.
const openBaseRelations = () => {
  if (!meta.value?.source_id || !meta.value?.base_id) return

  const isErdOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgBaseErd'), {
    'modelValue': isErdOpen,
    'sourceId': meta.value.source_id,
    'baseId': meta.value.base_id,
    'onUpdate:modelValue': () => {
      isErdOpen.value = false
      close(1000)
    },
  })
}

const WEBHOOK_DOCS_URL = 'https://nocodb.com/docs/product-docs/automation/webhook'

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '2rem',
  },
  spin: true,
})

const { tabAvailability, toolGroups: railGroups } = useTableToolsNav()

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

// Plan-locked tools open to an in-pane upgrade card instead of their body.
const upgradeCard = computed(() => {
  switch (openedViewsTab.value) {
    case 'permissions':
      return blockTableAndFieldPermissions.value
        ? {
            feature: PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS,
            title: t('labels.baseNav.upgradeTitlePermissionsTablesFields'),
            detail: t('labels.baseNav.upgradeDescPermissionsTablesFields'),
            icon: 'ncLock',
          }
        : null
    case 'rls':
      return blockRls.value
        ? {
            feature: PlanFeatureTypes.FEATURE_RLS,
            title: t('objects.permissions.rlsPolicy.rowLevelSecurity'),
            detail: t('labels.baseNav.upgradeDescRls'),
            icon: 'ncShield',
          }
        : null
    case 'templates':
      return blockRecordTemplates.value
        ? {
            feature: PlanFeatureTypes.FEATURE_RECORD_TEMPLATES,
            title: t('objects.recordTemplates'),
            detail: t('labels.baseNav.upgradeDescRecordTemplates'),
            icon: 'ncClipboard',
          }
        : null
    case 'dates':
      return blockDateDependency.value
        ? {
            feature: PlanFeatureTypes.FEATURE_DATE_DEPENDENCY,
            title: t('labels.dateDependency.title'),
            detail: t('labels.baseNav.upgradeDescDateDependency'),
            icon: 'ncCalendar',
          }
        : null
    default:
      return null
  }
})

const onSelectTool = (rawSlug: string) => {
  const slug = rawSlug as ViewPageType

  if (slug === openedViewsTab.value) return

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
          <template v-if="!upgradeCard" #actions>
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

            <!-- Relations: base-wide diagram -->
            <NcButton
              v-else-if="openedViewsTab === 'relation' && meta?.source_id"
              v-e="['c:table:tools:open-base-relations']"
              size="small"
              type="secondary"
              data-testid="nc-tools-base-relations-btn"
              @click="openBaseRelations"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon icon="ncErd" class="h-4 w-4" />
                {{ $t('labels.baseRelations') }}
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

        <!-- Same gutter as ShellHeader so every pane lines up with its title. -->
        <div class="flex-1 min-h-0 nc-shell-gutter">
          <LazySmartsheetDetailsFields v-if="openedViewsTab === 'field'" />

          <div v-else-if="upgradeCard" class="h-full overflow-auto nc-scrollbar-thin">
            <PaymentUpgradeFeatureCard
              :feature="upgradeCard.feature"
              :title="upgradeCard.title"
              :detail="upgradeCard.detail"
              :icon="upgradeCard.icon"
            />
          </div>

          <!-- Top space sits outside the scroll container, so the field table's sticky header pins flush. -->
          <div v-else-if="openedViewsTab === 'permissions' && meta?.id" class="h-full pt-5">
            <PermissionsModalContent
              ref="permissionsRef"
              :table-id="meta.id"
              class="nc-tools-permissions h-full !px-0"
              hide-section-title
              permissions-table-wrapper-class="!min-w-0 !mx-0"
              permissions-field-wrapper-class="!min-w-0 !mx-0"
            />
          </div>

          <div v-else-if="openedViewsTab === 'rls' && isEeUI && meta?.id" class="h-full py-5 overflow-hidden">
            <RlsPolicyList ref="rlsRef" :table-id="meta.id" :base="base" :table-name="meta.title" in-shell />
          </div>

          <div v-else-if="openedViewsTab === 'dates' && isEeUI && meta?.id" class="h-full py-5">
            <SmartsheetDetailsDateDependency :table-id="meta.id" :title="meta.title" in-shell />
          </div>

          <div v-else-if="openedViewsTab === 'templates' && isEeUI" class="h-full py-5">
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
