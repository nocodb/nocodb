<script setup lang="ts">
import { useToast } from 'vue-toastification'
import { h, useNuxtApp, useProject } from '#imports'
import MdiReload from '~icons/mdi/reload'
import MdiDatabaseSync from '~icons/mdi/database-sync'

const { $api } = useNuxtApp()
const { project } = useProject()
const toast = useToast()

let isLoading = $ref(false)
let isDifferent = $ref(false)
let metadiff = $ref<any[]>([])

async function loadMetaDiff() {
  try {
    if (!project.value?.id) return

    isLoading = true
    isDifferent = false
    metadiff = await $api.project.metaDiffGet(project.value?.id)
    for (const model of metadiff) {
      if (model.detectedChanges?.length > 0) {
        model.syncState = model.detectedChanges.map((el: any) => el?.msg).join(', ')
        isDifferent = true
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    isLoading = false
  }
}

async function syncMetaDiff() {
  try {
    if (!project.value?.id || !isDifferent) return

    isLoading = true
    await $api.project.metaDiffSync(project.value.id)
    toast.info(`Table metadata recreated successfully`)
    await loadMetaDiff()
  } catch (e: any) {
    if (e.response?.status === 402) {
      toast.info(e.message)
    } else {
      toast.error(e.message)
    }
  } finally {
    isLoading = false
  }
}

onMounted(async () => {
  if (metadiff.length === 0) {
    await loadMetaDiff()
  }
})

const tableHeaderRenderer = (label: string) => () => h('div', { class: 'text-gray-500' }, label)

const columns = [
  {
    title: tableHeaderRenderer('Models'),
    dataIndex: 'title',
    key: 'title',
  },
  {
    title: tableHeaderRenderer('Sync State'),
    dataIndex: 'syncState',
    key: 'syncState',
    customRender: (value: { text: string }) =>
      h('div', { style: { color: value.text ? 'red' : 'gray' } }, value.text || 'No change identified'),
  },
]
</script>

<template>
  <div class="flex flex-row w-full">
    <div class="flex flex-column w-3/5">
      <div class="flex flex-row justify-end items-center w-full mb-4">
        <a-button class="self-start nc-btn-metasync-reload" @click="loadMetaDiff">
          <div class="flex items-center gap-2 text-gray-600 font-light">
            <MdiReload :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />
            Reload
          </div>
        </a-button>
      </div>
      <a-table
        class="w-full"
        :custom-row="
          (record) => ({
            class: `nc-metasync-row nc-metasync-row-${record.title}`,
          })
        "
        :data-source="metadiff ?? []"
        :columns="columns"
        :pagination="false"
        :loading="isLoading"
        bordered
      />
    </div>
    <div class="flex place-content-center w-2/5">
      <div v-if="isDifferent">
        <a-button v-t="['a:proj-meta:meta-data:sync']" class="nc-btn-metasync-sync-now" type="primary" @click="syncMetaDiff">
          <div class="flex items-center gap-2">
            <MdiDatabaseSync />
            Sync Now
          </div>
        </a-button>
      </div>
      <div v-else>
        <span><a-alert message="Tables metadata is in sync" type="success" show-icon /></span>
      </div>
    </div>
  </div>
</template>
