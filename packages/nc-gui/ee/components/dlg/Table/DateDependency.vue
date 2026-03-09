<script lang="ts" setup>
import type { ColumnType, DateDependencyReqType, DateDependencyType } from 'nocodb-sdk'
import { PlanFeatureTypes, UITypes, isLinksOrLTAR } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  tableId: string
  title?: string
}>()

const emits = defineEmits(['update:visible'])

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

const rule = computed<DateDependencyType | null>(() => tableMeta.value?.date_dependency ?? null)

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

// Only show self-referencing HM (has-many) link columns — BT/OO/MM cannot be used as predecessor links
const linkOptions = computed(() =>
  tableColumns.value
    .filter((c) => {
      if (!isLinksOrLTAR(c)) return false
      const opts = (c as any).colOptions ?? {}
      return opts.type === 'hm' && opts.fk_related_model_id === props.tableId
    })
    .map((c) => ({ value: c.id, label: c.title, col: c })),
)

// Cascade propagation is PostgreSQL-only and not available for external data sources
const tableSource = computed(() => openedProject.value?.sources?.find((s) => s.id === tableMeta.value?.source_id))

const cascadeAvailable = computed(() => {
  const s = tableSource.value
  const isExternal = s && !s.is_meta && !s.is_local
  return s?.type === 'pg' && !isExternal
})

const connectionTypeOptions = computed(() => [
  { value: 'end-to-start', label: t('labels.dateDependency.connectionTypes.end-to-start') },
  { value: 'end-to-end', label: t('labels.dateDependency.connectionTypes.end-to-end') },
  { value: 'start-to-end', label: t('labels.dateDependency.connectionTypes.start-to-end') },
  { value: 'start-to-start', label: t('labels.dateDependency.connectionTypes.start-to-start') },
])

const bufferTypeOptions = computed(() => [
  { value: 'none', label: t('labels.dateDependency.bufferTypes.none') },
  { value: 'flexible', label: t('labels.dateDependency.bufferTypes.flexible') },
  { value: 'fixed', label: t('labels.dateDependency.bufferTypes.fixed') },
])

const validators = computed(() => ({
  fk_start_date_field_id: form.is_active ? [fieldRequiredValidator()] : [],
  fk_end_date_field_id: form.is_active ? [fieldRequiredValidator()] : [],
}))

const { validateInfos, validate, clearValidate } = Form.useForm(form, validators)

async function save() {
  if (!activeWorkspaceId.value || !activeProjectId.value) return
  try {
    await validate()
  } catch {
    return
  }

  isSaving.value = true
  try {
    const result = await $api.internal.postOperation(
      activeWorkspaceId.value,
      activeProjectId.value,
      { operation: 'updateDateDependency', fk_model_id: props.tableId },
      form,
    )
    if (tableMeta.value) {
      tableMeta.value.date_dependency = { ...rule.value, ...form, ...result }
    }
    savedForm.value = { ...form }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isSaving.value = false
  }
}

