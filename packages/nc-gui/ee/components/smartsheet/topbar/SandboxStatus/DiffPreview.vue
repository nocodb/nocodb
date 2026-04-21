<script setup lang="ts">
interface Props {
  diff: { add?: Record<string, any[]>; delete?: Record<string, any[]>; update?: Record<string, any[]> } | null
  isLoading: boolean
}

const props = defineProps<Props>()

const { t } = useI18n()

// Root entities — shown as individual top-level rows with expandable titles
const rootTables: Record<string, { label: string; icon: string }> = {
  nc_models_v2: { label: 'Tables', icon: 'ncTable' },
  nc_columns_v2: { label: 'Fields', icon: 'ncColumns' },
  nc_views_v2: { label: 'Views', icon: 'ncEye' },
  nc_hooks_v2: { label: 'Webhooks', icon: 'ncWebhook' },
  nc_automations: { label: 'Automations', icon: 'ncZap' },
  nc_dashboards: { label: 'Dashboards', icon: 'ncDashboard' },
  nc_widgets: { label: 'Widgets', icon: 'ncWidget' },
  nc_base_variables: { label: 'Variables', icon: 'ncVariable' },
  nc_extensions_v2: { label: 'Extensions', icon: 'ncPuzzle' },
  nc_permissions: { label: 'Permissions', icon: 'ncLock' },
}

// Secondary config tables — shown grouped under expandable "Other changes"
const configLabels: Record<string, string> = {
  nc_grid_view_v2: 'Grid view settings',
  nc_grid_view_columns_v2: 'Grid column settings',
  nc_form_view_v2: 'Form view settings',
  nc_form_view_columns_v2: 'Form field settings',
  nc_gallery_view_v2: 'Gallery view settings',
  nc_gallery_view_columns_v2: 'Gallery column settings',
  nc_kanban_view_v2: 'Kanban view settings',
  nc_kanban_view_columns_v2: 'Kanban column settings',
  nc_calendar_view_v2: 'Calendar view settings',
  nc_calendar_view_columns_v2: 'Calendar column settings',
  nc_calendar_view_range_v2: 'Calendar ranges',
  nc_timeline_view_v2: 'Timeline view settings',
  nc_timeline_view_columns_v2: 'Timeline column settings',
  nc_timeline_view_range_v2: 'Timeline ranges',
  nc_map_view_v2: 'Map view settings',
  nc_map_view_columns_v2: 'Map column settings',
  nc_list_view_v2: 'List view settings',
  nc_list_view_columns_v2: 'List column settings',
  nc_list_view_levels_v2: 'List view levels',
  nc_filter_exp_v2: 'Filters',
  nc_sort_v2: 'Sorts',
  nc_view_sections: 'View sections',
  nc_disabled_models_for_role_v2: 'Role visibility',
  nc_row_color_conditions: 'Row coloring rules',
  nc_col_relations_v2: 'Link configurations',
  nc_col_formula_v2: 'Formula configurations',
  nc_col_lookup_v2: 'Lookup configurations',
  nc_col_rollup_v2: 'Rollup configurations',
  nc_col_select_options_v2: 'Select options',
  nc_col_qrcode_v2: 'QR code configurations',
  nc_col_barcode_v2: 'Barcode configurations',
  nc_col_button_v2: 'Button configurations',
  nc_col_long_text_v2: 'Long text / AI configurations',
  nc_col_props_v2: 'Column properties',
  nc_columns_validations_v2: 'Column validations',
  nc_permission_subjects: 'Permission subjects',
  nc_automation_executions: 'Automation executions',
  nc_automation_subscribers: 'Automation subscribers',
  nc_custom_urls_v2: 'Custom URLs',
  nc_sync_configs: 'Sync configurations',
  nc_sync_source_v2: 'Sync sources',
  nc_sync_mappings: 'Sync mappings',
  nc_sync_logs_v2: 'Sync logs',
  nc_mcp_tokens: 'MCP tokens',
  nc_date_dependency_v2: 'Date dependencies',
  nc_dependency_tracker: 'Dependency tracking',
  nc_hook_logs_v2: 'Webhook logs',
  nc_hook_trigger_fields: 'Webhook trigger fields',
  nc_shared_views_v2: 'Shared views',
  nc_sources_v2: 'Data sources',
  nc_rls_policies: 'Row-level security policies',
  nc_rls_policy_subjects: 'Row-level security subjects',
  nc_record_templates: 'Record templates',
  nc_model_stats_v2: 'Table statistics',
  nc_chat_sessions: 'Chat sessions',
  nc_chat_messages: 'Chat messages',
  nc_docs_v2: 'Documentation',
  nc_doc_content_v2: 'Doc content',
  nc_widgets_v2: 'Widget configurations',
}

