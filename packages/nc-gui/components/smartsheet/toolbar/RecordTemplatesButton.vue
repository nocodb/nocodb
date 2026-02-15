<!--
  RecordTemplatesButton.vue — Toolbar button + Manage Templates modal

  This component provides:
  1. A toolbar button that opens the "Manage Templates" modal
  2. The modal itself: base-level listing of all record templates with
     search, table filter, sort, pagination, CRUD actions
  3. Template creation/editing via expanded form (in template mode)
  4. Template usage ("+") to create records with pre-filled values and sub-records

  Templates are stored at the base level (not table-scoped) so the manager
  shows templates across all tables. Each template has a `source_id` that
  references the table it belongs to.

  Sub-record blueprints: Templates can include LTAR blueprints that define
  linked records to create automatically. These support up to 3 levels of
  nesting (e.g., Project → Tasks → Sub-tasks).
-->
<script setup lang="ts">
import dayjs from 'dayjs'
import type { ColumnType, TableType } from 'nocodb-sdk'
import {
  countBlueprintsInLtarState,
  createRecordFromTemplate,
  parseRecordTemplateData,
} from '../../../composables/useRecordTemplate'
import type { NcTableColumnProps } from '../../../lib/types'

/** Shape of a record template as returned by the API */
interface TemplateType {
  id?: string
  title: string
  description?: string
  template_data: Record<string, any> | string
  /** Table ID this template belongs to (named source_id for historical reasons) */
  source_id?: string
  usage_count?: number
  enabled?: boolean
  created_by?: string
  created_at?: string
}

const isLocked = inject(IsLockedInj, ref(false))

const { meta } = useSmartsheetStoreOrThrow()
const { base } = storeToRefs(useBase())
const { baseTables } = storeToRefs(useTablesStore())
const { getMeta } = useMetas()
const { $api } = useNuxtApp()
const { t } = useI18n()
const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
const { open: openExpandedForm } = useExpandedFormDetached()

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Resolve a table ID (source_id) to its display name */
const getTableName = (sourceId?: string) => {
  if (!sourceId || !base.value?.id) return ''
  const tables = baseTables.value.get(base.value.id) || []
  return tables.find((t) => t.id === sourceId)?.title || ''
}

/** Count blueprint sub-records in a template (for the "Sub Records" column) */
const getSubRecordCount = (tmpl: TemplateType): number => {
  const { ltarState } = parseRecordTemplateData(tmpl)
  return countBlueprintsInLtarState(ltarState)
}

// ──────────────────────────────────────────────────────────────────────────────
// State
// ──────────────────────────────────────────────────────────────────────────────

const { showRecordTemplateManager: showManager, templates } = useRecordTemplate()
const showDeleteConfirm = ref(false)
const isLoading = ref(false)
const templateToDelete = ref<TemplateType | null>(null)
const searchQuery = ref('')
const selectedTableFilter = ref<string>('')
const orderBy = ref<Record<string, 'asc' | 'desc'>>({ title: 'asc' })
const currentPage = ref(1)
const PAGE_SIZE = 5

// Tables that have at least one template
const tablesWithTemplates = computed(() => {
  const tableIds = new Set(templates.value.map((t) => t.source_id).filter(Boolean))
  const tables = baseTables.value.get(base.value?.id || '') || []
  return tables.filter((t) => tableIds.has(t.id))
})

