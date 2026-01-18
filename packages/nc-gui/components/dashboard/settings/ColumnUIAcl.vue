<script setup lang="ts">
import { inject } from '@vue/runtime-core'

type Role = 'owner' | 'creator' | 'editor' | 'commenter' | 'viewer'

const props = defineProps<{
  tableId: string
}>()

const { t } = useI18n()

const { $api, $e, $eventBus } = useNuxtApp()

const { base: activeBase } = storeToRefs(useBase())

const _projectId = inject(ProjectIdInj, ref())

const baseId = computed(() => _projectId.value ?? (activeBase.value?.id as string))

const { bases } = storeToRefs(useBases())

const base = computed(() => bases.value.get(baseId.value) ?? {})

const roles = ref<string[]>(['owner', 'creator', 'editor', 'commenter', 'viewer'])

const isLoading = ref(false)

const columns = ref<any[]>([])

const searchInput = ref('')

const filteredColumns = computed(() =>
  columns.value.filter(
    (el) =>
      (typeof el?.title === 'string' && el.title.toLowerCase().includes(searchInput.value.toLowerCase())) ||
      (typeof el?.column_name === 'string' && el.column_name.toLowerCase().includes(searchInput.value.toLowerCase())),
  ),
)

const allSelected = computed(() => {
  return roles.value.reduce((acc, role) => {
    // Check if all filtered columns are visible (not disabled) for this role
    const filtered = filteredColumns.value
    if (filtered.length === 0) {
      return { ...acc, [role]: false }
    }
    return {
      ...acc,
      [role]: filtered.every((c) => !c.disabled?.[role]),
    }
  }, {} as Record<Role, boolean>)
})

const toggleSelectAll = (role: Role, checked: boolean) => {
  // Toggle only filtered columns, not all columns
  const newDisabledValue = !checked // If checked (visible), disabled should be false

  filteredColumns.value.forEach((c) => {
    if (!c.disabled) {
      c.disabled = {}
    }
    c.disabled[role] = newDisabledValue
    c.edited = true
  })
}

