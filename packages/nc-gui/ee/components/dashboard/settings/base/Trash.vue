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

const RETENTION_PRESETS = [30, 60, 90, 180, 365]

const retentionDropdownVisible = ref<Record<string, boolean>>({})

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
    message.toast(t('trash.settingsUpdated'))
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
  const days = table.trash_retention_days ?? defaultRetentionDays.value
  return t('trash.customDays', { days })
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

function selectPreset(table: (typeof tables.value)[number], days: number) {
  retentionDropdownVisible.value[table.id] = false
  if (table.trash_retention_days === days) return
  saveTableSetting(table, 'trash_retention_days', days)
}

onMounted(async () => {
  await until(() => !!baseId.value).toBeTruthy()
  await loadSettings()
})
</script>

<template>
  <div data-testid="nc-settings-subtab-trash" class="flex flex-col w-full max-w-3xl mx-auto px-6">
    <div class="text-nc-content-gray-subtle2 leading-5">
      {{ $t('trash.settingsDesc') }}
      <a
        href="https://nocodb.com/docs/product-docs/bases/trash-settings"
        target="_blank"
        rel="noopener noreferrer"
        class="!text-nc-content-brand !no-underline hover:!underline"
      >
        {{ $t('msg.learnMore') }}
      </a>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <GeneralLoader size="large" />
    </div>

    <div v-else-if="tables.length" class="flex flex-col border-1 rounded-lg mt-6 border-nc-border-gray-medium overflow-hidden">
      <!-- Header -->
      <div class="flex items-center px-4 py-2 bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-medium">
        <div class="w-24 text-center text-bodySm font-semibold text-nc-content-gray-emphasis">
          {{ $t('trash.enableTrash') }}
        </div>
        <div class="flex-1 text-bodySm font-semibold text-nc-content-gray-emphasis pl-4">
          {{ $t('objects.table') }}
        </div>
        <div class="w-48 text-center text-bodySm font-semibold text-nc-content-gray-emphasis">
          {{ $t('trash.retentionDays') }}
        </div>
      </div>

      <!-- Rows -->
      <div
        v-for="table in tables"
        :key="table.id"
        class="flex items-center px-4 py-1.5 min-h-11 border-b-1 border-nc-border-gray-medium last:border-b-0"
        :data-testid="`nc-trash-settings-row-${table.id}`"
      >
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
        <div
          class="flex-1 flex items-center gap-2 px-4 min-w-0"
          :class="isTrashAvailable(table) ? 'text-nc-content-gray' : 'text-nc-content-gray-muted'"
        >
          <GeneralIcon icon="table" class="flex-none w-4 h-4 text-nc-content-gray-subtle2" />
          <NcTooltip class="truncate text-bodyDefaultSm font-weight-500" show-on-truncate-only>
            <template #title>{{ table.title }}</template>
            {{ table.title }}
          </NcTooltip>
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
            :disabled="!isUIAllowed('recordTrashSettingsUpdate')"
            :trigger="['click']"
            placement="bottom"
          >
            <NcButton size="small" type="text" class="!text-bodyDefaultSm">
              {{ getRetentionDisplay(table) }}
              <GeneralIcon icon="arrowDown" class="ml-1 h-3.5 w-3.5" />
            </NcButton>
            <template #overlay>
              <NcMenu variant="small" class="nc-trash-retention-menu !min-w-32">
                <NcMenuItem
                  v-for="days in RETENTION_PRESETS"
                  :key="days"
                  :class="{ '!bg-nc-bg-gray-light': table.trash_retention_days === days }"
                  @click="selectPreset(table, days)"
                >
                  {{ $t('trash.customDays', { days }) }}
                </NcMenuItem>
              </NcMenu>
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

<style lang="scss">
.nc-trash-retention-menu {
  &.ant-dropdown-menu {
    @apply !py-1;
  }

  .ant-dropdown-menu-item {
    @apply !min-h-7 !py-1 !px-2.5 !justify-center !text-center;
  }

  .ant-dropdown-menu-title-content,
  .nc-menu-item-inner {
    @apply !justify-center !text-center;
  }
}
</style>
