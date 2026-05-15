<script lang="ts" setup>
import { PlanFeatureTypes, UITypes, isLinksOrLTAR, pickFields } from 'nocodb-sdk'
import type { ColumnType, DateDependencyReqType, DateDependencyType, LinkToAnotherRecordType } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  tableId: string
  title?: string
  // When set, the dialog operates on a Gantt-view-owned DateDependency rule
  // (fk_gantt_view_id = ganttViewId) instead of the table-level default.
  // Used by the Gantt view's "Configure" / setup wizard flow.
  ganttViewId?: string
}>()

const emits = defineEmits(['update:visible', 'saved'])

const visible = useVModel(props, 'visible', emits)

const { $api } = useNuxtApp()

const { t } = useI18n()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const basesStore = useBases()

const { activeProjectId, openedProject } = storeToRefs(basesStore)

const tablesStore = useTablesStore()

const { baseTables } = storeToRefs(tablesStore)

const { loadTableMeta } = tablesStore

const isSaving = ref(false)

const saveError = ref('')

const defaultForm: DateDependencyReqType = {
  is_active: true,
  fk_start_date_field_id: null,
  fk_end_date_field_id: null,
  fk_duration_field_id: null,
  fk_dependency_linkrow_field_id: null,
  dependency_connection_type: 'end-to-start',
  dependency_buffer_type: 'none',
  dependency_buffer_days: 0,
  include_weekends: true,
}

const form = reactive<DateDependencyReqType>({ ...defaultForm })

const savedForm = ref<DateDependencyReqType>({ ...defaultForm })

const hasChanges = computed(() => {
  const keys = Object.keys(defaultForm) as (keyof DateDependencyReqType)[]
  return keys.some((k) => form[k] !== savedForm.value[k])
})

const tableMeta = computed(() => {
  if (!activeProjectId.value) return null
  return (baseTables.value.get(activeProjectId.value) ?? []).find((t) => t.id === props.tableId)
})

// Per-Gantt-view rule (fetched on dialog open when ganttViewId is set).
// When this mode is active, the dialog reads + writes the view-owned rule
// instead of the table-level default. Existing call sites that open the
// dialog without ganttViewId keep editing the table-level rule unchanged.
const viewRule = ref<DateDependencyType | null>(null)

const rule = computed<DateDependencyType | null>(() => {
  if (props.ganttViewId) return viewRule.value
  return tableMeta.value?.date_dependency ?? null
})

const tableColumns = computed<ColumnType[]>(() => tableMeta.value?.columns ?? [])

const startDateOptions = computed(() =>
  tableColumns.value
    .filter((c) => c.uidt === UITypes.Date && c.id !== form.fk_end_date_field_id)
    .map((c) => ({ value: c.id, label: c.title, col: c })),
)

const endDateOptions = computed(() =>
  tableColumns.value
    .filter((c) => c.uidt === UITypes.Date && c.id !== form.fk_start_date_field_id)
    .map((c) => ({ value: c.id, label: c.title, col: c })),
)

const durationOptions = computed(() =>
  tableColumns.value
    .filter((c) => [UITypes.Duration, UITypes.Number].includes(c.uidt as UITypes))
    .map((c) => ({ value: c.id, label: c.title, col: c })),
)

// Only show self-referencing HM/OM/OO link columns — BT/MO/MM cannot be used as predecessor links
// hm = Has Many (v1), om = One to Many (v2), oo = One to One
const linkOptions = computed(() =>
  tableColumns.value
    .filter((c) => {
      if (!isLinksOrLTAR(c)) return false
      const opts = (c.colOptions as LinkToAnotherRecordType) ?? {}
      return ['hm', 'om', 'oo'].includes(opts.type as string) && opts.fk_related_model_id === props.tableId
    })
    .map((c) => ({ value: c.id, label: c.title, col: c })),
)

const tableSource = computed(() => openedProject.value?.sources?.find((s) => s.id === tableMeta.value?.source_id))

const cascadeAvailable = computed(() => {
  const s = tableSource.value
  return s?.type === 'pg' || s?.type === 'mysql2'
})

