<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { storeToRefs } from 'pinia'
import { toRef } from '@vue/reactivity'
import { resolveComponent } from '@vue/runtime-core'
import { ref } from 'vue'
import { useUIPermission } from '~/composables/useUIPermission'
import { useDialog } from '~/composables/useDialog'
import { ClientType } from '~/lib'

const props = withDefaults(
  defineProps<{
    project: ProjectType
    baseIndex?: number
  }>(),
  {
    baseIndex: 0,
  },
)

const emit = defineEmits<{
  openTableCreateDialog: () => void
}>()

const { isUIAllowed } = useUIPermission()

const project = toRef(props, 'project')

const { $e } = useNuxtApp()

const projectStore = useProject()

const { isSharedBase } = storeToRefs(projectStore)

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

function openQuickImportDialog(type: string, baseId?: string) {
  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
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
const { appInfo } = useGlobal()

const { selectedBase } = useSqlEditor()

const toggleDialog = inject(ToggleDialogInj, () => {})
</script>

<template>
  <div
    v-if="isUIAllowed('table-create')"
    class="group flex items-center gap-2 pl-2 pr-3 py-2 text-primary/70 hover:(text-primary/100) cursor-pointer select-none"
    @click="emit('openTableCreateDialog')"
  >
    <PhPlusThin class="w-5 ml-2" />

    <span class="text-gray-500 group-hover:(text-primary/100) flex-1 nc-add-new-table">{{ $t('tooltip.addTable') }}</span>

    <a-dropdown v-if="!isSharedBase" :trigger="['click']" overlay-class-name="nc-dropdown-import-menu" @click.stop>
      <PhDotsThreeOutlineVerticalThin
        class="transition-opacity opacity-0 group-hover:opacity-100 nc-import-menu outline-0 text-xs"
      />

      <template #overlay>
        <a-menu class="!py-0 rounded text-sm">
          <a-menu-item-group class="!px-0 !mx-0">
            <template #title>
              <div class="flex items-center">
                Noco
                <PhSparkleFill class="ml-1 text-orange-400" />
              </div>
            </template>
            <a-menu-item key="table-magic" @click="openTableCreateMagicDialog(project.bases[baseIndex].id)">
              <div class="color-transition nc-project-menu-item group">
                <MdiMagicStaff class="group-hover:text-accent" />
                Create table
              </div>
            </a-menu-item>
            <a-menu-item key="schema-magic" @click="openSchemaMagicDialog(project.bases[baseIndex].id)">
              <div class="color-transition nc-project-menu-item group">
                <MdiMagicStaff class="group-hover:text-accent" />
                Create schema
              </div>
            </a-menu-item>
          </a-menu-item-group>

          <a-menu-divider class="my-0" />

          <!-- Quick Import From -->
          <a-menu-item-group :title="$t('title.quickImportFrom')" class="!px-0 !mx-0">
            <a-menu-item
              v-if="isUIAllowed('airtableImport')"
              key="quick-import-airtable"
              @click="openAirtableImportDialog(project.bases[baseIndex].id)"
            >
              <div class="color-transition nc-project-menu-item group">
                <MdiTableLarge class="group-hover:text-accent" />
                Airtable
              </div>
            </a-menu-item>

            <a-menu-item
              v-if="isUIAllowed('csvImport')"
              key="quick-import-csv"
              @click="openQuickImportDialog('csv', project.bases[baseIndex].id)"
            >
              <div class="color-transition nc-project-menu-item group">
                <MdiFileDocumentOutline class="group-hover:text-accent" />
                CSV file
              </div>
            </a-menu-item>

            <a-menu-item
              v-if="isUIAllowed('jsonImport')"
              key="quick-import-json"
              @click="openQuickImportDialog('json', project.bases[baseIndex].id)"
            >
              <div class="color-transition nc-project-menu-item group">
                <MdiCodeJson class="group-hover:text-accent" />
                JSON file
              </div>
            </a-menu-item>

            <a-menu-item
              v-if="isUIAllowed('excelImport')"
              key="quick-import-excel"
              @click="openQuickImportDialog('excel', project.bases[baseIndex].id)"
            >
              <div class="color-transition nc-project-menu-item group">
                <MdiFileExcel class="group-hover:text-accent" />
                Microsoft Excel
              </div>
            </a-menu-item>
          </a-menu-item-group>

          <a-menu-divider class="my-0" />

          <a-menu-item-group title="Connect to new datasource" class="!px-0 !mx-0">
            <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MYSQL)">
              <div class="color-transition nc-project-menu-item group">
                <LogosMysqlIcon class="group-hover:text-accent" />
                MySQL
              </div>
            </a-menu-item>
            <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.PG)">
              <div class="color-transition nc-project-menu-item group">
                <LogosPostgresql class="group-hover:text-accent" />
                Postgres
              </div>
            </a-menu-item>
            <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.SQLITE)">
              <div class="color-transition nc-project-menu-item group">
                <VscodeIconsFileTypeSqlite class="group-hover:text-accent" />
                SQLite
              </div>
            </a-menu-item>
            <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MSSQL)">
              <div class="color-transition nc-project-menu-item group">
                <SimpleIconsMicrosoftsqlserver class="group-hover:text-accent" />
                MSSQL
              </div>
            </a-menu-item>
            <a-menu-item
              v-if="appInfo.ee"
              key="connect-new-source"
              @click="toggleDialog(true, 'dataSources', ClientType.SNOWFLAKE)"
            >
              <div class="color-transition nc-project-menu-item group">
                <LogosSnowflakeIcon class="group-hover:text-accent" />
                Snowflake
              </div>
            </a-menu-item>
          </a-menu-item-group>

          <a-menu-divider class="my-0" />

          <a-menu-item v-if="isUIAllowed('importRequest')" key="add-new-table" class="py-1 rounded-b">
            <a
              v-e="['e:datasource:import-request']"
              href="https://github.com/nocodb/nocodb/issues/2052"
              target="_blank"
              class="prose-sm hover:(!text-primary !opacity-100) color-transition nc-project-menu-item group after:(!rounded-b)"
            >
              <MdiOpenInNew class="group-hover:text-accent" />
              <!-- Request a data source you need? -->
              {{ $t('labels.requestDataSource') }}
            </a>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>
