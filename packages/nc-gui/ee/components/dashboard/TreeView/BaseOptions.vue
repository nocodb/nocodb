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

const emits = defineEmits(['update:base'])

const source = toRef(props, 'source')

const base = useVModel(props, 'base', emits)

const { isUIAllowed } = useRoles()

const baseRole = computed(() => base.value?.project_role || base.value?.workspace_role)

const { $e } = useNuxtApp()

const { showRecordPlanLimitExceededModal } = useEeConfig()

const { isFeatureEnabled } = useBetaFeatureToggle()

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

  if (showRecordPlanLimitExceededModal()) return

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
  if (!source.value?.id || !base.value?.id) return

  if (showRecordPlanLimitExceededModal()) return

  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'baseId': base.value.id,
    'sourceId': source.value.id,
    'showSourceSelector': props.showSourceSelector,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openNocoDbImportDialog(baseId?: string) {
  if (!baseId) return

  $e('a:actions:import-nocodb')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgNocoDbImport'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}
const isNocoDbImportAllowed = computed(() => {
  return (
    props.showNocoDbImport &&
    isFeatureEnabled(FEATURE_FLAG.IMPORT_FROM_NOCODB) &&
    isUIAllowed('nocodbImport', { roles: baseRole.value, source: source.value })
  )
})
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
      ['airtableImport', 'csvImport', 'jsonImport', 'excelImport'].some((permission) =>
        isUIAllowed(permission, { roles: baseRole, source }),
      ) || isNocoDbImportAllowed
    "
    class="py-0"
    :class="submenuClass"
    data-testid="nc-sidebar-base-import"
    :variant="variant"
    :title-class="titleClass"
    :popup-offset="popupOffset"
    @click.stop
  >
    <template #title>
      <slot name="title">
        <GeneralIcon icon="download" />

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

    <NcMenuItem v-if="isNocoDbImportAllowed" key="quick-import-nocodb" @click="openNocoDbImportDialog(base.id)">
      <GeneralIcon icon="nocodb1" class="w-4 h-4" />
      {{ $t('objects.syncData.nocodb') }}
    </NcMenuItem>
  </NcSubMenu>
</template>
