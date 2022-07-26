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

let isLoading = $ref(false)
let tables = $ref<Array<any>>([])
let searchInput = $ref<string>('')

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
    // { icon: MdiGridIcon, color: 'blue' },
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
        <a-input v-model:value="searchInput" placeholder="Search models">
          <template #prefix>
            <MdiMagnify />
          </template>
        </a-input>
        <a-button class="self-start" @click="loadTableList">
          <div class="flex items-center gap-2 text-gray-600 font-light">
            <MdiReload :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />
            Reload
          </div>
        </a-button>
        <a-button class="self-start" @click="saveUIAcl">
          <div class="flex items-center gap-2 text-gray-600 font-light">
            <MdiContentSave />
            Save
          </div>
        </a-button>
      </div>
      <a-table
        class="w-full"
        :data-source="
          tables.filter(
            (el) =>
              (typeof el?._ptn === 'string' && el._ptn.toLowerCase().includes(searchInput.toLowerCase())) ||
              (typeof el?.title === 'string' && el.title.toLowerCase().includes(searchInput.toLowerCase())),
          )
        "
        :columns="columns"
        :pagination="false"
        :loading="isLoading"
        bordered
      >
        <template #bodyCell="{ record, column }">
          <div v-if="column.name === 'table_name'">{{ record._ptn }}</div>
          <div v-if="column.name === 'view_name'">
            <div class="flex align-center">
              <component :is="viewIcons[record.type].icon" :class="`text-${viewIcons[record.type].color} mr-1`" />
              {{ record.title }}
            </div>
          </div>
          <div v-if="column.name === 'editor'">
            <a-tooltip>
              <template #title>Click to hide '{{ record.title }}' for role:Editor in UI dashboard</template>
              <a-checkbox
                :checked="!record.disabled.editor"
                @change="
                  // eslint-disable-next-line prettier/prettier
                  record.disabled.editor = !record.disabled.editor;
                  record.edited = true
                "
              ></a-checkbox>
            </a-tooltip>
          </div>
          <div v-if="column.name === 'commenter'">
            <a-tooltip>
              <template #title>Click to hide '{{ record.title }}' for role:Commenter in UI dashboard</template>
              <a-checkbox
                :checked="!record.disabled.commenter"
                @change="
                  // eslint-disable-next-line prettier/prettier
                  record.disabled.commenter = !record.disabled.commenter;
                  record.edited = true
                "
              ></a-checkbox>
            </a-tooltip>
          </div>
          <div v-if="column.name === 'viewer'">
            <a-tooltip>
              <template #title>Click to hide '{{ record.title }}' for role:Viewer in UI dashboard</template>
              <a-checkbox
                :checked="!record.disabled.viewer"
                @change="
                  // eslint-disable-next-line prettier/prettier
                  record.disabled.viewer = !record.disabled.viewer;
                  record.edited = true
                "
              ></a-checkbox>
            </a-tooltip>
          </div>
        </template>
      </a-table>
    </div>
  </div>
</template>
