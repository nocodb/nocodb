<script lang="ts" setup>
import type { BaseType, ProjectType } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  project: ProjectType
}>()

const emits = defineEmits(['update:project'])

const base = toRef(props, 'base')

const _project = useVModel(props, 'project', emits)

const { isUIAllowed } = useUIPermission()

const projectRole = inject(ProjectRoleInj)

const { $e } = useNuxtApp()

function openTableCreateMagicDialog(baseId?: string) {
  if (!baseId) return

  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableMagic'), {
    'v-if': baseId,
    'modelValue': isOpen,
    'baseId': baseId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openSchemaMagicDialog(baseId?: string) {
  if (!baseId) return

  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgSchemaMagic'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

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
  <!-- NocoAI -->
  <a-sub-menu v-if="false">
    <template #title>
      <div class="nc-project-menu-item group">
        <GeneralIcon icon="magic" class="group-hover:text-black" />
        NocoAI
        <div class="flex-1" />

        <MaterialSymbolsChevronRightRounded class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400" />
      </div>
    </template>

    <template #expandIcon></template>

    <a-menu-item key="table-magic" @click="openTableCreateMagicDialog(base.id)">
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="magic1" class="group-hover:text-black" />
        Create table
      </div>
    </a-menu-item>
    <a-menu-item key="schema-magic" @click="openSchemaMagicDialog(base.id)">
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="magic1" class="group-hover:text-black" />
        Create schema
      </div>
    </a-menu-item>
  </a-sub-menu>

  <!-- Quick Import From -->
  <NcSubMenu class="py-0">
    <template #title>
      <GeneralIcon icon="download" />

      {{ $t('labels.importData') }}
    </template>

    <NcMenuItem
      v-if="isUIAllowed('airtableImport', false, projectRole)"
      key="quick-import-airtable"
      @click="openAirtableImportDialog(base.id)"
    >
      <GeneralIcon icon="airtable" class="max-w-3.75 group-hover:text-black" />
      <div class="ml-0.5">Airtable</div>
    </NcMenuItem>

    <NcMenuItem v-if="isUIAllowed('csvImport', false, projectRole)" key="quick-import-csv" @click="openQuickImportDialog('csv')">
      <GeneralIcon icon="csv" class="w-4 group-hover:text-black" />
      CSV file
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('jsonImport', false, projectRole)"
      key="quick-import-json"
      @click="openQuickImportDialog('json')"
    >
      <GeneralIcon icon="code" class="w-4 group-hover:text-black" />
      JSON file
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('excelImport', false, projectRole)"
      key="quick-import-excel"
      @click="openQuickImportDialog('excel')"
    >
      <GeneralIcon icon="excel" class="max-w-4 group-hover:text-black" />
      Microsoft Excel
    </NcMenuItem>
  </NcSubMenu>
</template>
