<script setup lang="ts">
import dayjs from 'dayjs'
import type { TableType } from 'nocodb-sdk'
import type { NcTableColumnProps } from '../../../lib/types'

interface TemplateType {
  id?: string
  title: string
  description?: string
  template_data: Record<string, any> | string
  usage_count?: number
  enabled?: boolean
  created_by?: string
  created_at?: string
}

const isLocked = inject(IsLockedInj, ref(false))

const { meta } = useSmartsheetStoreOrThrow()
const { base } = storeToRefs(useBase())
const { $api } = useNuxtApp()
const { t } = useI18n()
const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
const { open: openExpandedForm } = useExpandedFormDetached()

// --- State ---
const { showRecordTemplateManager: showManager } = useRecordTemplate()
const showDeleteConfirm = ref(false)

const templates = ref<TemplateType[]>([])
const isLoading = ref(false)
const templateToDelete = ref<TemplateType | null>(null)
const searchQuery = ref('')
const orderBy = ref<Record<string, 'asc' | 'desc'>>({})
const currentPage = ref(1)
const PAGE_SIZE = 5

// --- Table Columns ---
const columns = computed<NcTableColumnProps[]>(() => [
  {
    key: 'title',
    title: t('general.name'),
    minWidth: 200,
    dataIndex: 'title',
    showOrderBy: true,
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
    key: 'enabled',
    title: t('general.enabled'),
    width: 100,
    dataIndex: 'enabled',
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

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase()
    result = result.filter((t) => t.title?.toLowerCase().includes(query))
  }

  // Apply sort from NcTable orderBy
  const sortKeys = Object.keys(orderBy.value)
  if (sortKeys.length) {
    const sortKey = sortKeys[0] as keyof TemplateType
    const sortDir = orderBy.value[sortKeys[0]]
    result.sort((a, b) => {
      let aVal: any = a[sortKey] ?? ''
      let bVal: any = b[sortKey] ?? ''

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

// Reset to page 1 when search or sort changes
watch([searchQuery, orderBy], () => {
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

// --- API ---
const loadTemplates = async () => {
  if (!base.value?.id || !meta.value?.id) return
  isLoading.value = true
  try {
    const response = await $api.recordTemplates.recordTemplateList(base.value.id, meta.value.id)
    templates.value = (response as any)?.list || []
  } catch (e: any) {
    console.error(e)
    message.toast(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

// Watch for external opens (e.g. from AddNewRowMenu dropdown)
watch(showManager, (val) => {
  if (val && !templates.value.length) {
    loadTemplates()
  }
})

// --- Helpers ---
const parseTemplateData = (tmpl: TemplateType): { fields: Record<string, any>; ltarState: Record<string, any> } => {
  const data = typeof tmpl.template_data === 'string' ? JSON.parse(tmpl.template_data) : tmpl.template_data || {}
  return {
    fields: data.fields || {},
    ltarState: data.ltarState || {},
  }
}

const saveTemplate = async (rowData: Record<string, any>, editingTmpl: TemplateType | null) => {
  const tableId = rowData._tableId || meta.value?.id
  if (!base.value?.id || !tableId) return

  // Extract template name from the special _templateName field
  const title = rowData._templateName?.trim() || `Record Template #${nextTemplateNumber.value}`

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

// --- Handlers ---
const openManager = () => {
  showManager.value = true
  loadTemplates()
}

const openTemplateForm = (editingTmpl: TemplateType | null = null) => {
  const { fields: existingFields, ltarState } = editingTmpl
    ? parseTemplateData(editingTmpl)
    : { fields: {}, ltarState: {} }
  const templateName = editingTmpl?.title || `Record Template #${nextTemplateNumber.value}`

  openExpandedForm({
    isOpen: true,
    row: {
      row: { ...existingFields },
      oldRow: {},
      rowMeta: { new: true, ltarState: Object.keys(ltarState).length ? ltarState : undefined },
    },
    meta: meta.value as TableType,
    state: Object.keys(ltarState).length ? ltarState : undefined,
    useMetaFields: true,
    skipReload: true,
    templateMode: true,
    templateName,
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

const handleUseTemplate = async (tmpl: TemplateType) => {
  if (!tmpl.id || !base.value?.id || !meta.value?.id) return
  try {
    const { fields, ltarState } = parseTemplateData(tmpl)

    // Create record via standard row creation API (handles LTAR/Links natively)
    await $api.dbTableRow.create('noco', base.value.id, meta.value.id, {
      ...fields,
      ...ltarState,
    })

    // Increment template usage count
    try {
      await $api.recordTemplates.recordTemplateUse(base.value.id, tmpl.id)
    } catch {
      // Usage count increment is non-critical
    }

    message.toast('Record created from template')
    showManager.value = false
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
    await $api.recordTemplates.recordTemplateUpdate(base.value.id, tmpl.id, { enabled: newEnabled } as any)
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
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12v-1h6v1" /><path d="M11 17h2" /><path d="M12 11v6" /></svg>
        </div>
      </NcButton>
    </NcTooltip>

    <!-- ==================== MANAGER MODAL ==================== -->
    <NcModal v-model:visible="showManager" centered :footer="null" size="small" :width="960" wrap-class-name="nc-modal-record-template-manager">
      <div class="flex flex-col gap-5 nc-record-templates-manager">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-base font-semibold text-nc-content-gray">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12v-1h6v1" /><path d="M11 17h2" /><path d="M12 11v6" /></svg>
            {{ $t('objects.recordTemplates') }}
          </div>
          <NcButton type="primary" size="small" @click="openTemplateForm()">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="plus" />
              <span>{{ $t('activity.createTemplate') }}</span>
            </div>
          </NcButton>
        </div>

        <!-- Search -->
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
            <!-- Name -->
            <div v-if="column.key === 'title'" class="w-full flex items-center gap-3">
              <NcTooltip placement="bottom" class="truncate !text-nc-content-gray font-semibold" show-on-truncate-only>
                <template #title>{{ tmpl.title }}</template>
                {{ tmpl.title }}
              </NcTooltip>
            </div>

            <!-- Date Added -->
            <NcTooltip v-if="column.key === 'created_at'" placement="bottom" show-on-truncate-only class="truncate">
              <template #title>{{ dayjs(tmpl.created_at).local().format('DD MMM YYYY, HH:mm') }}</template>
              {{ dayjs(tmpl.created_at).local().format('DD MMM YYYY') }}
            </NcTooltip>

            <!-- Usage -->
            <span v-if="column.key === 'usage_count'" class="text-nc-content-gray-subtle2">
              {{ tmpl.usage_count || 0 }}
            </span>

            <!-- Enabled toggle -->
            <div v-if="column.key === 'enabled'" class="flex items-center" @click.stop>
              <NcSwitch :checked="tmpl.enabled !== false" size="small" @update:checked="toggleEnabled(tmpl)" />
            </div>

            <!-- Actions -->
            <div v-if="column.key === 'action'" class="flex items-center justify-end" @click.stop>
              <NcDropdown placement="bottomRight">
                <NcButton size="small" type="secondary">
                  <GeneralIcon icon="threeDotVertical" />
                </NcButton>
                <template #overlay>
                  <NcMenu variant="small">
                    <NcMenuItem @click="handleUseTemplate(tmpl)">
                      <GeneralIcon class="text-current opacity-80" icon="plus" />
                      <span>{{ $t('activity.useTemplate') }}</span>
                    </NcMenuItem>
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
