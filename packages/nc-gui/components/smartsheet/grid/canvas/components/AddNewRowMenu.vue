<script setup lang="ts">
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
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

const templates = ref<any[]>([])

const { $api } = useNuxtApp()

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

// Load templates on mount - wrapped in try/catch since API may not be available
onMounted(async () => {
  try {
    if (base.value?.id && meta.value?.id && $api.recordTemplates?.recordTemplateList) {
      const response = await $api.recordTemplates.recordTemplateList(base.value.id, meta.value.id)
      templates.value = ((response as any)?.list || []).filter((t: any) => t.enabled !== false)
    }
  } catch (e) {
    // silently ignore - templates may not be available
  }
})

const parseTemplateData = (tmpl: any): { fields: Record<string, any>; ltarState: Record<string, any> } => {
  const data = typeof tmpl.template_data === 'string' ? JSON.parse(tmpl.template_data) : tmpl.template_data || {}
  return {
    fields: data.fields || {},
    ltarState: data.ltarState || {},
  }
}

const resolveBlueprintsInLtarState = async (ltarState: Record<string, any>): Promise<Record<string, any>> => {
  if (!base.value?.id || !meta.value?.columns) return ltarState

  const resolvedState: Record<string, any> = {}

  for (const [colTitle, linkedData] of Object.entries(ltarState)) {
    const column = meta.value.columns.find((c: ColumnType) => c.title === colTitle)
    if (!column) {
      resolvedState[colTitle] = linkedData
      continue
    }

    const colOptions = column.colOptions as LinkToAnotherRecordType
    const relatedTableId = colOptions?.fk_related_model_id

    if (!relatedTableId) {
      resolvedState[colTitle] = linkedData
      continue
    }

    if (Array.isArray(linkedData)) {
      const resolvedItems = []
      for (const item of linkedData) {
        if (item?._isBlueprint) {
          const { _isBlueprint, ...recordData } = item
          try {
            const created = await $api.dbTableRow.create('noco', base.value.id, relatedTableId, recordData)
            resolvedItems.push(created)
          } catch (e: any) {
            console.error(`Failed to create blueprint record in table ${relatedTableId}:`, e)
          }
        } else {
          resolvedItems.push(item)
        }
      }
      resolvedState[colTitle] = resolvedItems
    } else if (linkedData?._isBlueprint) {
      const { _isBlueprint, ...recordData } = linkedData
      try {
        const created = await $api.dbTableRow.create('noco', base.value.id, relatedTableId, recordData)
        resolvedState[colTitle] = created
      } catch (e: any) {
        console.error(`Failed to create blueprint record in table ${relatedTableId}:`, e)
      }
    } else {
      resolvedState[colTitle] = linkedData
    }
  }

  return resolvedState
}

const handleUseTemplate = async (tmpl: any) => {
  if (!base.value?.id || !meta.value?.id || !tmpl?.id) return
  try {
    const { fields, ltarState } = parseTemplateData(tmpl)

    // Resolve any blueprint records — create real records in linked tables first
    const resolvedLtarState = await resolveBlueprintsInLtarState(ltarState)

    // Create record via standard row creation API (handles LTAR/Links natively)
    await $api.dbTableRow.create('noco', base.value.id, meta.value.id, {
      ...fields,
      ...resolvedLtarState,
    })

    // Increment template usage count
    try {
      await $api.recordTemplates.recordTemplateUse(base.value.id, tmpl.id)
    } catch {
      // Usage count increment is non-critical
    }

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
      @click="onNewRecordToGridClick(path ?? [])"
    >
      <div class="flex flex-row flex-1 items-center justify-start gap-x-3">
        <component :is="viewIcons[ViewTypes.GRID]?.icon" class="nc-view-icon text-inherit" />
        {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.grid') }}
      </div>

      <GeneralIcon v-if="isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
    </NcMenuItem>
    <NcMenuItem v-e="['c:row:add:form']" class="nc-new-record-with-form group" @click="onNewRecordToFormClick(path ?? [])">
      <div class="flex flex-row items-center flex-1 justify-start gap-x-3">
        <component :is="viewIcons[ViewTypes.FORM]?.icon" class="nc-view-icon text-inherit" />
        {{ $t('activity.newRecord') }} - {{ $t('objects.viewType.form') }}
      </div>

      <GeneralIcon v-if="!isAddNewRecordGridMode" icon="check" class="w-4 h-4 text-primary" />
    </NcMenuItem>

    <!-- Record Templates (when available) -->
    <template v-if="templates.length > 0">
      <NcDivider />
      <NcMenuItem
        v-for="tmpl in templates"
        :key="tmpl.id"
        class="nc-template-menu-item"
        @click="handleUseTemplate(tmpl)"
      >
        <div class="flex items-center gap-2">
          <GeneralIcon icon="template" class="w-4 h-4" />
          <span class="truncate flex-1">{{ tmpl.title }}</span>
        </div>
      </NcMenuItem>
    </template>

    <!-- Manage Templates -->
    <NcDivider />
    <NcMenuItem class="nc-manage-templates" @click="onOpenTemplateManager?.()">
      <div class="flex items-center gap-2">
        <GeneralIcon icon="template" class="w-4 h-4" />
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
