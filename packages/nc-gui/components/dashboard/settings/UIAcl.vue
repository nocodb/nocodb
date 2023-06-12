<script setup lang="ts">
import {
  Empty,
  computed,
  extractSdkResponseErrorMsg,
  h,
  iconMap,
  message,
  onMounted,
  storeToRefs,
  useGlobal,
  useI18n,
  useNuxtApp,
  useProject,
} from '#imports'

const props = defineProps<{
  baseId: string
}>()

const { t } = useI18n()

const { $api, $e } = useNuxtApp()

const { project } = storeToRefs(useProject())

const { includeM2M } = useGlobal()

const roles = $ref<string[]>(['editor', 'commenter', 'viewer'])

let isLoading = $ref(false)

let tables = $ref<any[]>([])

const searchInput = $ref('')

const filteredTables = computed(() =>
  tables.filter(
    (el) =>
      el?.base_id === props.baseId &&
      ((typeof el?._ptn === 'string' && el._ptn.toLowerCase().includes(searchInput.toLowerCase())) ||
        (typeof el?.title === 'string' && el.title.toLowerCase().includes(searchInput.toLowerCase()))),
  ),
)

async function loadTableList() {
  try {
    if (!project.value?.id) return

    isLoading = true

    tables = await $api.project.modelVisibilityList(project.value?.id, {
      includeM2M: includeM2M.value,
    })
  } catch (e) {
    console.error(e)
  } finally {
    isLoading = false
  }
}

async function saveUIAcl() {
  try {
    if (!project.value?.id) return

    await $api.project.modelVisibilitySet(
      project.value.id,
      tables.filter((t) => t.edited),
    )
    // Updated UI ACL for tables successfully
    message.success(t('msg.success.updatedUIACL'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  $e('a:proj-meta:ui-acl')
}

const onRoleCheck = (record: any, role: string) => {
  record.disabled[role] = !record.disabled[role]
  record.edited = true
}

onMounted(async () => {
  if (tables.length === 0) {
    await loadTableList()
  }
})

const tableHeaderRenderer = (label: string) => () => h('div', { class: 'text-gray-500' }, label)

const columns = [
  {
    title: tableHeaderRenderer('Table name'),
    name: 'table_name',
  },
  {
    title: tableHeaderRenderer('View name'),
    name: 'view_name',
  },
  {
    title: tableHeaderRenderer('Editor'),
    name: 'editor',
    width: 150,
  },
  {
    title: tableHeaderRenderer('Commenter'),
    name: 'commenter',
    width: 150,
  },
  {
    title: tableHeaderRenderer('Viewer'),
    name: 'viewer',
    width: 150,
  },
]
</script>

<template>
  <div class="flex flex-row w-full">
    <div class="flex flex-col w-full">
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <a-input v-model:value="searchInput" placeholder="Search models" class="nc-acl-search">
          <template #prefix>
            <component :is="iconMap.search" />
          </template>
        </a-input>

        <a-button type="text" ghost class="self-start !rounded-md nc-acl-reload" @click="loadTableList">
          <div class="flex items-center gap-2 text-gray-600 font-light">
            <component :is="iconMap.reload" :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />
            Reload
          </div>
        </a-button>

        <a-button type="primary" class="!rounded-md self-start nc-acl-save" @click="saveUIAcl">
          <div class="flex items-center gap-2 text-white font-light">
            <component :is="iconMap.save" />
            Save
          </div>
        </a-button>
      </div>

      <div class="max-h-600px overflow-y-auto">
        <a-table
          class="w-full"
          size="small"
          :data-source="filteredTables"
          :columns="columns"
          :pagination="false"
          :loading="isLoading"
          bordered
          :custom-row="
            (record) => ({
              class: `nc-acl-table-row nc-acl-table-row-${record.title}`,
            })
          "
        >
          <template #emptyText>
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
          </template>

          <template #bodyCell="{ record, column }">
            <div v-if="column.name === 'table_name'">
              <div class="flex items-center gap-1">
                <div class="min-w-5 flex items-center justify-center">
                  <GeneralTableIcon
                    :meta="{ meta: record.table_meta, type: record.ptype }"
                    class="text-gray-500"
                  ></GeneralTableIcon>
                </div>
                <span class="overflow-ellipsis min-w-0 shrink-1">{{ record._ptn }}</span>
              </div>
            </div>

            <div v-if="column.name === 'view_name'">
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
                      Click to make '{{ record.title }}' visible for role:{{ role }} in UI dashboard</span
                    >
                    <span v-else>Click to hide '{{ record.title }}' for role:{{ role }} in UI dashboard</span>
                  </template>

                  <a-checkbox
                    :checked="!record.disabled[role]"
                    :class="`nc-acl-${record.title}-${role}-chkbox`"
                    @change="onRoleCheck(record, role)"
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
