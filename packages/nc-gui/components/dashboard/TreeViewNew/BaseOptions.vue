<script lang="ts" setup>
import type { BaseType, ProjectType } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  project: ProjectType
}>()

const emits = defineEmits(['update:project'])

const base = toRef(props, 'base')

const project = useVModel(props, 'project', emits)

const { appInfo } = useGlobal()

const { t } = useI18n()

const { isUIAllowed } = useUIPermission()

const projectRole = inject(ProjectRoleInj)

const { $e } = useNuxtApp()

const toggleDialog = inject(ToggleDialogInj, () => {})

function openTableCreateMagicDialog(baseId?: string) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableMagic'), {
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
  <a-menu-item-group class="!px-0 !mx-0">
    <template #title>
      <div class="flex items-center">
        Noco
        <GeneralIcon icon="magic" class="ml-1 text-orange-400" />
      </div>
    </template>
    <a-menu-item key="table-magic" @click="openTableCreateMagicDialog(base.id)">
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="magic1" class="group-hover:text-accent" />
        Create table
      </div>
    </a-menu-item>
    <a-menu-item key="schema-magic" @click="openSchemaMagicDialog(base.id)">
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="magic1" class="group-hover:text-accent" />
        Create schema
      </div>
    </a-menu-item>
  </a-menu-item-group>

  <a-menu-divider class="my-0" />

  <!-- Quick Import From -->
  <a-menu-item-group :title="$t('title.quickImportFrom')" class="!px-0 !mx-0">
    <a-menu-item
      v-if="isUIAllowed('airtableImport', false, projectRole)"
      key="quick-import-airtable"
      @click="openAirtableImportDialog(base.id)"
    >
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="airtable" class="group-hover:text-accent" />
        Airtable
      </div>
    </a-menu-item>

    <a-menu-item v-if="isUIAllowed('csvImport', false, projectRole)" key="quick-import-csv" @click="openQuickImportDialog('csv')">
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="csv" class="group-hover:text-accent" />
        CSV file
      </div>
    </a-menu-item>

    <a-menu-item
      v-if="isUIAllowed('jsonImport', false, projectRole)"
      key="quick-import-json"
      @click="openQuickImportDialog('json')"
    >
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="json" class="group-hover:text-accent" />
        JSON file
      </div>
    </a-menu-item>

    <a-menu-item
      v-if="isUIAllowed('excelImport', false, projectRole)"
      key="quick-import-excel"
      @click="openQuickImportDialog('excel')"
    >
      <div class="color-transition nc-project-menu-item group">
        <GeneralIcon icon="excel" class="group-hover:text-accent" />
        Microsoft Excel
      </div>
    </a-menu-item>
  </a-menu-item-group>

  <a-menu-divider class="my-0" />

  <a-menu-item-group title="Connect to new datasource" class="!px-0 !mx-0">
    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MYSQL, project.id)">
      <div class="color-transition nc-project-menu-item group">
        <LogosMysqlIcon class="group-hover:text-accent" />
        MySQL
      </div>
    </a-menu-item>
    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.PG, project.id)">
      <div class="color-transition nc-project-menu-item group">
        <LogosPostgresql class="group-hover:text-accent" />
        Postgres
      </div>
    </a-menu-item>
    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.SQLITE, project.id)">
      <div class="color-transition nc-project-menu-item group">
        <VscodeIconsFileTypeSqlite class="group-hover:text-accent" />
        SQLite
      </div>
    </a-menu-item>
    <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MSSQL, project.id)">
      <div class="color-transition nc-project-menu-item group">
        <SimpleIconsMicrosoftsqlserver class="group-hover:text-accent" />
        MSSQL
      </div>
    </a-menu-item>
    <a-menu-item
      v-if="appInfo.ee"
      key="connect-new-source"
      @click="toggleDialog(true, 'dataSources', ClientType.SNOWFLAKE, project.id)"
    >
      <div class="color-transition nc-project-menu-item group">
        <LogosSnowflakeIcon class="group-hover:text-accent" />
        Snowflake
      </div>
    </a-menu-item>
  </a-menu-item-group>

  <a-menu-divider class="my-0" />

  <a-menu-item v-if="isUIAllowed('importRequest', false, projectRole)" key="add-new-table" class="py-1 rounded-b">
    <a
      v-e="['e:datasource:import-request']"
      href="https://github.com/nocodb/nocodb/issues/2052"
      target="_blank"
      class="prose-sm hover:(!text-primary !opacity-100) color-transition nc-project-menu-item group after:(!rounded-b)"
    >
      <GeneralIcon icon="openInNew" class="group-hover:text-accent" />
      <!-- Request a data source you need? -->
      {{ $t('labels.requestDataSource') }}
    </a>
  </a-menu-item>
</template>
