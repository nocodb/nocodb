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

const baseId = computed(() => _projectId.value ?? activeBase.value?.id!)

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
    title: t('labels.tableName'),
    name: 'Table Name',
  },
  {
    title: t('labels.viewName'),
    name: 'View Name',
  },
  {
    title: t('objects.roleType.editor'),
    name: 'editor',
    width: 120,
  },
  {
    title: t('objects.roleType.commenter'),
    name: 'commenter',
    width: 120,
  },
  {
    title: t('objects.roleType.viewer'),
    name: 'viewer',
    width: 120,
  },
]
</script>

<template>
  <div class="h-full flex flex-row w-full items-center justify-center">
    <div class="w-full h-full flex flex-col">
      <NcTooltip class="mb-4 first-letter:capital font-bold max-w-100 truncate" show-on-truncate-only>
        <template #title>{{ base.title }}</template>
        <span> UI ACL : {{ base.title }} </span>
      </NcTooltip>
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

      <div class="h-auto max-h-[calc(100%_-_102px)] overflow-y-auto nc-scrollbar-thin">
        <div class="w-full" size="small">
          <div class="table-header">
            <template v-for="column in columns" :key="column.name">
              <template v-if="['editor', 'commenter', 'viewer'].includes(column.name)">
                <div class="table-header-col" :style="`width: ${column.width}px`">
                  <div class="flex flex-row gap-x-1">
                    <NcCheckbox
                      v-model:checked="allSelected[column.name as Role]"
                      @change="toggleSelectAll(column.name as Role)"
                    />
                    <div class="flex capitalize">
                      {{ column.name }}
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="table-header-col flex-1">
                  <div class="flex capitalize">{{ column.title }}</div>
                </div>
              </template>
            </template>
          </div>

          <template v-if="filteredTables.length === 0">
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
          </template>

          <template v-else>
            <div
              v-for="record in filteredTables"
              :key="record.id"
              :class="`table-body-row nc-acl-table-row nc-acl-table-row-${record.title}`"
            >
              <template v-for="column in columns" :key="column.name">
                <template v-if="column.name === 'Table Name'">
                  <div class="table-body-row-col flex-1">
                    <div class="min-w-5 flex items-center justify-center">
                      <GeneralTableIcon :meta="{ meta: record.table_meta, type: record.ptype }" class="text-gray-500" />
                    </div>
                    <NcTooltip class="overflow-ellipsis min-w-0 shrink-1 truncate" show-on-truncate-only>
                      <template #title>{{ record._ptn }}</template>
                      <span>{{ record._ptn }}</span>
                    </NcTooltip>
                  </div>
                </template>
                <template v-else-if="column.name === 'View Name'">
                  <div class="table-body-row-col flex-1">
                    <div class="min-w-5 flex items-center justify-center">
                      <GeneralTableIcon
                        v-if="record?.meta?.icon"
                        :meta="{ meta: record.meta, type: 'view' }"
                        class="text-gray-500 !text-sm children:(!w-5 !h-5)"
                      />
                      <GeneralViewIcon v-else :meta="record" class="text-gray-500"></GeneralViewIcon>
                    </div>
                    <NcTooltip class="overflow-ellipsis min-w-0 shrink-1 truncate" show-on-truncate-only>
                      <template #title>{{ record.is_default ? $t('title.defaultView') : record.title }}</template>
                      <span>{{ record.is_default ? $t('title.defaultView') : record.title }}</span>
                    </NcTooltip>
                  </div>
                </template>
                <template v-else>
                  <div class="table-body-row-col" :style="`width: ${column.width}px`">
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
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.table-header {
  @apply flex items-center bg-gray-100 border-1 border-gray-200;
}

.table-header-col {
  @apply flex items-center p-2 border-r-1 border-gray-200;
}

.table-header-col:last-child {
  @apply border-r-0;
}

.table-body-row {
  @apply flex items-center bg-white border-r-1 border-l-1 border-b-1 border-gray-200;
}

.table-body-row-col {
  @apply flex items-center p-2 border-r-1 border-gray-200;
}

.table-body-row-col:last-child {
  @apply border-r-0;
}
</style>
