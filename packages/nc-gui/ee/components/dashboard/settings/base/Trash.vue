<script setup lang="ts">
const { $api } = useNuxtApp()

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const _projectId = inject(ProjectIdInj, undefined)

const baseId = computed(() => _projectId?.value ?? base.value?.id)

const isLoading = ref(false)

const defaultRetentionDays = ref(30)

const tables = ref<
  Array<{
    id: string
    title: string
    trash_disabled: boolean | null
    trash_retention_days: number | null
    is_meta: boolean
    has_deleted_column: boolean
    _saving?: boolean
  }>
>([])

async function loadSettings() {
  if (!baseId.value) return

  isLoading.value = true
  try {
    const result = (await $api.internal.getOperation(activeWorkspaceId.value!, baseId.value!, {
      operation: 'recordTrashSettingsList',
    })) as any

    tables.value = (result.tables ?? []).map((t: any) => ({
      ...t,
      _saving: false,
    }))
    defaultRetentionDays.value = result.defaultRetentionDays ?? 30
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const { showWarningModal } = useNcConfirmModal()

async function saveTableSetting(
  table: (typeof tables.value)[number],
  field: 'trash_disabled' | 'trash_retention_days',
  value: any,
) {
  if (!baseId.value) return

  table._saving = true
  try {
    await $api.internal.postOperation(
      activeWorkspaceId.value!,
      baseId.value!,
      { operation: 'recordTrashSettingsUpdate' } as any,
      {
        tableId: table.id,
        [field]: value,
      },
    )

    table[field] = value
    message.success(t('trash.settingsUpdated'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    table._saving = false
  }
}

function updateTable(table: (typeof tables.value)[number], field: 'trash_disabled' | 'trash_retention_days', value: any) {
  if (field === 'trash_disabled' && value === true) {
    showWarningModal({
      title: t('trash.disableTrashTitle'),
      content: t('trash.disableTrashConfirm', { table: table.title }),
      okCallback: async () => {
        await saveTableSetting(table, field, value)
      },
    })
    return
  }

  saveTableSetting(table, field, value)
}

function getRetentionDisplay(table: (typeof tables.value)[number]) {
  if (table.trash_retention_days != null) {
    return t('trash.customDays', { days: table.trash_retention_days })
  }
  return t('trash.defaultRetention', { days: defaultRetentionDays.value })
}

function isTrashAvailable(table: (typeof tables.value)[number]) {
  return table.is_meta && table.has_deleted_column
}

function unavailableReason(table: (typeof tables.value)[number]) {
  if (!table.is_meta) return t('trash.notAvailableExternal')
  return t('trash.notAvailablePending')
}

function isTrashEnabled(table: (typeof tables.value)[number]) {
  return !table.trash_disabled
}

// Retention dropdown state
const retentionDropdownVisible = ref<Record<string, boolean>>({})
const retentionDraft = ref<Record<string, number | null>>({})

function openRetentionDropdown(table: (typeof tables.value)[number]) {
  retentionDraft.value[table.id] = table.trash_retention_days
  retentionDropdownVisible.value[table.id] = true
}

function closeRetentionDropdown(tableId: string) {
  retentionDropdownVisible.value[tableId] = false
}

function isRetentionDirty(table: (typeof tables.value)[number]) {
  return retentionDraft.value[table.id] !== table.trash_retention_days
}

async function saveRetention(table: (typeof tables.value)[number]) {
  await saveTableSetting(table, 'trash_retention_days', retentionDraft.value[table.id])
  closeRetentionDropdown(table.id)
}

onMounted(async () => {
  await until(() => !!baseId.value).toBeTruthy()
  await loadSettings()
})
</script>

<template>
  <div data-testid="nc-settings-subtab-trash" class="flex flex-col w-full">
    <div class="text-nc-content-gray-emphasis font-semibold text-lg">
      {{ $t('trash.settings') }}
    </div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
      {{ $t('trash.settingsDesc') }}
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <GeneralLoader size="large" />
    </div>

    <div v-else-if="tables.length" class="flex flex-col border-1 rounded-lg mt-6 border-nc-border-gray-medium overflow-hidden">
      <!-- Header -->
      <div class="flex items-center px-4 py-2 bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-medium">
        <div class="flex-1 text-bodySm font-semibold text-nc-content-gray-emphasis">
          {{ $t('objects.table') }}
        </div>
        <div class="w-24 text-center text-bodySm font-semibold text-nc-content-gray-emphasis">
          {{ $t('trash.enableTrash') }}
        </div>
        <div class="w-48 text-center text-bodySm font-semibold text-nc-content-gray-emphasis">
          {{ $t('trash.retentionDays') }}
        </div>
      </div>

      <!-- Rows -->
      <div
        v-for="table in tables"
        :key="table.id"
        class="flex items-center px-4 py-2.5 border-b-1 border-nc-border-gray-medium last:border-b-0"
        :data-testid="`nc-trash-settings-row-${table.id}`"
      >
        <div
          class="flex-1 text-bodySm truncate pr-4"
          :class="isTrashAvailable(table) ? 'text-nc-content-gray' : 'text-nc-content-gray-muted'"
        >
          {{ table.title }}
        </div>
        <div class="w-24 flex justify-center">
          <NcTooltip v-if="!isTrashAvailable(table)" :title="unavailableReason(table)">
            <NcSwitch :checked="false" disabled size="small" />
          </NcTooltip>
          <NcSwitch
            v-else
            :checked="isTrashEnabled(table)"
            :disabled="!isUIAllowed('recordTrashSettingsUpdate')"
            :loading="table._saving"
            size="small"
            data-testid="nc-trash-settings-toggle"
            @update:checked="(val: boolean) => updateTable(table, 'trash_disabled', !val)"
          />
        </div>
        <div class="w-48 flex justify-center">
          <span v-if="!isTrashAvailable(table)" class="text-bodySm text-nc-content-gray-muted">—</span>
          <NcTooltip v-else-if="!isTrashEnabled(table)" class="text-bodySm text-nc-content-gray-muted">
            <template #title>{{ $t('trash.disableTrashWarning') }}</template>
            —
          </NcTooltip>
          <NcDropdown
            v-else
            v-model:visible="retentionDropdownVisible[table.id]"
            :auto-close="false"
            :disabled="!isUIAllowed('recordTrashSettingsUpdate')"
            placement="bottomRight"
          >
            <NcButton size="xs" type="text" class="!text-bodySm" @click="openRetentionDropdown(table)">
              {{ getRetentionDisplay(table) }}
              <GeneralIcon icon="arrowDown" class="ml-1 h-3.5 w-3.5" />
            </NcButton>
            <template #overlay>
              <div class="p-3 flex flex-col gap-3 w-52" @click.stop @mousedown.stop @keydown.stop>
                <div class="text-bodySm font-semibold text-nc-content-gray-emphasis">
                  {{ $t('trash.retentionDays') }}
                </div>
                <a-input-number
                  v-model:value="retentionDraft[table.id]"
                  :min="1"
                  :max="365"
                  :placeholder="String(defaultRetentionDays)"
                  class="w-full"
                />
                <div class="text-captionSm text-nc-content-gray-muted">
                  {{ $t('trash.defaultRetention', { days: defaultRetentionDays }) }}
                </div>
                <div class="flex justify-end gap-2">
                  <NcButton size="xs" type="text" @click="closeRetentionDropdown(table.id)">
                    {{ $t('general.cancel') }}
                  </NcButton>
                  <NcButton
                    size="xs"
                    type="primary"
                    :disabled="!isRetentionDirty(table)"
                    :loading="table._saving"
                    @click="saveRetention(table)"
                  >
                    {{ $t('general.save') }}
                  </NcButton>
                </div>
              </div>
            </template>
          </NcDropdown>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center py-12 gap-2">
      <div class="text-sm text-nc-content-gray-muted">
        {{ $t('msg.noData') }}
      </div>
    </div>
  </div>
</template>
