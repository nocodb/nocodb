<script setup lang="ts">
import { inject } from '@vue/runtime-core'

type Role = 'editor' | 'commenter' | 'viewer'

const props = defineProps<{
  sourceId: string
}>()

const { t } = useI18n()

const { $api, $e } = useNuxtApp()

const { base: activeBase } = storeToRefs(useBase())

const _projectId = inject(ProjectIdInj, ref())

const baseId = computed(() => _projectId.value ?? (activeBase.value?.id as string))

const { bases } = storeToRefs(useBases())

const base = computed(() => bases.value.get(baseId.value) ?? {})

const { includeM2M } = useGlobal()

const roles = ref<string[]>(['editor', 'commenter', 'viewer'])

const isLoading = ref(false)

const tables = ref<any[]>([])

const searchInput = ref('')

const filteredTables = computed(() =>
  tables.value.filter(
    (el) =>
      el?.source_id === props.sourceId &&
      ((typeof el?._ptn === 'string' && el._ptn.toLowerCase().includes(searchInput.value.toLowerCase())) ||
        (typeof el?.title === 'string' && el.title.toLowerCase().includes(searchInput.value.toLowerCase()))),
  ),
)

const allSelected = computed(() => {
  return roles.value.reduce((acc, role) => {
    return {
      ...acc,
      [role]: tables.value.filter((t) => t.disabled[role]).length === 0,
    }
  }, {} as Record<Role, boolean>)
})

const toggleSelectAll = (role: Role) => {
  const newValue = !allSelected.value[role]

  tables.value.forEach((t) => {
    t.disabled[role] = newValue
    t.edited = true
  })
}

async function loadTableList() {
  try {
    if (!baseId.value) return

    isLoading.value = true

    tables.value = await $api.base.modelVisibilityList(baseId.value, {
      includeM2M: includeM2M.value,
    })
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

async function saveUIAcl() {
  try {
    if (!baseId.value) return

    await $api.base.modelVisibilitySet(
      baseId.value,
      tables.value.filter((t) => t.edited),
    )
    // Updated UI ACL for tables successfully
    message.success(t('msg.success.updatedUIACL'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:proj-meta:ui-acl')
}

const onRoleCheck = (record: any, role: Role) => {
  record.disabled[role] = !record.disabled[role]
  record.edited = true
}

onMounted(async () => {
  if (tables.value.length === 0) {
    await loadTableList()
  }
})

const columns = [
  {
    key: 'name',
    title: t('labels.tableName'),
    name: 'Table Name',
    minWidth: 220,
    padding: '0px 12px',
    dataIndex: '_ptn',
  },
  {
    key: 'name',
    title: t('labels.viewName'),
    name: 'View Name',
    minWidth: 220,
    padding: '0px 12px',
    dataIndex: 'title',
  },
  {
    key: 'action',
    title: t('objects.roleType.editor'),
    name: 'editor',
    width: 120,
    minWidth: 120,
    padding: '0px 12px',
  },
  {
    key: 'action',
    title: t('objects.roleType.commenter'),
    name: 'commenter',
    width: 135,
    minWidth: 135,
    padding: '0px 12px',
  },
  {
    key: 'action',
    title: t('objects.roleType.viewer'),
    name: 'viewer',
    width: 120,
    minWidth: 120,
    padding: '0px 12px',
  },
] as NcTableColumnProps[]
</script>

<template>
  <div class="h-full flex flex-row w-full items-center justify-center">
    <div class="w-full h-full flex flex-col">
      <NcTooltip class="mb-4 first-letter:capital" show-on-truncate-only>
        <template #title>{{ base.title }}</template>
        <span> Control view visibility for different roles to manage access efficiently. </span>
      </NcTooltip>
      <div class="flex flex-row items-center w-full mb-4 gap-2 justify-between">
        <a-input
          v-model:value="searchInput"
          :placeholder="$t('placeholder.searchModels')"
          allow-clear
          class="nc-acl-search nc-input-border-on-value !w-[400px] nc-input-sm"
        >
          <template #prefix>
            <component :is="iconMap.search" class="text-gray-600" />
          </template>
        </a-input>
        <div class="flex">
          <a-button type="text" ghost class="self-start !rounded-md nc-acl-reload" @click="loadTableList">
            <div class="flex items-center gap-2 text-gray-600 font-light">
              <component :is="iconMap.reload" :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />
              {{ $t('general.reload') }}
            </div>
          </a-button>

          <NcButton size="large" class="z-10 !rounded-lg !px-2 mr-2.5" type="primary" @click="saveUIAcl">
            <div class="flex flex-row items-center w-full gap-x-1">
              <component :is="iconMap.save" />
              <div class="flex">{{ $t('general.save') }}</div>
            </div>
          </NcButton>
        </div>
      </div>

      <NcTable
        :columns="columns"
        :data="filteredTables"
        row-height="44px"
        header-row-height="44px"
        class="h-[calc(100%_-_88px)] w-full"
      >
        <template #headerCell="{ column }">
          <template v-if="column.key === 'name'">
            {{ column.title }}
          </template>
          <template v-if="column.key === 'action'">
            <div class="flex flex-row gap-x-2">
              <NcCheckbox
                v-model:checked="allSelected[column.name as Role]"
                :disabled="!filteredTables.length"
                class="!m-0 !top-0"
                @change="toggleSelectAll(column.name as Role)"
              />
              <div class="flex">
                {{ column.title }}
              </div>
            </div>
          </template>
        </template>

        <template #bodyCell="{ column, record }">
          <template v-if="column.name === 'Table Name'">
            <div class="flex items-center gap-2 max-w-full">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon :meta="{ meta: record.table_meta, type: record.ptype }" class="text-gray-500" />
              </div>

              <NcTooltip class="truncate" show-on-truncate-only>
                <template #title>{{ record._ptn }}</template>
                {{ record._ptn }}
              </NcTooltip>
            </div>
          </template>
          <template v-else-if="column.name === 'View Name'">
            <div class="flex items-center gap-2 max-w-full">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon
                  v-if="record?.meta?.icon"
                  :meta="{ meta: record.meta, type: 'view' }"
                  class="text-gray-500 !text-sm children:(!w-5 !h-5)"
                />
                <GeneralViewIcon v-else :meta="record" class="text-gray-500"></GeneralViewIcon>
              </div>
              <NcTooltip class="truncate" show-on-truncate-only>
                <template #title>{{ record.is_default ? $t('title.defaultView') : record.title }}</template>
                {{ record.is_default ? $t('title.defaultView') : record.title }}
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
                  :checked="!record.disabled[column.name]"
                  :class="`nc-acl-${record.title}-${column.name}-chkbox !ml-0.25`"
                  @change="onRoleCheck(record, column.name as Role)"
                />
              </NcTooltip>
            </div>
          </template>
        </template>
      </NcTable>
    </div>
  </div>
</template>
