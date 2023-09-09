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
  <a-menu-divider v-if="false" class="my-0" />

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
  <NcSubMenu
    v-if="
      ['airtableImport', 'csvImport', 'jsonImport', 'excelImport'].some((permission) =>
        isUIAllowed(permission, false, projectRole),
      )
    "
    class="py-0"
    data-testid="nc-sidebar-project-import"
  >
    <template #title>
      <GeneralIcon icon="download" />

      {{ $t('labels.importData') }}
    </template>

    <NcMenuItem
      v-if="isUIAllowed('airtableImport', false, projectRole)"
      key="quick-import-airtable"
      @click="openAirtableImportDialog(base.id)"
    >
      <GeneralIcon icon="airtable" class="group-hover:text-black" />
      Airtable
    </NcMenuItem>

    <NcMenuItem v-if="isUIAllowed('csvImport', false, projectRole)" key="quick-import-csv" @click="openQuickImportDialog('csv')">
      <GeneralIcon icon="csv" class="group-hover:text-black" />
      CSV file
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('jsonImport', false, projectRole)"
      key="quick-import-json"
      @click="openQuickImportDialog('json')"
    >
      <GeneralIcon icon="code" class="group-hover:text-black" />
      JSON file
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('excelImport', false, projectRole)"
      key="quick-import-excel"
      @click="openQuickImportDialog('excel')"
    >
      <GeneralIcon icon="excel" class="group-hover:text-black" />
      Microsoft Excel
    </NcMenuItem>
  </NcSubMenu>

  <!-- Connect to new datasource -->
  <!-- <a-sub-menu>
    <template #title>
      <div class="nc-project-menu-item group">
        <GeneralIcon icon="datasource" class="group-hover:text-black" />
        Connect to new datasource
        <div class="flex-1" />

        <MaterialSymbolsChevronRightRounded class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400" />
      </div>
    </template>

    <template #expandIcon></template>
    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MYSQL, project.id)">
      <div class="color-transition nc-project-menu-item group">
        <LogosMysqlIcon class="group-hover:text-black" />
        MySQL
      </div>
    </a-menu-item>
    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.PG, project.id)">
      <div class="color-transition nc-project-menu-item group">
        <LogosPostgresql class="group-hover:text-black" />
        Postgres
      </div>
    </a-menu-item>
    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.SQLITE, project.id)">
      <div class="color-transition nc-project-menu-item group">
        <VscodeIconsFileTypeSqlite class="group-hover:text-black" />
        SQLite
      </div>
    </a-menu-item>
    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MSSQL, project.id)">
      <div class="color-transition nc-project-menu-item group">
        <SimpleIconsMicrosoftsqlserver class="group-hover:text-black" />
        MSSQL
      </div>
    </a-menu-item>
    <a-menu-item
      v-if="appInfo.ee"
      key="connect-new-source"
      @click="toggleDialog(true, 'dataSources', ClientType.SNOWFLAKE, project.id)"
    >
      <div class="color-transition nc-project-menu-item group">
        <LogosSnowflakeIcon class="group-hover:text-black" />
        Snowflake
      </div>
    </a-menu-item>
    <a-menu-item v-if="isUIAllowed('importRequest', false, projectRole)" key="add-new-table" class="py-1 rounded-b">
      <a
        v-e="['e:datasource:import-request']"
        href="https://github.com/nocodb/nocodb/issues/2052"
        target="_blank"
        class="prose-sm hover:(!text-primary !opacity-100) color-transition nc-project-menu-item group after:(!rounded-b)"
      >
        <GeneralIcon icon="openInNew" class="group-hover:text-black" />
        {{ $t('labels.requestDataSource') }}
      </a>
    </a-menu-item>
  </a-sub-menu> -->
</template>
