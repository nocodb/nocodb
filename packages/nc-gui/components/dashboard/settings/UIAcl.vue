<script setup lang="ts">
import { inject } from '@vue/runtime-core'
import {
  Empty,
  ProjectIdInj,
  computed,
  extractSdkResponseErrorMsg,
  h,
  iconMap,
  message,
  onMounted,
  storeToRefs,
  useBase,
  useGlobal,
  useI18n,
  useNuxtApp,
} from '#imports'

type Role = 'editor' | 'commenter' | 'viewer'

const props = defineProps<{
  sourceId: string
}>()

const { t } = useI18n()

const { $api, $e } = useNuxtApp()

const { base } = storeToRefs(useBase())

const _projectId = inject(ProjectIdInj, ref())
const baseId = computed(() => _projectId.value ?? base.value?.id)

const { includeM2M } = useGlobal()

const roles = ref<string[]>(['editor', 'commenter', 'viewer'])

const isLoading = ref(false)

const tables = ref<any[]>([])

const searchInput = ref('')

const selectAll = ref({
  editor: false,
  commenter: false,
  viewer: false,
})

const filteredTables = computed(() =>
  tables.value.filter(
    (el) =>
      el?.source_id === props.sourceId &&
      ((typeof el?._ptn === 'string' && el._ptn.toLowerCase().includes(searchInput.value.toLowerCase())) ||
        (typeof el?.title === 'string' && el.title.toLowerCase().includes(searchInput.value.toLowerCase()))),
  ),
)

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

  selectAll.value[role as Role] = filteredTables.value.every((t) => !t.disabled[role])
}

onMounted(async () => {
  if (tables.value.length === 0) {
    await loadTableList()
  }

  for (const role of roles.value) {
    selectAll.value[role as Role] = filteredTables.value.every((t) => !t.disabled[role])
  }
})

const tableHeaderRenderer = (label: string) => () => h('div', { class: 'text-gray-500' }, label)

const columns = [
  {
    title: tableHeaderRenderer(t('labels.tableName')),
    name: 'Table Name',
  },
  {
    title: tableHeaderRenderer(t('labels.viewName')),
    name: 'View Name',
  },
  {
    title: tableHeaderRenderer(t('objects.roleType.editor')),
    name: 'editor',
    width: 120,
  },
  {
    title: tableHeaderRenderer(t('objects.roleType.commenter')),
    name: 'commenter',
    width: 120,
  },
  {
    title: tableHeaderRenderer(t('objects.roleType.viewer')),
    name: 'viewer',
    width: 120,
  },
]

const toggleSelectAll = (role: Role) => {
  selectAll.value[role] = !selectAll.value[role]
  const enabled = selectAll.value[role]

  filteredTables.value.forEach((t) => {
    t.disabled[role] = !enabled
    t.edited = true
  })
}
</script>

<template>
  <div class="flex flex-row w-full items-center justify-center">
    <div class="flex flex-col w-[900px]">
      <span class="mb-4 first-letter:capital font-bold"> UI ACL : {{ base.title }} </span>
      <div class="flex flex-row items-center w-full mb-4 gap-2 justify-between">
        <a-input v-model:value="searchInput" :placeholder="$t('placeholder.searchModels')" class="nc-acl-search !w-[400px]">
          <template #prefix>
            <component :is="iconMap.search" />
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

      <div class="max-h-600px overflow-y-auto">
        <a-table
          class="w-full"
          size="small"
          :data-source="filteredTables"
          :columns="columns"
          :pagination="false"
          :loading="isLoading"
          sticky
          bordered
          :custom-row="
            (record) => ({
              class: `nc-acl-table-row nc-acl-table-row-${record.title}`,
            })
          "
        >
          <template #headerCell="{ column }">
            <template v-if="['editor', 'commenter', 'viewer'].includes(column.name)">
              <div class="flex flex-row gap-x-1">
                <NcCheckbox :checked="selectAll[column.name as Role]" @change="() => toggleSelectAll(column.name)" />
                <div class="flex capitalize">
                  {{ column.name }}
                </div>
              </div>
            </template>
            <template v-else>{{ column.name }}</template>
          </template>
          <template #emptyText>
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
          </template>

          <template #bodyCell="{ record, column }">
            <div v-if="column.name === 'Table Name'">
              <div class="flex items-center gap-1">
                <div class="min-w-5 flex items-center justify-center">
                  <GeneralTableIcon :meta="{ meta: record.table_meta, type: record.ptype }" class="text-gray-500" />
                </div>
                <GeneralTruncateText>
                  <span class="overflow-ellipsis min-w-0 shrink-1">{{ record._ptn }}</span>
                </GeneralTruncateText>
              </div>
            </div>

            <div v-if="column.name === 'View Name'">
              <div class="flex items-center gap-1">
                <div class="min-w-5 flex items-center justify-center">
                  <GeneralViewIcon :meta="record" class="text-gray-500"></GeneralViewIcon>
                </div>
                <span class="overflow-ellipsis min-w-0 shrink-1">{{ record.title }}</span>
              </div>
            </div>

            <div v-for="role in roles" :key="role">
              <div v-if="column.name === role">
                <a-tooltip>
                  <template #title>
                    <span v-if="record.disabled[role]">
                      {{ $t('labels.clickToMake') }} '{{ record.title }}' {{ $t('labels.visibleForRole') }} {{ role }}
                      {{ $t('labels.inUI') }} dashboard</span
                    >
                    <span v-else
                      >{{ $t('labels.clickToHide') }}'{{ record.title }}' {{ $t('labels.forRole') }}:{{ role }}
                      {{ $t('labels.inUI') }}</span
                    >
                  </template>

                  <NcCheckbox
                    :checked="!record.disabled[role]"
                    :class="`nc-acl-${record.title}-${role}-chkbox !ml-0.25`"
                    @change="onRoleCheck(record, role as Role)"
                  />
                </a-tooltip>
              </div>
            </div>
          </template>
        </a-table>
      </div>
    </div>
  </div>
</template>