const connectionTypeOptions = computed(() => [
  {
    value: 'end-to-start',
    label: t('labels.dateDependency.connectionTypes.end-to-start'),
    description: t('labels.dateDependency.connectionTypeDescriptions.end-to-start'),
  },
  {
    value: 'end-to-end',
    label: t('labels.dateDependency.connectionTypes.end-to-end'),
    description: t('labels.dateDependency.connectionTypeDescriptions.end-to-end'),
  },
  {
    value: 'start-to-start',
    label: t('labels.dateDependency.connectionTypes.start-to-start'),
    description: t('labels.dateDependency.connectionTypeDescriptions.start-to-start'),
  },
  {
    value: 'start-to-end',
    label: t('labels.dateDependency.connectionTypes.start-to-end'),
    description: t('labels.dateDependency.connectionTypeDescriptions.start-to-end'),
  },
])

const schedulingModeOptions = computed(() => [
  {
    value: 'none',
    label: t('labels.dateDependency.schedulingModes.off'),
    description: t('labels.dateDependency.schedulingModeDescriptions.off'),
  },
  {
    value: 'flexible',
    label: t('labels.dateDependency.schedulingModes.flexible'),
    description: t('labels.dateDependency.schedulingModeDescriptions.flexible'),
  },
  {
    value: 'fixed',
    label: t('labels.dateDependency.schedulingModes.fixed'),
    description: t('labels.dateDependency.schedulingModeDescriptions.fixed'),
  },
])

// Inline validation
const startEndSameFieldError = computed(() => {
  if (form.fk_start_date_field_id && form.fk_end_date_field_id && form.fk_start_date_field_id === form.fk_end_date_field_id) {
    return t('labels.dateDependency.validation.sameStartEnd')
  }
  return ''
})

const missingRequiredFields = computed(() => {
  if (!form.is_active) return false
  return !form.fk_start_date_field_id || !form.fk_end_date_field_id
})

const hasValidationErrors = computed(() => !!startEndSameFieldError.value || missingRequiredFields.value)

function cancel() {
  Object.assign(form, { ...savedForm.value })
  saveError.value = ''
  visible.value = false
}

async function save() {
  if (!activeWorkspaceId.value || !activeProjectId.value) return
  if (hasValidationErrors.value) return

  isSaving.value = true
  saveError.value = ''
  try {
    // Scope the operation to either the table-level default rule or a Gantt
    // view's own rule. The backend uses fk_gantt_view_id to disambiguate.
    const opQuery: Record<string, string | undefined> = {
      operation: 'updateDateDependency',
      fk_model_id: props.tableId,
    }
    if (props.ganttViewId) opQuery.fk_gantt_view_id = props.ganttViewId

    const body = {
      ...pickFields(form, Object.keys(defaultForm) as (keyof DateDependencyReqType)[]),
      dependency_buffer_days: Number(form.dependency_buffer_days) || 0,
    }
    const result = await $api.internal.postOperation(
      activeWorkspaceId.value,
      activeProjectId.value,
      opQuery,
      body,
    )

    if (props.ganttViewId) {
      // Gantt-view-owned rule: update local cache + let the caller refresh
      // its view-meta so the Gantt store's ganttRange recomputes.
      viewRule.value = { ...(rule.value ?? {}), ...form, ...result } as DateDependencyType
      emits('saved', viewRule.value)
    } else if (tableMeta.value) {
      // Table-level default rule (existing path).
      tableMeta.value.date_dependency = { ...rule.value, ...form, ...result }
    }
    savedForm.value = { ...form }
    visible.value = false
  } catch (e: any) {
    saveError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isSaving.value = false
  }
}

function syncFormFromRule() {
  const initial = rule.value ? { ...defaultForm, ...rule.value } : { ...defaultForm }
  initial.dependency_buffer_days = Number(initial.dependency_buffer_days) || 0
  Object.assign(form, initial)
  savedForm.value = { ...initial }
}

watch(visible, async (val) => {
  if (val) {
    await loadTableMeta(props.tableId)

    // Per-Gantt-view mode: fetch the view-owned rule directly. The table
    // meta only carries the default rule; per-view rules are loaded with
    // GanttView.get on the backend but the table-meta path doesn't expose
    // them, so we fetch via internal op here.
    if (props.ganttViewId && activeWorkspaceId.value && activeProjectId.value) {
      try {
        viewRule.value = (await $api.internal.getOperation(
          activeWorkspaceId.value,
          activeProjectId.value,
          {
            operation: 'getDateDependency',
            fk_model_id: props.tableId,
            fk_gantt_view_id: props.ganttViewId,
          } as any,
        )) as DateDependencyType | null
      } catch {
        viewRule.value = null
      }
    } else {
      viewRule.value = null
    }

    syncFormFromRule()
    // Per-Gantt-view rules must always be active — the dialog's enable
    // toggle is hidden in that mode, so guarantee the saved value is true
    // even if an older rule was persisted with is_active=false.
    if (props.ganttViewId) {
      form.is_active = true
      savedForm.value = { ...savedForm.value, is_active: true }
    }
    saveError.value = ''
  }
})