async function deleteRule() {
  if (!activeWorkspaceId.value || !activeProjectId.value) return
  isSaving.value = true
  try {
    await $api.internal.postOperation(
      activeWorkspaceId.value,
      activeProjectId.value,
      { operation: 'deleteTableDateDependency', fk_model_id: props.tableId },
      {},
    )
    if (tableMeta.value) {
      tableMeta.value.date_dependency = null
    }
    Object.assign(form, { ...defaultForm })
    savedForm.value = { ...defaultForm }
    message.success(t('msg.success.deleted'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isSaving.value = false
  }
}

watch(visible, async (val) => {
  if (val) {
    await loadTableMeta(props.tableId)
    const initial = rule.value ? { ...defaultForm, ...rule.value } : { ...defaultForm }
    Object.assign(form, initial)
    savedForm.value = { ...initial }
    clearValidate()
  }
})
</script>

<template>
  <NcModal v-model:visible="visible" size="sm" height="auto" wrap-class-name="nc-modal-date-dependency">
    <template #header>
      <span class="text-heading3">
        {{ $t('labels.dateDependency.title') }}
      </span>
    </template>

    <div class="flex flex-col" style="min-height: 300px; max-height: 70vh">
      <div class="flex-1 overflow-y-auto px-1 pb-2">
        <!-- Description -->
        <p class="text-body text-nc-content-gray-subtle mb-6">
          {{ $t('labels.dateDependency.description') }}
        </p>

        <!-- Active toggle -->
        <div class="flex items-center gap-3 mb-6">
          <NcSwitch v-model:checked="form.is_active" size="small" />
          <span class="text-body text-nc-content-gray">{{ $t('labels.dateDependency.isActive') }}</span>
        </div>

        <template v-if="form.is_active">
          <a-form :model="form" layout="vertical">
            <div class="grid grid-cols-2 gap-x-6 gap-y-5 mb-5">
              <div>
                <div class="text-body font-semibold text-nc-content-gray mb-2">
                  {{ $t('labels.dateDependency.startDateField') }}
                </div>
                <a-form-item v-bind="validateInfos.fk_start_date_field_id" class="!mb-0">
                  <a-select
                    v-model:value="form.fk_start_date_field_id"
                    class="w-full"
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
                </a-form-item>
              </div>

              <!-- End date -->
              <div>
                <div class="text-body font-semibold text-nc-content-gray mb-2">
                  {{ $t('labels.dateDependency.endDateField') }}
                </div>
                <a-form-item v-bind="validateInfos.fk_end_date_field_id" class="!mb-0">
                  <a-select
                    v-model:value="form.fk_end_date_field_id"
                    class="w-full"
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
                </a-form-item>
              </div>

              <div>
                <div class="text-body font-semibold text-nc-content-gray mb-2">
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
                <div class="text-captionSm text-nc-content-gray-subtle mt-1.5">
                  {{ $t('labels.dateDependency.durationFieldHint') }}
                </div>
              </div>

              <!-- Predecessors -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-body font-semibold text-nc-content-gray">
                    {{ $t('labels.dateDependency.linkRowField') }}
                  </span>
                  <span class="text-captionSm text-nc-content-gray-subtle">{{ $t('general.optional') }}</span>
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
                <div class="text-captionSm text-nc-content-gray-subtle mt-1.5">
                  {{ $t('labels.dateDependency.linkRowFieldHint') }}
                </div>
              </div>
            </div>
          </a-form>

          <!-- Row-to-row propagation -->
          <template v-if="form.fk_dependency_linkrow_field_id">
            <NcDivider class="mb-4" />

            <div class="text-captionSm font-semibold text-nc-content-gray-subtle uppercase tracking-wide mb-3">
              {{ $t('labels.dateDependency.propagationSection') }}
            </div>

            <NcTooltip :disabled="cascadeAvailable" :title="$t('labels.dateDependency.cascadeNotSupported')">
              <div class="grid grid-cols-2 gap-x-6 gap-y-3" :class="{ 'opacity-50 pointer-events-none': !cascadeAvailable }">
                <div>
                  <div class="text-captionSm text-nc-content-gray-subtle mb-1">
                    {{ $t('labels.dateDependency.connectionType') }}
                  </div>
                  <NcSelect v-model:value="form.dependency_connection_type" class="w-full" :disabled="!cascadeAvailable">
                    <a-select-option v-for="opt in connectionTypeOptions" :key="opt.value" :value="opt.value" :label="opt.label">
                      {{ opt.label }}
                    </a-select-option>
                  </NcSelect>
                </div>

                <div>
                  <div class="text-captionSm text-nc-content-gray-subtle mb-1">
                    {{ $t('labels.dateDependency.bufferType') }}
                  </div>
                  <NcSelect v-model:value="form.dependency_buffer_type" class="w-full" :disabled="!cascadeAvailable">
                    <a-select-option v-for="opt in bufferTypeOptions" :key="opt.value" :value="opt.value" :label="opt.label">
                      {{ opt.label }}
                    </a-select-option>
                  </NcSelect>
                </div>

                <div v-if="form.dependency_buffer_type !== 'none'">
                  <div class="text-captionSm text-nc-content-gray-subtle mb-1">
                    {{ $t('labels.dateDependency.bufferDays') }}
                  </div>
                  <NcNonNullableNumberInput
                    v-model="form.dependency_buffer_days"
                    :min="0"
                    :disabled="!cascadeAvailable"
                  />
                </div>

                <div class="flex items-center gap-2 pt-5">
                  <NcSwitch v-model:checked="form.include_weekends" size="small" :disabled="!cascadeAvailable" />
                  <span class="text-body text-nc-content-gray">{{ $t('labels.dateDependency.includeWeekends') }}</span>
                </div>
              </div>
            </NcTooltip>
          </template>
        </template>
      </div>

      <div class="flex items-center justify-end gap-3">
        <NcButton v-if="rule?.id" type="danger" size="small" :loading="isSaving" @click="deleteRule">
          {{ $t('general.delete') }}
        </NcButton>

        <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_DATE_DEPENDENCY">
          <template #default="{ click }">
            <NcButton
              v-e="['c:date-dependency:save']"
              size="small"
              :loading="isSaving"
              :disabled="!hasChanges"
              @click="click(PlanFeatureTypes.FEATURE_DATE_DEPENDENCY, save)"
            >
              {{ $t('labels.dateDependency.save') }}
            </NcButton>
            <PaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_DATE_DEPENDENCY" />
          </template>
        </PaymentUpgradeBadgeProvider>
      </div>
    </div>
  </NcModal>
</template>
