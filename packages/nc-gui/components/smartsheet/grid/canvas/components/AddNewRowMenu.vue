<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { PlanFeatureTypes, PlanTitles, ViewTypes } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    path?: Array<number> | null
    onNewRecordToGridClick: () => void
    onNewRecordToFormClick: () => void
    onOpenTemplateManager?: () => void
    removeInlineAddRecord?: boolean
  }>(),
  {
    path: () => [],
  },
)

const { removeInlineAddRecord } = toRefs(props)

const { $e } = useNuxtApp()
const { t } = useI18n()
const { isAddNewRecordGridMode } = useGlobal()
const { base } = storeToRefs(useBase())
const { meta } = useSmartsheetStoreOrThrow()

const { templates: allTemplates, selectedTemplate, setSelectedTemplate } = useRecordTemplate()

const { blockRecordTemplates, showUpgradeToUseRecordTemplates, showEEFeatures } = useEeConfig()

/**
 * Filter the base-level template list to only show enabled templates
 * for the current table. The shared `allTemplates` contains templates
 * across all tables, so we filter by fk_model_id (table ID).
 */
const templates = computed(() => allTemplates.value.filter((t: any) => t.enabled !== false && t.fk_model_id === meta.value?.id))

const { $api } = useNuxtApp()
const { getMeta } = useMetas()

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

/** Create a record using the selected template (delegates to shared utility) */
const handleUseTemplate = async (tmpl: any) => {
  if (!base.value?.id || !meta.value?.id || !tmpl?.id) return
  try {
    await createRecordFromTemplate({
      tmpl,
      api: $api,
      baseId: base.value.id,
      tableId: meta.value.id,
      columns: (meta.value.columns || []) as ColumnType[],
      getMeta,
    })

    message.toast('Record created from template')
    reloadViewDataHook?.trigger()
  } catch (e: any) {
    console.error(e)
    message.toast(await extractSdkResponseErrorMsg(e))
  }
}

const defaultOptions = computed(() => {
  return [
    {
      label: `${t('activity.newRecord')} - ${t('objects.viewType.grid')}`,
      value: 'true',
      disabled: removeInlineAddRecord.value,
      click: () => {
        $e('c:row:add:grid')
        setSelectedTemplate(null)
        props.onNewRecordToGridClick(props.path ?? [])
      },
      icon: viewIcons[ViewTypes.GRID]?.icon,
    },
    {
      label: `${t('activity.newRecord')} - ${t('objects.viewType.form')}`,
      value: 'false',
      disabled: removeInlineAddRecord.value,
      click: () => {
        $e('c:row:add:form')
        setSelectedTemplate(null)
        props.onNewRecordToFormClick(props.path ?? [])
      },
      icon: viewIcons[ViewTypes.FORM]?.icon,
    },
  ]
})

const templatesList = computed(() => {
  return templates.value.map((tmpl: any) => ({
    label: tmpl.title,
    value: tmpl.id,
    template: tmpl,
  }))
})
</script>

<template>
  <div>
    <!-- Manage Templates -->
    <NcList
      v-if="showEEFeatures"
      value=""
      :list="[
        {
          label: $t('activity.manageTemplates'),
          value: 'manage-templates',
        },
      ]"
      variant="small"
      class="!h-auto !pt-1"
      :item-height="30"
      reset-hover-effect-on-mouse-leave
      @change="
        () => {
          if (showUpgradeToUseRecordTemplates()) return

          onOpenTemplateManager?.()
        }
      "
    >
      <template #listItemExtraLeft>
        <GeneralIcon icon="settings" class="w-4 h-4" />
      </template>
      <template #listItemExtraRight>
        <PaymentUpgradeBadge
          :feature="PlanFeatureTypes.FEATURE_RECORD_TEMPLATES"
          :content="
            $t('upgrade.upgradeToUseRecordTemplatesSubtitle', {
              plan: PlanTitles.PLUS,
            })
          "
          remove-click
          class="-my-1"
        />
      </template>
    </NcList>

    <template v-if="!blockRecordTemplates && templates.length && showEEFeatures">
      <NcDivider class="!my-0" />
      <NcList
        :value="selectedTemplate?.id ?? ''"
        :list="templatesList"
        variant="small"
        class="!pt-1"
        :item-height="30"
        :search-input-placeholder="$t('placeholder.searchRecordTemplates')"
        reset-hover-effect-on-mouse-leave
        @change="
        (option) => {
          setSelectedTemplate(option.value as string)
          handleUseTemplate(option.template)
        }
      "
      >
        <template #listItemExtraLeft>
          <GeneralIcon icon="ncClipboardType" class="h-4 w-4 flex-none" />
        </template>
      </NcList>
    </template>

    <NcDivider class="!my-0" />

    <NcList
      :value="!selectedTemplate ? `${!!isAddNewRecordGridMode}` : ''"
      :list="defaultOptions"
      variant="small"
      class="!h-auto !pt-1"
      :item-height="30"
      reset-hover-effect-on-mouse-leave
      @change="
        (option) => {
          option.click()
        }
      "
    >
      <template #listItemExtraLeft="{ option }">
        <component :is="option.icon" class="nc-view-icon text-inherit" />
      </template>
    </NcList>
  </div>
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply w-full;
}
</style>
