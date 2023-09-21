<script lang="ts" setup>
import type { BaseType, ProjectType } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  project: ProjectType
}>()

const base = toRef(props, 'base')

const { isUIAllowed } = useRoles()

const projectRole = inject(ProjectRoleInj)

const { $e } = useNuxtApp()

function openAirtableImportDialog(baseId?: string) {
  if (!baseId) return

  $e('a:actions:import-airtable')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgAirtableImport'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openQuickImportDialog(type: string) {
  if (!base.value?.id) return

  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'baseId': base.value.id,
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
  <NcSubMenu class="py-0" data-testid="nc-sidebar-project-import">
    <template #title>
      <GeneralIcon icon="download" />

      {{ $t('labels.importData') }}
    </template>

    <template #expandIcon></template>

    <NcMenuItem
      v-if="isUIAllowed('airtableImport', { roles: projectRole })"
      key="quick-import-airtable"
      @click="openAirtableImportDialog(base.id)"
    >
      <GeneralIcon icon="airtable" class="max-w-3.75 group-hover:text-black" />
      <div class="ml-0.5">Airtable</div>
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('csvImport', { roles: projectRole })"
      key="quick-import-csv"
      @click="openQuickImportDialog('csv')"
    >
      <GeneralIcon icon="csv" class="w-4 group-hover:text-black" />
      CSV file
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('jsonImport', { roles: projectRole })"
      key="quick-import-json"
      @click="openQuickImportDialog('json')"
    >
      <GeneralIcon icon="code" class="w-4 group-hover:text-black" />
      JSON file
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('excelImport', { roles: projectRole })"
      key="quick-import-excel"
      @click="openQuickImportDialog('excel')"
    >
      <GeneralIcon icon="excel" class="max-w-4 group-hover:text-black" />
      Microsoft Excel
    </NcMenuItem>
  </NcSubMenu>
</template>
