<script lang="ts" setup>
import type { BaseType, ProjectType } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  project: ProjectType
}>()

const base = toRef(props, 'base')

const { isUIAllowed } = useUIPermission()

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
  <a-menu-divider class="my-0" />

  <!-- Quick Import From -->
  <a-sub-menu class="py-0">
    <template #title>
      <div class="nc-project-menu-item group">
        <GeneralIcon icon="download" class="-ml-0.25" />
        <div class="-ml-0.5">
          {{ $t('title.quickImportFrom') }}
        </div>

        <MaterialSymbolsChevronRightRounded class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400" />
      </div>
    </template>

    <template #expandIcon></template>

    <a-menu-item
      v-if="isUIAllowed('airtableImport', false, projectRole)"
      key="quick-import-airtable"
      @click="openAirtableImportDialog(base.id)"
    >
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="airtable" class="group-hover:text-black" />
        Airtable
      </div>
    </a-menu-item>

    <a-menu-item v-if="isUIAllowed('csvImport', false, projectRole)" key="quick-import-csv" @click="openQuickImportDialog('csv')">
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="csv" class="group-hover:text-black" />
        CSV file
      </div>
    </a-menu-item>

    <a-menu-item
      v-if="isUIAllowed('jsonImport', false, projectRole)"
      key="quick-import-json"
      @click="openQuickImportDialog('json')"
    >
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="code" class="group-hover:text-black" />
        JSON file
      </div>
    </a-menu-item>

    <a-menu-item
      v-if="isUIAllowed('excelImport', false, projectRole)"
      key="quick-import-excel"
      @click="openQuickImportDialog('excel')"
    >
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="excel" class="group-hover:text-black" />
        Microsoft Excel
      </div>
    </a-menu-item>
  </a-sub-menu>
</template>