// --- Table Columns ---
const columns = computed<NcTableColumnProps[]>(() => [
  {
    key: 'enabled',
    title: '',
    width: 56,
    dataIndex: 'enabled',
  },
  {
    key: 'title',
    title: t('general.name'),
    minWidth: 200,
    dataIndex: 'title',
    showOrderBy: true,
  },
  {
    key: 'table',
    title: t('objects.table'),
    minWidth: 140,
    dataIndex: 'source_id',
    showOrderBy: true,
  },
  {
    key: 'sub_records',
    title: 'Sub Records',
    width: 120,
    dataIndex: 'sub_records',
    showOrderBy: true,
    headerCellClassName: 'whitespace-nowrap',
  },
  {
    key: 'created_at',
    title: 'Added On',
    minWidth: 160,
    basis: '15%',
    dataIndex: 'created_at',
    showOrderBy: true,
    headerCellClassName: 'whitespace-nowrap',
  },
  {
    key: 'usage_count',
    title: t('general.usage'),
    width: 100,
    dataIndex: 'usage_count',
    showOrderBy: true,
  },
  {
    key: 'action',
    title: t('labels.actions'),
    minWidth: 100,
    width: 100,
    justify: 'justify-end',
  },
])

// --- Computed ---
const filteredTemplates = computed(() => {
  let result = [...templates.value]

  // Apply table filter
  if (selectedTableFilter.value) {
    result = result.filter((t) => t.source_id === selectedTableFilter.value)
  }

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase()
    result = result.filter(
      (t) => t.title?.toLowerCase().includes(query) || getTableName(t.source_id).toLowerCase().includes(query),
    )
  }

  // Apply sort from NcTable orderBy
  const sortKeys = Object.keys(orderBy.value)
  if (sortKeys.length) {
    const sortKey = sortKeys[0]
    const sortDir = orderBy.value[sortKey]

    // Resolve the display/sort value for virtual columns (table name, sub-record count)
    const getSortValue = (tmpl: TemplateType): any => {
      if (sortKey === 'source_id') return getTableName(tmpl.source_id)
      if (sortKey === 'sub_records') return getSubRecordCount(tmpl)
      return (tmpl as any)[sortKey] ?? ''
    }

    result.sort((a, b) => {
      const aVal = getSortValue(a)
      const bVal = getSortValue(b)

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const compare = String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? compare : -compare
    })
  } else {
    // Default sort: usage_count desc, then created_at desc
    result.sort((a, b) => {
      if ((b.usage_count || 0) !== (a.usage_count || 0)) {
        return (b.usage_count || 0) - (a.usage_count || 0)
      }
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
    })
  }

  return result
})

// Client-side pagination
const paginatedTemplates = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredTemplates.value.slice(start, start + PAGE_SIZE)
})

// Reset to page 1 when search, sort, or table filter changes
watch([searchQuery, orderBy, selectedTableFilter], () => {
  currentPage.value = 1
})

