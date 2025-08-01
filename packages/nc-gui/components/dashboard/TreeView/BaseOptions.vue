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

const { isUIAllowed } = useRoles()

const baseRole = computed(() => base.value.project_role || base.value.workspace_role)

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

    <NcMenuItem
      v-if="isUIAllowed('airtableImport', { roles: baseRole, source })"
      key="quick-import-airtable"
      v-e="['c:import:airtable']"
      @click="openAirtableImportDialog(source.base_id, source.id)"
    >
      <GeneralIcon icon="airtable" class="max-w-3.75" />
      <div class="ml-0.5">{{ $t('labels.airtableBase') }}</div>
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('csvImport', { roles: baseRole, source })"
      key="quick-import-csv"
      v-e="['c:import:csv']"
      @click="openQuickImportDialog('csv')"
    >
      <GeneralIcon icon="ncFileTypeCsvSmall" class="w-4 h-4" />
      {{ $t('labels.csvFile') }}
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('jsonImport', { roles: baseRole, source })"
      key="quick-import-json"
      v-e="['c:import:json']"
      @click="openQuickImportDialog('json')"
    >
      <GeneralIcon icon="ncFileTypeJson" class="h-4" />
      {{ $t('labels.jsonFile') }}
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('excelImport', { roles: baseRole, source })"
      key="quick-import-excel"
      v-e="['c:import:excel']"
      @click="openQuickImportDialog('excel')"
    >
      <GeneralIcon icon="ncFileTypeExcel" class="w-4 h-4" />
      {{ $t('labels.microsoftExcel') }}
    </NcMenuItem>
  </NcSubMenu>
</template>
