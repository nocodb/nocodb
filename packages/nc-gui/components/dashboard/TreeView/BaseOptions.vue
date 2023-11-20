<script lang="ts" setup>
import type { BaseType, SourceType } from 'nocodb-sdk'

const props = defineProps<{
  source: SourceType
  base: BaseType
}>()

const source = toRef(props, 'source')

const { isUIAllowed } = useRoles()

const baseRole = inject(ProjectRoleInj)

const { $e } = useNuxtApp()

function openAirtableImportDialog(baseId?: string, sourceId?: string) {
  if (!baseId || !sourceId) return

  $e('a:actions:import-airtable')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgAirtableImport'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'sourceId': sourceId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openQuickImportDialog(type: string) {
  if (!source.value?.id) return

  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'sourceId': source.value.id,
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
  <NcSubMenu class="py-0" data-testid="nc-sidebar-base-import">
    <template #title>
      <GeneralIcon icon="download" />
      {{ $t('labels.importData') }}
    </template>

    <template #expandIcon></template>

    <template v-if="isUIAllowed('airtableImport', { roles: baseRole })" v-e="['c:import:airtable']">
      <NcMenuItem key="quick-import-airtable" @click="openAirtableImportDialog(source.base_id, source.id)">
        <GeneralIcon icon="airtable" class="max-w-3.75 group-hover:text-black" />
        <div class="ml-0.5">{{ $t('labels.airtable') }}</div>
      </NcMenuItem>
    </template>

    <template v-if="isUIAllowed('csvImport', { roles: baseRole })" key="quick-import-csv" v-e="['c:import:csv']">
      <NcMenuItem @click="openQuickImportDialog('csv')">
        <GeneralIcon icon="csv" class="w-4 group-hover:text-black" />
        {{ $t('labels.csvFile') }}
      </NcMenuItem>
    </template>

    <template v-if="isUIAllowed('jsonImport', { roles: baseRole })" v-e="['c:import:json']">
      <NcMenuItem key="quick-import-json" @click="openQuickImportDialog('json')">
        <GeneralIcon icon="code" class="w-4 group-hover:text-black" />
        {{ $t('labels.jsonFile') }}
      </NcMenuItem>
    </template>

    <template v-if="isUIAllowed('excelImport', { roles: baseRole })" v-e="['c:import:excel']">
      <NcMenuItem key="quick-import-excel" @click="openQuickImportDialog('excel')">
        <GeneralIcon icon="excel" class="max-w-4 group-hover:text-black" />
        {{ $t('labels.microsoftExcel') }}
      </NcMenuItem>
    </template>
  </NcSubMenu>
</template>
