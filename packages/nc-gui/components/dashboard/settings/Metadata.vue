<script setup lang="ts">
import { Empty, extractSdkResponseErrorMsg, h, message, useI18n, useNuxtApp, useProject } from '#imports'

const props = defineProps<{
  baseId: string
}>()

const { $api } = useNuxtApp()

const { project, loadTables } = useProject()

const { t } = useI18n()

let isLoading = $ref(false)

let isDifferent = $ref(false)

let metadiff = $ref<any[]>([])

async function loadMetaDiff() {
  try {
    if (!project.value?.id) return

    isLoading = true
    isDifferent = false
    metadiff = await $api.base.metaDiffGet(project.value?.id, props.baseId)
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
    await $api.base.metaDiffSync(project.value.id, props.baseId)
    // Table metadata recreated successfully
    message.info(t('msg.info.metaDataRecreated'))
    await loadTables()
    await loadMetaDiff()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
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
    // Models
    title: tableHeaderRenderer(t('labels.models')),
    key: 'table_name',
    customRender: ({ record }: { record: { table_name: string; title?: string } }) =>
      h('div', {}, record.title || record.table_name),
  },
  {
    // Sync state
    title: tableHeaderRenderer(t('labels.syncState')),
    dataIndex: 'syncState',
    key: 'syncState',
    // No change identified
    customRender: (value: { text: string }) =>
      h('div', { style: { color: value.text ? 'red' : 'gray' } }, value.text || t('msg.info.metaNoChange')),
  },
]
</script>

<template>
  <div class="flex flex-row w-full">
    <div class="flex flex-col w-3/5">
      <div class="flex flex-row justify-end items-center w-full mb-4">
        <!--        Reload -->
        <a-button v-e="['a:proj-meta:meta-data:reload']" class="self-start nc-btn-metasync-reload" @click="loadMetaDiff">
          <div class="flex items-center gap-2 text-gray-600 font-light">
            <MdiReload :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />
            {{ $t('general.reload') }}
          </div>
        </a-button>
      </div>

      <div class="max-h-600px overflow-y-auto">
        <a-table
          class="w-full"
          size="small"
          :custom-row="
            (record) => ({
              class: `nc-metasync-row nc-metasync-row-${record.table_name}`,
            })
          "
          :data-source="metadiff ?? []"
          :columns="columns"
          :pagination="false"
          :loading="isLoading"
          bordered
        >
          <template #emptyText>
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
          </template>
        </a-table>
      </div>
    </div>

    <div class="flex place-content-center w-2/5">
      <!--      Sync Now -->
      <div v-if="isDifferent">
        <a-button v-e="['a:proj-meta:meta-data:sync']" class="nc-btn-metasync-sync-now" type="primary" @click="syncMetaDiff">
          <div class="flex items-center gap-2">
            <MdiDatabaseSync />
            {{ $t('activity.metaSync') }}
          </div>
        </a-button>
      </div>

      <div v-else>
        <!--        Tables metadata is in sync -->
        <span>
          <a-alert :message="$t('msg.info.tablesMetadataInSync')" type="success" show-icon />
        </span>
      </div>
    </div>
  </div>
</template>
