<script lang="ts" setup>
import type { BaseType, SourceType } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    source: SourceType
    base: BaseType
    variant?: 'small' | 'medium' | 'large'
    titleClass?: string
    submenuClass?: string
    showLabel?: boolean
    showNocoDbImport?: boolean
    popupOffset?: [number, number]
    showSourceSelector?: boolean
  }>(),
  {
    variant: 'small',
    titleClass: '',
    submenuClass: '',
    showLabel: false,
    showNocoDbImport: false,
    showSourceSelector: true,
  },
)

const source = toRef(props, 'source')

const base = toRef(props, 'base')

const { isUIAllowed, sandboxRestrictionReason } = useRoles()

const baseRole = computed(() => base.value.project_role || base.value.workspace_role)

const airtableImportReason = computed(() =>
  sandboxRestrictionReason('airtableImport', { roles: baseRole.value, source: source.value }),
)

const csvImportReason = computed(() => sandboxRestrictionReason('csvImport', { roles: baseRole.value, source: source.value }))

const jsonImportReason = computed(() => sandboxRestrictionReason('jsonImport', { roles: baseRole.value, source: source.value }))

const excelImportReason = computed(() => sandboxRestrictionReason('excelImport', { roles: baseRole.value, source: source.value }))

const anyImportReason = computed(
  () => !!airtableImportReason.value || !!csvImportReason.value || !!jsonImportReason.value || !!excelImportReason.value,
)

const { $e } = useNuxtApp()

function openAirtableImportDialog(baseId?: string, sourceId?: string) {
  if (!baseId || !sourceId) return

  $e('a:actions:import-airtable')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgAirtableImport'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'sourceId': sourceId,
    'showSourceSelector': props.showSourceSelector,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openQuickImportDialog(type: string) {
  if (!source.value?.id || !source.value.base_id) return

  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'baseId': source.value.base_id,
    'sourceId': source.value.id,
    'showSourceSelector': props.showSourceSelector,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <!-- Quick Import From -->
  <NcSubMenu
    v-if="
      ['airtableImport', 'csvImport', 'jsonImport', 'excelImport'].some((permission) =>
        isUIAllowed(permission, { roles: baseRole, source }),
      ) || anyImportReason
    "
    class="py-0"
    :class="submenuClass"
    data-testid="nc-sidebar-base-import"
    :variant="variant"
    :title-class="titleClass"
    :popup-offset="popupOffset"
  >
    <template #title>
      <slot name="title">
        <GeneralIcon icon="download" class="opacity-80" />
        {{ $t('labels.importData') }}
      </slot>
    </template>

    <template v-if="$slots.expandIcon" #expandIcon>
      <slot name="expandIcon"> </slot>
    </template>

    <slot name="label"> </slot>

    <NcTooltip
      v-if="isUIAllowed('airtableImport', { roles: baseRole, source }) || !!airtableImportReason"
      :title="airtableImportReason ? $t(airtableImportReason) : ''"
      :disabled="!airtableImportReason"
    >
      <NcMenuItem
        key="quick-import-airtable"
        v-e="['c:import:airtable']"
        :disabled="!!airtableImportReason"
        @click="!airtableImportReason && openAirtableImportDialog(source.base_id, source.id)"
      >
        <GeneralIcon icon="airtable" class="max-w-3.75" />
        <div class="ml-0.5">{{ $t('labels.airtableBase') }}</div>
      </NcMenuItem>
    </NcTooltip>

    <NcTooltip
      v-if="isUIAllowed('csvImport', { roles: baseRole, source }) || !!csvImportReason"
      :title="csvImportReason ? $t(csvImportReason) : ''"
      :disabled="!csvImportReason"
    >
      <NcMenuItem
        key="quick-import-csv"
        v-e="['c:import:csv']"
        :disabled="!!csvImportReason"
        @click="!csvImportReason && openQuickImportDialog('csv')"
      >
        <GeneralIcon icon="ncFileTypeCsvSmall" class="w-4 h-4" />
        {{ $t('labels.csvFile') }}
      </NcMenuItem>
    </NcTooltip>

    <NcTooltip
      v-if="isUIAllowed('jsonImport', { roles: baseRole, source }) || !!jsonImportReason"
      :title="jsonImportReason ? $t(jsonImportReason) : ''"
      :disabled="!jsonImportReason"
    >
      <NcMenuItem
        key="quick-import-json"
        v-e="['c:import:json']"
        :disabled="!!jsonImportReason"
        @click="!jsonImportReason && openQuickImportDialog('json')"
      >
        <GeneralIcon icon="ncFileTypeJson" class="h-4" />
        {{ $t('labels.jsonFile') }}
      </NcMenuItem>
    </NcTooltip>

    <NcTooltip
      v-if="isUIAllowed('excelImport', { roles: baseRole, source }) || !!excelImportReason"
      :title="excelImportReason ? $t(excelImportReason) : ''"
      :disabled="!excelImportReason"
    >
      <NcMenuItem
        key="quick-import-excel"
        v-e="['c:import:excel']"
        :disabled="!!excelImportReason"
        @click="!excelImportReason && openQuickImportDialog('excel')"
      >
        <GeneralIcon icon="ncFileTypeExcel" class="w-4 h-4" />
        {{ $t('labels.microsoftExcel') }}
      </NcMenuItem>
    </NcTooltip>
  </NcSubMenu>
</template>
