<script setup lang="ts">
import { useToast } from 'vue-toastification'
import { viewIcons } from '~/utils/viewUtils'
import { h, useNuxtApp, useProject } from '#imports'
import MdiReload from '~icons/mdi/reload'
import MdiContentSave from '~icons/mdi/content-save'
import MdiMagnify from '~icons/mdi/magnify'

const { $api, $e } = useNuxtApp()
const { project } = useProject()
const toast = useToast()

const roles = $ref<string[]>(['editor', 'commenter', 'viewer'])
let isLoading = $ref(false)
let tables = $ref<any[]>([])
const searchInput = $ref('')

const filteredTables = computed(() =>
  tables.filter(
    (el) =>
      (typeof el?._ptn === 'string' && el._ptn.toLowerCase().includes(searchInput.toLowerCase())) ||
      (typeof el?.title === 'string' && el.title.toLowerCase().includes(searchInput.toLowerCase())),
  ),
)

async function loadTableList() {
  try {
    if (!project.value?.id) return

    isLoading = true
    // TODO includeM2M
    tables = await $api.project.modelVisibilityList(project.value?.id, {
      includeM2M: '',
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
    toast.success('Updated UI ACL for tables successfully')
  } catch (e: any) {
    toast.error(e?.message)
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
    <div class="flex flex-column w-full">
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <a-input v-model:value="searchInput" placeholder="Search models" class="nc-acl-search">
          <template #prefix>
            <MdiMagnify />
          </template>
        </a-input>
        <a-button class="self-start nc-acl-reload" @click="loadTableList">
          <div class="flex items-center gap-2 text-gray-600 font-light">
            <MdiReload :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />
            Reload
          </div>
        </a-button>
        <a-button class="self-start nc-acl-save" @click="saveUIAcl">
          <div class="flex items-center gap-2 text-gray-600 font-light">
            <MdiContentSave />
            Save
          </div>
        </a-button>
      </div>
      <a-table
        class="w-full"
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
        <template #bodyCell="{ record, column }">
          <div v-if="column.name === 'table_name'">{{ record._ptn }}</div>
          <div v-if="column.name === 'view_name'">
            <div class="flex align-center">
              <component :is="viewIcons[record.type].icon" :class="`text-${viewIcons[record.type].color} mr-1`" />
              {{ record.title }}
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
                ></a-checkbox>
              </a-tooltip>
            </div>
          </div>
        </template>
      </a-table>
    </div>
  </div>
</template>