watch(rule, () => {
  if (!visible.value) return
  if (hasChanges.value) return
  syncFormFromRule()
})
</script>

<template>
  <NcModal v-model:visible="visible" size="sm" height="auto" wrap-class-name="nc-modal-date-dependency">
    <template #header>
      <span class="text-heading3">
        {{ ganttViewId ? $t('labels.dateDependency.titleGantt') : $t('labels.dateDependency.title') }}
      </span>
    </template>

    <div class="flex flex-col" style="min-height: 200px; max-height: 70vh">
      <div class="flex-1 overflow-y-auto px-1 pb-2">
        <!-- Description + Enable toggle — only when configuring the
             table-level default rule. In the per-Gantt-view flow the rule
             must be active (otherwise the Gantt has nothing to render),
             so we skip the description blurb and the on/off switch. -->
        <template v-if="!ganttViewId">
          <p class="text-bodySm text-nc-content-gray-subtle mb-4">
            {{ $t('labels.dateDependency.description') }}
            <a
              href="https://nocodb.com/docs/product-docs/tables/date-dependency"
              target="_blank"
              rel="noopener noreferrer"
              class="text-nc-content-brand hover:underline"
            >
              {{ $t('labels.dateDependency.learnMore') }}
            </a>
          </p>

          <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_DATE_DEPENDENCY">
            <template #default="{ click }">
              <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-nc-bg-gray-light mb-5">
                <span class="text-bodySm font-semibold text-nc-content-gray-subtle">
                  {{ $t('labels.dateDependency.isActive') }}
                </span>
                <div class="flex items-center gap-2">
                  <NcSwitch
                    v-model:checked="form.is_active"
                    v-e="['c:date-dependency:toggle']"
                    @click="click(PlanFeatureTypes.FEATURE_DATE_DEPENDENCY, () => {})"
                  />
                  <PaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_DATE_DEPENDENCY" />
                </div>
              </div>
            </template>
          </PaymentUpgradeBadgeProvider>
        </template>

        <template v-if="form.is_active || ganttViewId">
        <div class="space-y-4">
          <!-- Field Mapping section -->
          <div>
            <div class="nc-date-dep-section-header">
              {{ $t('labels.dateDependency.fieldMapping') }}
            </div>
            <div class="grid grid-cols-2 gap-x-6 gap-y-4">
            <!-- Start date -->
            <div>
              <div class="nc-date-dep-label">
                {{ $t('labels.dateDependency.startDateField') }}
              </div>
              <a-select
                v-model:value="form.fk_start_date_field_id"
                class="w-full"
                :class="{ 'nc-select-error': startEndSameFieldError }"
                allow-clear
                :placeholder="$t('placeholder.notSelected')"
              >
                <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" /></template>
                <a-select-option v-for="opt in startDateOptions" :key="opt.value" :value="opt.value">
                  <div class="w-full flex gap-2 items-center justify-between">
                    <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                      <SmartsheetHeaderIcon :column="opt.col" />
                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>{{ opt.label }}</template>
                        {{ opt.label }}
                      </NcTooltip>
                    </div>
                    <GeneralIcon
                      v-if="opt.value === form.fk_start_date_field_id"
                      id="nc-selected-item-icon"
                      icon="check"
                      class="flex-none text-primary w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </a-select>
            </div>

            <!-- End date -->
            <div>
              <div class="nc-date-dep-label">
                {{ $t('labels.dateDependency.endDateField') }}
              </div>
              <a-select
                v-model:value="form.fk_end_date_field_id"
                class="w-full"
                :class="{ 'nc-select-error': startEndSameFieldError }"
                allow-clear
                :placeholder="$t('placeholder.notSelected')"
              >
                <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" /></template>
                <a-select-option v-for="opt in endDateOptions" :key="opt.value" :value="opt.value">
                  <div class="w-full flex gap-2 items-center justify-between">
                    <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                      <SmartsheetHeaderIcon :column="opt.col" />
                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>{{ opt.label }}</template>
                        {{ opt.label }}
                      </NcTooltip>
                    </div>
                    <GeneralIcon
                      v-if="opt.value === form.fk_end_date_field_id"
                      id="nc-selected-item-icon"
                      icon="check"
                      class="flex-none text-primary w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </a-select>
            </div>
            </div>

            <!-- Inline validation: same field error -->
            <div v-if="startEndSameFieldError" class="nc-date-dep-error mt-2">
              {{ startEndSameFieldError }}
            </div>

            <div class="grid grid-cols-2 gap-x-6 gap-y-4 mt-4">
            <!-- Duration -->
            <div>
              <div class="nc-date-dep-label">
                {{ $t('labels.dateDependency.durationField') }}
              </div>
              <a-select
                v-model:value="form.fk_duration_field_id"
                class="w-full"
                allow-clear
                :placeholder="$t('placeholder.notSelected')"
              >
                <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" /></template>
                <a-select-option v-for="opt in durationOptions" :key="opt.value" :value="opt.value">
                  <div class="w-full flex gap-2 items-center justify-between">
                    <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                      <SmartsheetHeaderIcon :column="opt.col" />
                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>{{ opt.label }}</template>
                        {{ opt.label }}
                      </NcTooltip>
                    </div>
                    <GeneralIcon
                      v-if="opt.value === form.fk_duration_field_id"
                      id="nc-selected-item-icon"
                      icon="check"
                      class="flex-none text-primary w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </a-select>
              <div class="nc-date-dep-hint">
                {{ $t('labels.dateDependency.durationFieldHint') }}
              </div>
            </div>

            <!-- Predecessors -->
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="nc-date-dep-label !mb-0">
                  {{ $t('labels.dateDependency.linkRowField') }}
                </span>
                <span class="text-bodySm text-nc-content-gray-subtle">{{ $t('general.optional') }}</span>
              </div>
              <a-select
                v-model:value="form.fk_dependency_linkrow_field_id"
                class="w-full"
                allow-clear
                :placeholder="$t('placeholder.notSelected')"
              >
                <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" /></template>
                <a-select-option v-for="opt in linkOptions" :key="opt.value" :value="opt.value">
                  <div class="w-full flex gap-2 items-center justify-between">
                    <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                      <SmartsheetHeaderIcon :column="opt.col" />
                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>{{ opt.label }}</template>
                        {{ opt.label }}
                      </NcTooltip>
                    </div>
                    <GeneralIcon
                      v-if="opt.value === form.fk_dependency_linkrow_field_id"
                      id="nc-selected-item-icon"
                      icon="check"
                      class="flex-none text-primary w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </a-select>
              <div class="nc-date-dep-hint">
                {{ $t('labels.dateDependency.linkRowFieldHint') }}
              </div>
            </div>
            </div>
          </div>

          <!-- Include Weekends -->
          <div class="flex items-center gap-2">
            <NcSwitch v-model:checked="form.include_weekends" size="small" />
            <span class="text-bodySm text-nc-content-gray-subtle">{{ $t('labels.dateDependency.includeWeekends') }}</span>
            <NcTooltip>
              <template #title>{{ $t('labels.dateDependency.includeWeekendsHint') }}</template>
              <GeneralIcon icon="info" class="text-nc-content-gray-subtle w-3.5 h-3.5 cursor-help" />
            </NcTooltip>
          </div>

          <!-- Row-to-row propagation — only when predecessor link selected -->
          <template v-if="form.fk_dependency_linkrow_field_id">
            <NcDivider class="!my-1" />

            <div class="nc-date-dep-section-header">
              {{ $t('labels.dateDependency.propagationSection') }}
            </div>

            <NcTooltip :disabled="cascadeAvailable" :title="$t('labels.dateDependency.cascadeNotSupported')">
              <div class="flex flex-col gap-4" :class="{ 'opacity-50 pointer-events-none': !cascadeAvailable }">
                <div class="grid grid-cols-2 gap-x-6 gap-y-4">
                  <!-- Connection Type -->
                  <div>
                    <div class="nc-date-dep-label">
                      {{ $t('labels.dateDependency.connectionType') }}
                    </div>
                    <NcSelect
                      v-model:value="form.dependency_connection_type"
                      class="w-full"
                      :disabled="!cascadeAvailable"
                      :dropdown-match-select-width="false"
                      dropdown-class-name="nc-date-dep-rich-dropdown"
                      option-label-prop="label"
                    >
                      <a-select-option
                        v-for="opt in connectionTypeOptions"
                        :key="opt.value"
                        :value="opt.value"
                        :label="opt.label"
                      >
                        <div class="flex flex-col gap-0.5">
                          <div class="flex items-center justify-between gap-2">
                            <span class="text-bodySm font-semibold text-nc-content-gray">{{ opt.label }}</span>
                            <GeneralIcon
                              v-if="opt.value === form.dependency_connection_type"
                              icon="check"
                              class="flex-none text-nc-content-brand w-4 h-4"
                            />
                          </div>
                          <span class="text-bodySm text-nc-content-gray-subtle">{{ opt.description }}</span>
                        </div>
                      </a-select-option>
                    </NcSelect>
                  </div>

                  <!-- Scheduling Mode -->
                  <div>
                    <div class="nc-date-dep-label">
                      {{ $t('labels.dateDependency.schedulingMode') }}
                    </div>
                    <NcSelect
                      v-model:value="form.dependency_buffer_type"
                      class="w-full"
                      :disabled="!cascadeAvailable"
                      :dropdown-match-select-width="false"
                      dropdown-class-name="nc-date-dep-rich-dropdown"
                      option-label-prop="label"
                    >
                      <a-select-option
                        v-for="opt in schedulingModeOptions"
                        :key="opt.value"
                        :value="opt.value"
                        :label="opt.label"
                      >
                        <div class="flex flex-col gap-0.5">
                          <div class="flex items-center justify-between gap-2">
                            <span class="text-bodySm font-semibold text-nc-content-gray">{{ opt.label }}</span>
                            <GeneralIcon
                              v-if="opt.value === form.dependency_buffer_type"
                              icon="check"
                              class="flex-none text-nc-content-brand w-4 h-4"
                            />
                          </div>
                          <span class="text-bodySm text-nc-content-gray-subtle">{{ opt.description }}</span>
                        </div>
                      </a-select-option>
                    </NcSelect>
                  </div>

                  <div v-if="form.dependency_buffer_type !== 'none'">
                    <div class="nc-date-dep-label">
                      {{ $t('labels.dateDependency.bufferDays') }}
                    </div>
                    <NcNonNullableNumberInput v-model="form.dependency_buffer_days" :min="0" :disabled="!cascadeAvailable" />
                    <div class="nc-date-dep-hint">
                      {{ $t('labels.dateDependency.bufferDaysHint') }}
                    </div>
                  </div>
                </div>
              </div>
            </NcTooltip>
          </template>
        </div>
        </template>
      </div>

      <div class="flex items-center justify-between pt-3 border-t-1 border-nc-border-gray-medium mt-2">
        <div v-if="saveError" class="text-bodySm text-nc-content-red truncate max-w-[60%]">
          {{ saveError }}
        </div>
        <div v-else />

        <div class="flex items-center gap-2">
          <NcButton type="secondary" size="small" @click="cancel">
            {{ $t('general.cancel') }}
          </NcButton>
          <NcButton
            v-e="['c:date-dependency:save']"
            type="primary"
            size="small"
            :loading="isSaving"
            :disabled="(!hasChanges && !ganttViewId) || hasValidationErrors"
            @click="save"
          >
            {{ $t('general.save') }}
          </NcButton>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
// ── Consistent typography tokens for the modal ──
// Label: 13px/semibold — field labels, section field labels
.nc-date-dep-label {
  @apply text-bodySm font-semibold text-nc-content-gray-subtle mb-1;
}

// Hint: 12px/normal — helper text below inputs
.nc-date-dep-hint {
  @apply text-bodySm text-nc-content-gray-subtle mt-1;
}

// Section header: 11px/semibold/uppercase — ROW PROPAGATION
.nc-date-dep-section-header {
  @apply text-[11px] font-semibold text-nc-content-gray-subtle uppercase tracking-wide mb-3;
}

// Error: 12px/red
.nc-date-dep-error {
  @apply text-bodySm text-nc-content-red;
}

.nc-select-error {
  :deep(.ant-select-selector) {
    border-color: var(--nc-content-red) !important;
  }
}
</style>

<style lang="scss">
.nc-date-dep-rich-dropdown {
  min-width: 320px !important;

  .ant-select-item-option-content {
    white-space: normal;
  }

  // Match the Base Type dropdown selected look — subtle gray-light bg
  // instead of antd's saturated blue.
  .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
    background-color: var(--nc-bg-gray-light) !important;
    font-weight: 400 !important;
  }
}
</style>