async function loadColumnList() {
  try {
    if (!baseId.value || !props.tableId) {
      return
    }

    isLoading.value = true

    const result = await $api.dbTableColumn.visibilityList(props.tableId)
    // Normalize disabled objects - ensure each record has a disabled object
    columns.value = result.map((c: any) => ({
      ...c,
      disabled: c.disabled || {},
    }))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

async function saveColumnVisibility() {
  try {
    if (!baseId.value || !props.tableId) return

    const editedColumns = columns.value.filter((c) => c.edited)
    if (editedColumns.length === 0) return

    await $api.dbTableColumn.visibilitySet(props.tableId, editedColumns)
    // Updated column visibility successfully
    message.success(t('msg.success.updatedColumnVisibility'))

    // Reset edited flags after successful save
    editedColumns.forEach((c) => {
      c.edited = false
    })

    // Trigger reload of column visibility data
    $eventBus.realtimeViewMetaEventBus.emit('column_visibility_update', { tableId: props.tableId })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:base-meta:column-visibility')
}

const onRoleCheck = (record: any, role: Role) => {
  if (!record.disabled) {
    record.disabled = {}
  }
  record.disabled[role] = !record.disabled[role]
  record.edited = true
}

const handleSelectAllChange = (roleName: string, checked: boolean) => {
  toggleSelectAll(roleName as Role, checked)
}

const getAriaLabel = (record: any, columnName: string, isDisabled: boolean) => {
  if (isDisabled) {
    return t('labels.clickToMake') + ' ' + record.title + ' ' + t('labels.visibleForRole') + ' ' + columnName
  } else {
    return t('labels.clickToHide') + ' ' + record.title + ' ' + t('labels.forRole') + ' ' + columnName
  }
}

const handleRoleCheck = (record: any, columnName: string) => {
  onRoleCheck(record, columnName as Role)
}

onMounted(async () => {
  if (columns.value.length === 0) {
    await loadColumnList()
  }
})

const columnsTable = [
  {
    key: 'name',
    title: t('labels.columnName'),
    name: 'Column Name',
    minWidth: 180,
    padding: '0px 12px',
    dataIndex: 'title',
  },
  {
    key: 'action',
    title: t('objects.roleType.owner'),
    name: 'owner',
    width: 100,
    minWidth: 100,
    padding: '0px 12px',
  },
  {
    key: 'action',
    title: t('objects.roleType.creator'),
    name: 'creator',
    width: 100,
    minWidth: 100,
    padding: '0px 12px',
  },
  {
    key: 'action',
    title: t('objects.roleType.editor'),
    name: 'editor',
    width: 100,
    minWidth: 100,
    padding: '0px 12px',
  },
  {
    key: 'action',
    title: t('objects.roleType.commenter'),
    name: 'commenter',
    width: 115,
    minWidth: 115,
    padding: '0px 12px',
  },
  {
    key: 'action',
    title: t('objects.roleType.viewer'),
    name: 'viewer',
    width: 100,
    minWidth: 100,
    padding: '0px 12px',
  },
] as NcTableColumnProps[]
</script>

<template>
  <div class="h-full flex flex-col w-full">
    <div class="w-full flex-1 flex flex-col min-h-0">
      <NcTooltip class="mb-4 first-letter:capital flex-shrink-0" show-on-truncate-only>
        <template #title>{{ base.title }}</template>
        <span>{{ $t('labels.controlColumnVisibilityDescription') }}</span>
      </NcTooltip>
      <div class="flex flex-row items-center w-full mb-4 gap-2 justify-between flex-shrink-0">
        <a-input
          v-model:value="searchInput"
          :placeholder="$t('placeholder.searchColumns')"
          allow-clear
          class="nc-acl-search nc-input-border-on-value !w-[400px] nc-input-sm"
        >
          <template #prefix>
            <component :is="iconMap.search" class="text-gray-600" />
          </template>
        </a-input>
        <div class="flex">
          <a-button type="text" ghost class="self-start !rounded-md nc-acl-reload" @click="loadColumnList">
            <div class="flex items-center gap-2 text-gray-600 font-light">
              <component :is="iconMap.reload" :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />
              {{ $t('general.reload') }}
            </div>
          </a-button>

          <NcButton size="large" class="z-10 !rounded-lg !px-2 mr-2.5" type="primary" @click="saveColumnVisibility">
            <div class="flex flex-row items-center w-full gap-x-1">
              <component :is="iconMap.save" />
              <div class="flex">{{ $t('general.save') }}</div>
            </div>
          </NcButton>
        </div>
      </div>

      <NcTable
        :columns="columnsTable"
        :data="filteredColumns"
        row-height="44px"
        header-row-height="44px"
        class="flex-1 w-full min-h-0 overflow-auto"
      >
        <template #headerCell="{ column }">
          <template v-if="column.key === 'name'">
            {{ column.title }}
          </template>
          <template v-if="column.key === 'action'">
            <div class="flex flex-row gap-x-2">
              <NcCheckbox
                :checked="allSelected[column.name]"
                :disabled="!filteredColumns.length"
                class="!m-0 !top-0"
                :aria-label="t('labels.selectAllForRole', { role: column.title })"
                @change="(checked) => handleSelectAllChange(column.name, checked)"
              />
              <div class="flex">
                {{ column.title }}
              </div>
            </div>
          </template>
        </template>

        <template #bodyCell="{ column, record }">
          <template v-if="column.name === 'Column Name'">
            <div class="flex items-center gap-2 max-w-full">
              <SmartsheetHeaderIcon :column="record" class="text-gray-500" />
              <NcTooltip class="truncate" show-on-truncate-only>
                <template #title>{{ record.title }}</template>
                {{ record.title }}
              </NcTooltip>
            </div>
          </template>
          <template v-else>
            <div>
              <NcTooltip>
                <template #title>
                  <span v-if="record.disabled[column.name]">
                    {{ $t('labels.clickToMake') }} '{{ record.title }}' {{ $t('labels.visibleForRole') }} {{ column.name }}
                    {{ $t('labels.inUI') }} dashboard</span
                  >
                  <span v-else
                    >{{ $t('labels.clickToHide') }} '{{ record.title }}' {{ $t('labels.forRole') }}:{{ column.name }}
                    {{ $t('labels.inUI') }}</span
                  >
                </template>

                <NcCheckbox
                  :checked="!record.disabled?.[column.name]"
                  :class="`nc-column-acl-${record.id}-${column.name}-chkbox !ml-0.25`"
                  :aria-label="getAriaLabel(record, column.name, record.disabled?.[column.name])"
                  @change="() => handleRoleCheck(record, column.name)"
                />
              </NcTooltip>
            </div>
          </template>
        </template>
      </NcTable>
    </div>
  </div>
</template>
