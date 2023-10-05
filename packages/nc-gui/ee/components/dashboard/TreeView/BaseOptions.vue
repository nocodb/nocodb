<script lang="ts" setup>
import type { BaseType, SourceType } from 'nocodb-sdk'

const props = defineProps<{
  source: SourceType
  base: BaseType
}>()

const emits = defineEmits(['update:base'])

const source = toRef(props, 'source')

const _project = useVModel(props, 'base', emits)

const { isUIAllowed } = useRoles()

const baseRole = inject(ProjectRoleInj)

const { $e } = useNuxtApp()

const TODOMagic = ref(false)

function openTableCreateMagicDialog(sourceId?: string) {
  if (!sourceId) return

  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableMagic'), {
    'v-if': sourceId,
    'modelValue': isOpen,
    'sourceId': sourceId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openSchemaMagicDialog(sourceId?: string) {
  if (!sourceId) return

  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgSchemaMagic'), {
    'modelValue': isOpen,
    'sourceId': sourceId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

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
  <!-- TODO NocoAI -->
  <a-sub-menu v-if="TODOMagic">
    <template #title>
      <div class="nc-base-menu-item group">
        <GeneralIcon icon="magic" class="group-hover:text-black" />
        NocoAI
        <div class="flex-1" />

        <MaterialSymbolsChevronRightRounded class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400" />
      </div>
    </template>

    <template #expandIcon></template>

    <a-menu-item key="table-magic" @click="openTableCreateMagicDialog(source.id)">
      <div class="color-transition nc-base-menu-item group">
        <GeneralIcon icon="magic1" class="group-hover:text-black" />
        Create table
      </div>
    </a-menu-item>
    <a-menu-item key="schema-magic" @click="openSchemaMagicDialog(source.id)">
      <div class="color-transition nc-base-menu-item group">
        <GeneralIcon icon="magic1" class="group-hover:text-black" />
        Create schema
      </div>
    </a-menu-item>
  </a-sub-menu>

  <!-- Quick Import From -->
  <NcSubMenu
    v-if="
      ['airtableImport', 'csvImport', 'jsonImport', 'excelImport'].some((permission) => isUIAllowed(permission, false, baseRole))
    "
    class="py-0"
    data-testid="nc-sidebar-base-import"
  >
    <template #title>
      <GeneralIcon icon="download" />

      {{ $t('labels.importData') }}
    </template>

    <NcMenuItem
      v-if="isUIAllowed('airtableImport', { roles: baseRole })"
      key="quick-import-airtable"
      v-e="['c:import:airtable']"
      @click="openAirtableImportDialog(source.base_id, source.id)"
    >
      <GeneralIcon icon="airtable" class="max-w-3.75 group-hover:text-black" />
      <div class="ml-0.5">Airtable</div>
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('csvImport', { roles: baseRole })"
      key="quick-import-csv"
      v-e="['c:import:csv']"
      @click="openQuickImportDialog('csv')"
    >
      <GeneralIcon icon="csv" class="w-4 group-hover:text-black" />
      CSV file
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('jsonImport', { roles: baseRole })"
      key="quick-import-json"
      v-e="['c:import:json']"
      @click="openQuickImportDialog('json')"
    >
      <GeneralIcon icon="code" class="w-4 group-hover:text-black" />
      JSON file
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('excelImport', { roles: baseRole })"
      key="quick-import-excel"
      v-e="['c:import:excel']"
      @click="openQuickImportDialog('excel')"
    >
      <GeneralIcon icon="excel" class="max-w-4 group-hover:text-black" />
      Microsoft Excel
    </NcMenuItem>
  </NcSubMenu>
</template>
