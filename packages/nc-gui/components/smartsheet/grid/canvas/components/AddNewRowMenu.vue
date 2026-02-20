<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'

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

const { isAddNewRecordGridMode } = useGlobal()
const { base } = storeToRefs(useBase())
const { meta } = useSmartsheetStoreOrThrow()
const { t } = useI18n()

const { templates: allTemplates, selectedTemplate, setSelectedTemplate } = useRecordTemplate()

/**
 * Filter the base-level template list to only show enabled templates
 * for the current table. The shared `allTemplates` contains templates
 * across all tables, so we filter by source_id (table ID).
 */
const templates = computed(() => allTemplates.value.filter((t: any) => t.enabled !== false && t.source_id === meta.value?.id))

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
</script>

<template>
  <NcMenu variant="small">
    <NcMenuItem
      v-e="['c:row:add:grid']"
      class="nc-new-record-with-grid group"
      :disabled="removeInlineAddRecord"
      @click="
        setSelectedTemplate(null)
        onNewRecordToGridClick(path ?? [])
      "
    >
      <div class="flex flex-row flex-1 items-center justify-start gap-x-3">
        <component :is="viewIcons[ViewTypes.GRID]?.icon" class="nc-view-icon text-inherit" />
        {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.grid') }}
      </div>

      <GeneralIcon v-if="!selectedTemplate && isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
    </NcMenuItem>
    <NcMenuItem
      v-e="['c:row:add:form']"
      class="nc-new-record-with-form group"
      @click="
        setSelectedTemplate(null)
        onNewRecordToFormClick(path ?? [])
      "
    >
      <div class="flex flex-row items-center flex-1 justify-start gap-x-3">
        <component :is="viewIcons[ViewTypes.FORM]?.icon" class="nc-view-icon text-inherit" />
        {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }}
      </div>

      <GeneralIcon v-if="!selectedTemplate && !isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
    </NcMenuItem>

    <!-- Record Templates (when available) -->
    <template v-if="templates.length > 0">
      <NcDivider />
      <NcMenuItem
        v-for="tmpl in templates"
        :key="tmpl.id"
        v-e="['c:record-templates:use']"
        class="nc-template-menu-item"
        @click="
          setSelectedTemplate(tmpl.id)
          handleUseTemplate(tmpl)
        "
      >
        <div class="flex items-center flex-1 gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="flex-none"
          >
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M9 12v-1h6v1" />
            <path d="M11 17h2" />
            <path d="M12 11v6" />
          </svg>
          <span class="truncate flex-1">{{ tmpl.title }}</span>
        </div>
        <GeneralIcon v-if="selectedTemplate?.id === tmpl.id" icon="check" class="w-4 h-4 text-primary" />
      </NcMenuItem>
    </template>

    <!-- Manage Templates -->
    <NcDivider />
    <NcMenuItem class="nc-manage-templates" @click="onOpenTemplateManager?.()">
      <div class="flex items-center gap-2">
        <GeneralIcon icon="settings" class="w-4 h-4" />
        <span>{{ $t('activity.manageTemplates') }}</span>
      </div>
    </NcMenuItem>
  </NcMenu>
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply w-full;
}
</style>
