<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'
import { storeToRefs } from 'pinia'
import { toRef } from '@vue/reactivity'
import { resolveComponent } from '@vue/runtime-core'
import { ref } from 'vue'
import { ProjectRoleInj, useDialog, useRoles } from '#imports'

const props = withDefaults(
  defineProps<{
    base: BaseType
    sourceIndex?: number
  }>(),
  {
    sourceIndex: 0,
  },
)

const emit = defineEmits<{
  openTableCreateDialog: () => void
}>()

const { isUIAllowed } = useRoles()

const base = toRef(props, 'base')

const { $e } = useNuxtApp()

const baseStore = useBase()

const { isSharedBase } = storeToRefs(baseStore)

const baseRole = inject(ProjectRoleInj)

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

function openQuickImportDialog(type: string, sourceId?: string) {
  if (!sourceId) return

  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
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

function openTableCreateMagicDialog(sourceId?: string) {
  if (!sourceId) return

  $e('c:table:create:navdraw')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgTableMagic'), {
    'modelValue': isOpen,
    'sourceId': sourceId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <div
    v-if="isUIAllowed('tableCreate', { roles: baseRole })"
    class="group flex items-center gap-2 pl-2 pr-4.75 py-1 text-primary/70 hover:(text-primary/100) cursor-pointer select-none"
    @click="emit('openTableCreateDialog')"
  >
    <PhPlusThin class="w-5 ml-2" />

    <span class="text-gray-500 group-hover:(text-primary/100) flex-1 nc-add-new-table">{{ $t('tooltip.addTable') }}</span>

    <a-dropdown v-if="!isSharedBase" :trigger="['click']" overlay-class-name="nc-dropdown-import-menu" @click.stop>
      <GeneralIcon
        icon="threeDotVertical"
        class="transition-opacity opacity-0 group-hover:opacity-100 nc-import-menu outline-0"
      />

      <template #overlay>
        <a-menu class="!py-0 rounded text-sm">
          <a-menu-item-group class="!px-0 !mx-0">
            <template #title>
              <div class="flex items-center">
                Noco
                <GeneralIcon icon="magic" class="ml-1 text-orange-400" />
              </div>
            </template>
            <a-menu-item key="table-magic" @click="openTableCreateMagicDialog(base.sources[sourceIndex].id)">
              <div class="color-transition nc-base-menu-item group">
                <GeneralIcon icon="magic1" class="group-hover:text-accent" />
                Create table
              </div>
            </a-menu-item>
            <a-menu-item key="schema-magic" @click="openSchemaMagicDialog(base.sources[sourceIndex].id)">
              <div class="color-transition nc-base-menu-item group">
                <GeneralIcon icon="magic1" class="group-hover:text-accent" />
                Create schema
              </div>
            </a-menu-item>
          </a-menu-item-group>

          <a-menu-divider class="my-0" />

          <!-- Quick Import From -->
          <a-menu-item-group :title="$t('title.quickImportFrom')" class="!px-0 !mx-0">
            <a-menu-item
              v-if="isUIAllowed('airtableImport', { roles: baseRole })"
              key="quick-import-airtable"
              @click="openAirtableImportDialog(base.id, base.sources[sourceIndex].id)"
            >
              <div class="color-transition nc-base-menu-item group">
                <GeneralIcon icon="airtable" class="group-hover:text-accent" />
                Airtable
              </div>
            </a-menu-item>

            <a-menu-item
              v-if="isUIAllowed('csvImport', { roles: baseRole })"
              key="quick-import-csv"
              @click="openQuickImportDialog('csv', base.sources[sourceIndex].id)"
            >
              <div class="color-transition nc-base-menu-item group">
                <GeneralIcon icon="csv" class="group-hover:text-accent" />
                CSV file
              </div>
            </a-menu-item>

            <a-menu-item
              v-if="isUIAllowed('jsonImport', { roles: baseRole })"
              key="quick-import-json"
              @click="openQuickImportDialog('json', base.sources[sourceIndex].id)"
            >
              <div class="color-transition nc-base-menu-item group">
                <GeneralIcon icon="json" class="group-hover:text-accent" />
                JSON file
              </div>
            </a-menu-item>

            <a-menu-item
              v-if="isUIAllowed('excelImport', { roles: baseRole })"
              key="quick-import-excel"
              @click="openQuickImportDialog('excel', base.sources[sourceIndex].id)"
            >
              <div class="color-transition nc-base-menu-item group">
                <GeneralIcon icon="excel" class="group-hover:text-accent" />
                Microsoft Excel
              </div>
            </a-menu-item>
          </a-menu-item-group>

          <a-menu-divider class="my-0" />

          <!-- <a-menu-item-group title="Connect to new datasource" class="!px-0 !mx-0">
            <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MYSQL, base.id)">
              <div class="color-transition nc-base-menu-item group">
                <LogosMysqlIcon class="group-hover:text-accent" />
                MySQL
              </div>
            </a-menu-item>
            <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.PG, base.id)">
              <div class="color-transition nc-base-menu-item group">
                <LogosPostgresql class="group-hover:text-accent" />
                Postgres
              </div>
            </a-menu-item>
            <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.SQLITE, base.id)">
              <div class="color-transition nc-base-menu-item group">
                <VscodeIconsFileTypeSqlite class="group-hover:text-accent" />
                SQLite
              </div>
            </a-menu-item>
            <a-menu-item key="connect-new-source" @click="toggleDialog(true, 'dataSources', ClientType.MSSQL, base.id)">
              <div class="color-transition nc-base-menu-item group">
                <SimpleIconsMicrosoftsqlserver class="group-hover:text-accent" />
                MSSQL
              </div>
            </a-menu-item>
            <a-menu-item
              v-if="appInfo.ee"
              key="connect-new-source"
              @click="toggleDialog(true, 'dataSources', ClientType.SNOWFLAKE, base.id)"
            >
              <div class="color-transition nc-base-menu-item group">
                <LogosSnowflakeIcon class="group-hover:text-accent" />
                Snowflake
              </div>
            </a-menu-item>
          </a-menu-item-group>

          <a-menu-divider class="my-0" /> -->

          <a-menu-item v-if="isUIAllowed('importRequest', { roles: baseRole })" key="add-new-table" class="py-1 rounded-b">
            <a
              v-e="['e:datasource:import-request']"
              href="https://github.com/nocodb/nocodb/issues/2052"
              target="_blank"
              class="prose-sm hover:(!text-primary !opacity-100) color-transition nc-base-menu-item group after:(!rounded-b)"
              rel="noopener noreferrer"
            >
              <GeneralIcon icon="openInNew" class="group-hover:text-accent" />
              <!-- Request a data source you need? -->
              {{ $t('labels.requestDataSource') }}
            </a>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>