interface DiffItem {
  title: string
  action: 'added' | 'updated' | 'deleted'
}

interface DiffGroup {
  key: string
  label: string
  icon: string
  added: number
  updated: number
  deleted: number
  total: number
  items: DiffItem[]
}

interface ConfigSubGroup {
  label: string
  added: number
  updated: number
  deleted: number
  total: number
}

const MAX_VISIBLE_ITEMS = 8

const getRecordTitle = (record: any): string => {
  return record.title || record.key || record.column_name || record.name || ''
}

// Root entity groups — each meta table is its own row
const rootGroups = computed<DiffGroup[]>(() => {
  if (!props.diff) return []

  const groups = new Map<string, DiffGroup>()

  for (const [action, tables] of [
    ['added', props.diff.add],
    ['updated', props.diff.update],
    ['deleted', props.diff.delete],
  ] as const) {
    if (!tables) continue
    for (const [tableName, records] of Object.entries(tables)) {
      if (!records?.length || !rootTables[tableName]) continue

      if (!groups.has(tableName)) {
        const meta = rootTables[tableName]
        groups.set(tableName, {
          key: tableName,
          label: meta.label,
          icon: meta.icon,
          added: 0,
          updated: 0,
          deleted: 0,
          total: 0,
          items: [],
        })
      }

      const group = groups.get(tableName)!
      if (action === 'added') group.added += records.length
      else if (action === 'updated') group.updated += records.length
      else if (action === 'deleted') group.deleted += records.length
      group.total = group.added + group.updated + group.deleted

      for (const record of records) {
        const title = getRecordTitle(record)
        if (title) {
          group.items.push({ title, action })
        }
      }
    }
  }

  const order = Object.keys(rootTables)
  return [...groups.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
})

// Config sub-groups — secondary tables shown under expandable section
const configGroups = computed<ConfigSubGroup[]>(() => {
  if (!props.diff) return []

  const groups = new Map<string, ConfigSubGroup>()

  for (const [action, tables] of [
    ['added', props.diff.add],
    ['updated', props.diff.update],
    ['deleted', props.diff.delete],
  ] as const) {
    if (!tables) continue
    for (const [tableName, records] of Object.entries(tables)) {
      if (!records?.length || rootTables[tableName]) continue

      const label = configLabels[tableName] || tableName

      if (!groups.has(tableName)) {
        groups.set(tableName, { label, added: 0, updated: 0, deleted: 0, total: 0 })
      }

      const group = groups.get(tableName)!
      if (action === 'added') group.added += records.length
      else if (action === 'updated') group.updated += records.length
      else if (action === 'deleted') group.deleted += records.length
      group.total = group.added + group.updated + group.deleted
    }
  }

  return [...groups.values()].sort((a, b) => b.total - a.total)
})

const configTotalChanges = computed(() => configGroups.value.reduce((sum, g) => sum.total, 0))

const totalChanges = computed(
  () => rootGroups.value.reduce((sum, g) => sum + g.total, 0) + configGroups.value.reduce((sum, g) => sum + g.total, 0),
)

const hasNoChanges = computed(() => !props.isLoading && totalChanges.value === 0)

const summaryParts = computed(() => {
  let added = 0
  let updated = 0
  let deleted = 0
  for (const g of [...rootGroups.value, ...configGroups.value]) {
    added += g.added
    updated += g.updated
    deleted += g.deleted
  }
  const parts: string[] = []
  if (added) parts.push(`${added} added`)
  if (updated) parts.push(`${updated} modified`)
  if (deleted) parts.push(`${deleted} removed`)
  return parts
})

const expandedGroups = ref<Set<string>>(new Set())

const toggleGroup = (key: string) => {
  if (expandedGroups.value.has(key)) {
    expandedGroups.value.delete(key)
  } else {
    expandedGroups.value.add(key)
  }
}

const isExpanded = (key: string) => expandedGroups.value.has(key)

const getVisibleItems = (group: DiffGroup) => group.items.slice(0, MAX_VISIBLE_ITEMS)

const getHiddenCount = (group: DiffGroup) => Math.max(0, group.items.length - MAX_VISIBLE_ITEMS)
</script>

<template>
  <div class="nc-sandbox-diff-preview">
    <!-- Loading skeleton -->
    <div v-if="isLoading" class="flex flex-col gap-3 py-4 px-3">
      <div v-for="i in 3" :key="i" class="flex items-center gap-3">
        <a-skeleton-input :active="true" size="small" class="!h-4 !rounded" :class="i === 1 ? '!w-24' : '!w-16'" />
        <a-skeleton-input :active="true" size="small" class="!w-10 !h-4 !rounded" />
      </div>
    </div>

    <!-- No changes -->
    <div v-else-if="hasNoChanges" class="flex items-center gap-2.5 py-4 px-3">
      <div class="flex items-center justify-center w-7 h-7 rounded-full bg-green-50">
        <GeneralIcon icon="check" class="w-4 h-4 text-green-600" />
      </div>
      <span class="text-sm text-nc-content-gray-subtle2">{{ t('labels.noSchemaChanges') }}</span>
    </div>

    <!-- Diff content -->
    <template v-else>
      <!-- Warning -->
      <div class="flex items-start gap-1.5 px-3 pt-2.5 pb-1">
        <GeneralIcon icon="ncAlertTriangle" class="w-3 h-3 text-nc-content-orange-dark mt-0.5 flex-none" />
        <span class="text-xs text-nc-content-gray-subtle2 leading-4">
          {{ t('labels.mergeSchemaChangesWarning') }}
        </span>
      </div>

      <!-- Summary count -->
      <div class="flex items-center gap-2 px-3 pb-1.5">
        <div class="flex items-center justify-center w-5 h-5 rounded-full bg-nc-bg-brand flex-none">
          <GeneralIcon icon="ncGitCommit" class="w-3 h-3 text-nc-content-brand" />
        </div>
        <span class="text-bodySm text-nc-content-gray-subtle font-medium">
          {{ totalChanges }} {{ totalChanges === 1 ? 'change' : 'changes' }}
        </span>
        <span class="text-nc-content-gray-subtle2 text-xs truncate">
          {{ summaryParts.join(', ') }}
        </span>
      </div>

      <!-- Root entity rows -->
      <div class="flex flex-col max-h-72 overflow-y-auto nc-scrollbar-thin px-1 pb-1">
        <template v-for="group in rootGroups" :key="group.key">
          <!-- Group header -->
          <div
            class="nc-diff-row flex items-center justify-between py-2 px-2 rounded-md transition-colors"
            :class="{ 'cursor-pointer': group.items.length > 0 }"
            @click="group.items.length > 0 && toggleGroup(group.key)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="flex items-center justify-center w-6 h-6 rounded-md bg-nc-bg-gray-light flex-none">
                <GeneralIcon :icon="group.icon" class="w-3.5 h-3.5 text-nc-content-gray-subtle" />
              </div>
              <span class="text-sm text-nc-content-gray font-medium truncate">{{ group.label }}</span>
              <GeneralIcon
                v-if="group.items.length > 0"
                icon="ncChevronDown"
                class="w-3 h-3 text-nc-content-gray-subtle2 transition-transform flex-none"
                :class="{ 'transform rotate-180': isExpanded(group.key) }"
              />
            </div>
            <div class="flex items-center gap-1">
              <div v-if="group.added" class="nc-diff-badge nc-diff-badge-add">+ {{ group.added }}</div>
              <div v-if="group.updated" class="nc-diff-badge nc-diff-badge-update">
                <GeneralIcon icon="ncEdit" class="w-2.5 h-2.5" />
                {{ group.updated }}
              </div>
              <div v-if="group.deleted" class="nc-diff-badge nc-diff-badge-delete">- {{ group.deleted }}</div>
            </div>
          </div>

          <!-- Expanded items -->
          <div v-if="isExpanded(group.key) && group.items.length" class="nc-diff-detail">
            <div v-for="(item, idx) in getVisibleItems(group)" :key="idx" class="nc-diff-detail-item">
              <span class="nc-diff-dot" :class="`nc-diff-dot-${item.action}`" />
              <span class="text-xs text-nc-content-gray truncate">{{ item.title }}</span>
              <span class="text-[10px] text-nc-content-gray-subtle2 flex-none ml-auto">
                {{ item.action === 'added' ? 'new' : item.action === 'deleted' ? 'removed' : 'changed' }}
              </span>
            </div>
            <div v-if="getHiddenCount(group) > 0" class="px-7 py-1">
              <span class="text-[11px] text-nc-content-gray-subtle2 italic">and {{ getHiddenCount(group) }} more...</span>
            </div>
          </div>
        </template>

        <!-- Other changes — secondary tables grouped -->
        <template v-if="configGroups.length">
          <div
            class="nc-diff-row flex items-center justify-between py-2 px-2 rounded-md transition-colors cursor-pointer"
            @click="toggleGroup('__configs')"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="flex items-center justify-center w-6 h-6 rounded-md bg-nc-bg-gray-light flex-none">
                <GeneralIcon icon="ncSettings" class="w-3.5 h-3.5 text-nc-content-gray-subtle" />
              </div>
              <span class="text-sm text-nc-content-gray-subtle font-medium truncate">Other changes</span>
              <GeneralIcon
                icon="ncChevronDown"
                class="w-3 h-3 text-nc-content-gray-subtle2 transition-transform flex-none"
                :class="{ 'transform rotate-180': isExpanded('__configs') }"
              />
            </div>
            <div class="flex items-center gap-1">
              <div v-if="configGroups.reduce((s, g) => s + g.added, 0)" class="nc-diff-badge nc-diff-badge-add">
                + {{ configGroups.reduce((s, g) => s + g.added, 0) }}
              </div>
              <div v-if="configGroups.reduce((s, g) => s + g.updated, 0)" class="nc-diff-badge nc-diff-badge-update">
                <GeneralIcon icon="ncEdit" class="w-2.5 h-2.5" />
                {{ configGroups.reduce((s, g) => s + g.updated, 0) }}
              </div>
              <div v-if="configGroups.reduce((s, g) => s + g.deleted, 0)" class="nc-diff-badge nc-diff-badge-delete">
                - {{ configGroups.reduce((s, g) => s + g.deleted, 0) }}
              </div>
            </div>
          </div>

          <!-- Expanded config sub-rows -->
          <div v-if="isExpanded('__configs')" class="nc-diff-detail">
            <div v-for="sub in configGroups" :key="sub.label" class="nc-diff-detail-item justify-between">
              <span class="text-xs text-nc-content-gray truncate">{{ sub.label }}</span>
              <div class="flex items-center gap-1 flex-none">
                <span v-if="sub.added" class="text-[10px] text-green-600 font-medium">+{{ sub.added }}</span>
                <span v-if="sub.updated" class="text-[10px] text-orange-600 font-medium">~{{ sub.updated }}</span>
                <span v-if="sub.deleted" class="text-[10px] text-red-500 font-medium">-{{ sub.deleted }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-sandbox-diff-preview {
  @apply bg-nc-bg-gray-extralight rounded-xl border-1 border-nc-border-gray-medium mt-1;
}

.nc-diff-row:hover {
  @apply bg-white;
}

.nc-diff-badge {
  @apply inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold leading-tight select-none;
  min-width: 28px;
  justify-content: center;

  &-add {
    @apply bg-green-100 text-green-700;
  }
  &-update {
    @apply bg-orange-100 text-orange-700;
  }
  &-delete {
    @apply bg-red-100 text-red-700;
  }
}

.nc-diff-detail {
  @apply ml-5 mb-1 border-l-2 border-nc-border-gray-medium;

  .nc-diff-detail-item {
    @apply flex items-center gap-2 py-1 px-3;
  }
}

.nc-diff-dot {
  @apply w-1.5 h-1.5 rounded-full flex-none;

  &-added {
    @apply bg-green-500;
  }
  &-updated {
    @apply bg-orange-400;
  }
  &-deleted {
    @apply bg-red-400;
  }
}
</style>