// Next default template number
const nextTemplateNumber = computed(() => {
  const existingNumbers = templates.value
    .map((t) => {
      const match = t.title?.match(/^Record Template #(\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    })
    .filter((n) => n > 0)

  return existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1
})

// ──────────────────────────────────────────────────────────────────────────────
// API: Load templates (base-level)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all templates for the current base from the API.
 * Uses the base-level `/record-templates/all` endpoint (no table filter)
 * via a raw request because the SDK method hasn't been rebuilt yet.
 */
const loadTemplates = async () => {
  if (!base.value?.id) return
  isLoading.value = true
  try {
    const response = await ($api as any).request({
      path: `/api/v2/meta/bases/${base.value.id}/record-templates/all`,
      method: 'GET',
      format: 'json',
    })
    templates.value = (response as any)?.list || []
  } catch (e: any) {
    console.error(e)
    message.toast(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

// Load on mount so the shared template list is available to AddNewRowMenu immediately
onMounted(() => {
  loadTemplates()
})

// Always reload fresh data when the manager opens (backend cache may have stale data)
watch(showManager, (val) => {
  if (val) {
    orderBy.value = { title: 'asc' }
    loadTemplates()
  }
})

// ──────────────────────────────────────────────────────────────────────────────
// API: Save template (create or update)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Save a record template (create new or update existing).
 * Called by the expanded form's `createdRecord` callback when in template mode.
 *
 * @param rowData      - Row data from the expanded form (includes _templateName, _tableId, _ltarState)
 * @param editingTmpl  - Existing template being edited (null for new templates)
 */
const saveTemplate = async (rowData: Record<string, any>, editingTmpl: TemplateType | null) => {
  const tableId = rowData._tableId || meta.value?.id
  if (!base.value?.id || !tableId) return

  // Extract template name from the special _templateName field
  const title = rowData._templateName?.trim() || `Record Template #${nextTemplateNumber.value}`

  // Enforce unique template name per table (client-side check)
  const duplicate = templates.value.find(
    (t) =>
      t.title?.trim().toLowerCase() === title.toLowerCase() && t.id !== editingTmpl?.id && t.source_id === tableId,
  )
  if (duplicate) {
    message.toast(`A template with the name "${title}" already exists`)
    return
  }

  // Extract LTAR state (linked records) before filtering
  const ltarState = rowData._ltarState || {}

  // Filter out empty/null/system/internal fields
  const fields: Record<string, any> = {}
  for (const [key, val] of Object.entries(rowData)) {
    if (key.startsWith('_')) continue
    if (val !== '' && val !== null && val !== undefined && key !== 'ncRecordId') {
      fields[key] = val
    }
  }

  const body = {
    title,
    template_data: { fields, ltarState: Object.keys(ltarState).length ? ltarState : undefined },
  }

  try {
    if (editingTmpl?.id) {
      const updated = await $api.recordTemplates.recordTemplateUpdate(base.value.id, editingTmpl.id, body as any)
      const editId = editingTmpl.id
      templates.value = templates.value.map((t) =>
        t.id === editId ? { ...t, title: body.title, template_data: body.template_data, ...(updated || {}) } : t,
      )
      message.toast('Template updated')
    } else {
      const created = await $api.recordTemplates.recordTemplateCreate(base.value.id, tableId, body as any)
      templates.value = [
        ...templates.value,
        {
          title: body.title,
          template_data: body.template_data,
          usage_count: 0,
          created_at: new Date().toISOString(),
          ...(created || {}),
        } as TemplateType,
      ]
      message.toast('Template created')
    }
  } catch (e: any) {
    console.error(e)
    message.toast(await extractSdkResponseErrorMsg(e))
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────────────────────────────────────

const openManager = () => {
  showManager.value = true
}

/**
 * Open the expanded form in template mode for creating or editing a template.
 * When editing, pre-populates fields and ltarState from the existing template.
 * The form's table may differ from the current view's table for cross-table templates.
 */
const openTemplateForm = async (editingTmpl: TemplateType | null = null) => {
  const { fields: existingFields, ltarState } = editingTmpl
    ? parseRecordTemplateData(editingTmpl)
    : { fields: {}, ltarState: {} }
  const templateName = editingTmpl?.title || `Record Template #${nextTemplateNumber.value}`

  // Resolve the table meta for this template (may be a different table than the current one)
  let tableMeta: TableType | undefined
  if (editingTmpl?.source_id && editingTmpl.source_id !== meta.value?.id) {
    try {
      tableMeta = (await getMeta(base.value!.id!, editingTmpl.source_id)) as TableType
    } catch {
      message.toast('Failed to load table metadata for this template')
      return
    }
  }
  tableMeta = tableMeta || (meta.value as TableType)

  // Collect existing template names for duplicate validation per table (exclude current template when editing)
  const templateTableId = editingTmpl?.source_id || tableMeta.id
  const existingTemplateNames = templates.value
    .filter((t) => t.id !== editingTmpl?.id && t.source_id === templateTableId)
    .map((t) => t.title || '')

  openExpandedForm({
    isOpen: true,
    row: {
      row: { ...existingFields },
      oldRow: {},
      rowMeta: { new: true, ltarState: Object.keys(ltarState).length ? ltarState : undefined },
    },
    meta: tableMeta,
    state: Object.keys(ltarState).length ? ltarState : undefined,
    useMetaFields: true,
    skipReload: true,
    templateMode: true,
    templateName,
    existingTemplateNames,
    newRecordSubmitBtnText: editingTmpl ? 'Save Template' : 'Create Template',
    createdRecord: async (rowData: Record<string, any>) => {
      await saveTemplate(rowData, editingTmpl)
    },
  })
}

const handleDeleteClick = (tmpl: TemplateType) => {
  templateToDelete.value = tmpl
  showDeleteConfirm.value = true
}

const onDeleteConfirm = async () => {
  if (!templateToDelete.value?.id || !base.value?.id) return
  const deletedId = templateToDelete.value.id
  try {
    await $api.recordTemplates.recordTemplateDelete(base.value.id, deletedId)
    templates.value = templates.value.filter((t) => t.id !== deletedId)
    message.toast('Template deleted')
    showDeleteConfirm.value = false
    templateToDelete.value = null
  } catch (e: any) {
    console.error(e)
    message.toast(await extractSdkResponseErrorMsg(e))
  }
}

/**
 * Use a template to create a new record.
 * Resolves the correct table meta (template may belong to a different table),
 * delegates to shared createRecordFromTemplate, then updates local state.
 */
const handleUseTemplate = async (tmpl: TemplateType) => {
  if (!tmpl.id || !base.value?.id) return
  const tableId = tmpl.source_id || meta.value?.id
  if (!tableId) return
  try {
    // Resolve the table meta — template may belong to a different table than the current view
    let tableMeta: TableType | undefined
    if (tmpl.source_id && tmpl.source_id !== meta.value?.id) {
      tableMeta = (await getMeta(base.value.id!, tmpl.source_id)) as TableType
    }
    tableMeta = tableMeta || (meta.value as TableType)

    await createRecordFromTemplate({
      tmpl,
      api: $api,
      baseId: base.value.id,
      tableId,
      columns: (tableMeta.columns || []) as ColumnType[],
      getMeta,
    })

    // Update usage count in local state for immediate UI feedback
    templates.value = templates.value.map((t) =>
      t.id === tmpl.id ? { ...t, usage_count: (t.usage_count || 0) + 1 } : t,
    )

    message.toast('Record created from template')
    reloadViewDataHook?.trigger()
  } catch (e: any) {
    console.error(e)
    message.toast(await extractSdkResponseErrorMsg(e))
  }
}

const toggleEnabled = async (tmpl: TemplateType) => {
  if (!tmpl.id || !base.value?.id) return
  const newEnabled = tmpl.enabled === false
  try {
    await $api.recordTemplates.recordTemplateUpdate(base.value.id, tmpl.id, { enabled: newEnabled })
    templates.value = templates.value.map((t) => (t.id === tmpl.id ? { ...t, enabled: newEnabled } : t))
  } catch (e: any) {
    console.error(e)
    message.toast(await extractSdkResponseErrorMsg(e))
  }
}

const customRow = (record: Record<string, any>) => ({
  onclick: () => {
    openTemplateForm(record as TemplateType)
  },
})
</script>

<template>
  <div>
    <NcTooltip>
      <template #title>{{ $t('activity.manageTemplates') }}</template>
      <NcButton
        v-e="['c:record-templates']"
        class="nc-record-templates-btn nc-toolbar-btn !border-0 !h-7"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
        @click="openManager"
      >
        <div class="flex items-center gap-1 min-h-5">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12v-1h6v1"/><path d="M11 17h2"/><path d="M12 11v6"/></svg>
        </div>
      </NcButton>
    </NcTooltip>

    <!-- ==================== MANAGER MODAL ==================== -->
    <NcModal v-model:visible="showManager" centered :footer="null" size="small" :width="960" wrap-class-name="nc-modal-record-template-manager">
      <div class="flex flex-col gap-5 nc-record-templates-manager">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-base font-semibold text-nc-content-gray">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12v-1h6v1"/><path d="M11 17h2"/><path d="M12 11v6"/></svg>
            {{ $t('activity.manageTemplates') }}
          </div>
          <NcButton type="primary" size="small" @click="openTemplateForm()">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="plus" />
              <span>{{ $t('activity.createTemplate') }}</span>
            </div>
          </NcButton>
        </div>

        <!-- Search & Table Filter -->
        <div class="flex items-center gap-3">
          <a-input
            v-model:value="searchQuery"
            type="text"
            class="nc-search-template-input !min-w-[250px] !max-w-[400px] nc-input-sm flex-none"
            :placeholder="`${$t('general.search')} ${$t('objects.recordTemplates').toLowerCase()}`"
            allow-clear
          >
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
            </template>
          </a-input>
          <NcDropdown>
            <NcButton size="small" type="secondary">
              <div class="flex items-center gap-1.5">
                <GeneralIcon icon="table" class="h-4 w-4" />
                <span class="text-sm">{{ selectedTableFilter ? getTableName(selectedTableFilter) : 'All Tables' }}</span>
                <GeneralIcon icon="arrowDown" class="h-3.5 w-3.5 text-nc-content-gray-muted" />
              </div>
            </NcButton>
            <template #overlay>
              <NcMenu variant="small" class="!max-h-72 overflow-auto nc-scrollbar-thin">
                <NcMenuItem @click="selectedTableFilter = ''">
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="table" class="h-4 w-4 text-nc-content-gray-muted" />
                    <span>All Tables</span>
                    <GeneralIcon v-if="!selectedTableFilter" icon="check" class="h-4 w-4 ml-auto text-primary" />
                  </div>
                </NcMenuItem>
                <NcDivider />
                <NcMenuItem
                  v-for="table in tablesWithTemplates"
                  :key="table.id"
                  @click="selectedTableFilter = table.id"
                >
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="table" class="h-4 w-4 text-nc-content-gray-muted" />
                    <span class="truncate">{{ table.title }}</span>
                    <GeneralIcon
                      v-if="selectedTableFilter === table.id"
                      icon="check"
                      class="h-4 w-4 ml-auto text-primary"
                    />
                  </div>
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
        </div>

        <!-- Table -->
        <NcTable
          v-model:order-by="orderBy"
          :columns="columns"
          :data="paginatedTemplates"
          :is-data-loading="isLoading"
          sticky-first-column
          :custom-row="customRow"
          class="nc-record-templates-table"
        >
          <template #bodyCell="{ column, record: tmpl }">
            <!-- Enabled toggle -->
            <div v-if="column.key === 'enabled'" class="flex items-center" @click.stop>
              <NcSwitch :checked="tmpl.enabled !== false" size="small" @update:checked="toggleEnabled(tmpl)" />
            </div>

            <!-- Name -->
            <div v-if="column.key === 'title'" class="w-full flex items-center gap-3">
              <NcTooltip placement="bottom" class="truncate !text-nc-content-gray font-semibold" show-on-truncate-only>
                <template #title>{{ tmpl.title }}</template>
                {{ tmpl.title }}
              </NcTooltip>
            </div>

            <!-- Table -->
            <NcTooltip v-if="column.key === 'table'" placement="bottom" show-on-truncate-only class="truncate">
              <template #title>{{ getTableName(tmpl.source_id) }}</template>
              {{ getTableName(tmpl.source_id) }}
            </NcTooltip>

            <!-- Sub Records -->
            <span v-if="column.key === 'sub_records'" class="text-nc-content-gray-subtle2">
              {{ getSubRecordCount(tmpl) || '-' }}
            </span>

            <!-- Date Added -->
            <NcTooltip v-if="column.key === 'created_at'" placement="bottom" show-on-truncate-only class="truncate">
              <template #title>{{ dayjs(tmpl.created_at).local().format('DD MMM YYYY, HH:mm') }}</template>
              {{ dayjs(tmpl.created_at).local().format('DD MMM YYYY') }}
            </NcTooltip>

            <!-- Usage -->
            <span v-if="column.key === 'usage_count'" class="text-nc-content-gray-subtle2">
              {{ tmpl.usage_count || 0 }}
            </span>

            <!-- Actions -->
            <div v-if="column.key === 'action'" class="flex items-center justify-end" @click.stop>
              <div class="nc-template-action-btns flex">
                <NcTooltip>
                  <template #title>{{ $t('activity.useTemplate') }}</template>
                  <NcButton
                    size="small"
                    type="secondary"
                    class="!rounded-r-none !border-r-0"
                    @click="handleUseTemplate(tmpl)"
                  >
                    <GeneralIcon icon="plus" />
                  </NcButton>
                </NcTooltip>
                <NcDropdown placement="bottomRight">
                  <NcButton size="small" type="secondary" class="!rounded-l-none">
                    <GeneralIcon icon="threeDotVertical" />
                  </NcButton>
                  <template #overlay>
                    <NcMenu variant="small">
                      <NcMenuItem @click="openTemplateForm(tmpl)">
                        <GeneralIcon class="text-current opacity-80" icon="edit" />
                        <span>{{ $t('general.edit') }}</span>
                      </NcMenuItem>
                      <NcDivider />
                      <NcMenuItem class="!text-red-500" @click="handleDeleteClick(tmpl)">
                        <GeneralIcon icon="delete" />
                        {{ $t('general.delete') }}
                      </NcMenuItem>
                    </NcMenu>
                  </template>
                </NcDropdown>
              </div>
            </div>
          </template>

          <template #emptyText>
            <div class="flex flex-col items-center gap-4 py-8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-nc-content-gray-muted"
              >
                <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <path d="M9 12v-1h6v1" />
                <path d="M11 17h2" />
                <path d="M12 11v6" />
              </svg>
              <div class="text-sm font-semibold text-nc-content-gray-subtle">{{ $t('msg.info.noTemplates') }}</div>
              <div class="text-xs text-nc-content-gray-subtle2 max-w-xs text-center">{{ $t('msg.info.noTemplatesDesc') }}</div>
              <NcButton type="primary" size="small" @click="openTemplateForm()">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="plus" />
                  <span>{{ $t('activity.createTemplate') }}</span>
                </div>
              </NcButton>
            </div>
          </template>

          <template #tableFooter>
            <div class="flex flex-row justify-center items-center bg-nc-bg-gray-extralight min-h-10">
              <div v-if="filteredTemplates.length" class="flex justify-between items-center w-full px-6">
                <div class="text-nc-content-gray-muted text-xs">
                  {{ filteredTemplates.length }} {{ filteredTemplates.length === 1 ? 'template' : 'templates' }}
                </div>
                <NcPagination
                  v-if="filteredTemplates.length > PAGE_SIZE"
                  v-model:current="currentPage"
                  :total="filteredTemplates.length"
                  :page-size="PAGE_SIZE"
                  :use-stored-page-size="false"
                />
              </div>
            </div>
          </template>
        </NcTable>
      </div>
    </NcModal>

    <!-- ==================== DELETE CONFIRMATION ==================== -->
    <GeneralDeleteModal
      v-model:visible="showDeleteConfirm"
      :entity-name="$t('objects.recordTemplate')"
      :on-delete="onDeleteConfirm"
      :delete-label="$t('general.delete')"
    >
      <template #entity-preview>
        <div v-if="templateToDelete" class="flex flex-row items-center py-2 px-3.25 bg-gray-50 rounded-lg text-gray-700 mb-4">
          <span class="font-semibold truncate">{{ templateToDelete.title }}</span>
        </div>
      </template>
    </GeneralDeleteModal>
  </div>
</template>

<style scoped lang="scss">
.nc-record-templates-table {
  // Fixed table container height: 54px header + 5 × 54px rows + 40px footer = 364px
  // This ensures consistent modal height whether empty or with data
  :deep(.nc-table-container) {
    height: 364px;
  }

  // Force wrapper to fill the container minus footer (40px)
  // min-height prevents collapse when few rows exist
  :deep(.nc-table-wrapper) {
    min-height: calc(100% - 40px);
  }
}
</style>
