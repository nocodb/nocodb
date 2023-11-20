<script setup lang="ts">
import { Empty, extractSdkResponseErrorMsg, h, iconMap, message, storeToRefs, useBase, useI18n, useNuxtApp } from '#imports'

const props = defineProps<{
  sourceId: string
}>()

const emit = defineEmits(['baseSynced'])

const { $api } = useNuxtApp()

const baseStore = useBase()
const { loadTables } = baseStore
const { base } = storeToRefs(baseStore)

const { t } = useI18n()

const isLoading = ref(false)

const isDifferent = ref(false)

const metadiff = ref<any[]>([])

async function loadMetaDiff() {
  try {
    if (!base.value?.id) return

    isLoading.value = true
    isDifferent.value = false
    metadiff.value = await $api.source.metaDiffGet(base.value?.id, props.sourceId)
    for (const model of metadiff.value) {
      if (model.detectedChanges?.length > 0) {
        model.syncState = model.detectedChanges.map((el: any) => el?.msg).join(', ')
        isDifferent.value = true
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

const { $poller } = useNuxtApp()

async function syncMetaDiff() {
  try {
    if (!base.value?.id || !isDifferent.value) return

    isLoading.value = true
    const jobData = await $api.source.metaDiffSync(base.value?.id, props.sourceId)

    $poller.subscribe(
      { id: jobData.id },
      async (data: {
        id: string
        status?: string
        data?: {
          error?: {
            message: string
          }
          message?: string
          result?: any
        }
      }) => {
        if (data.status !== 'close') {
          if (data.status === JobStatus.COMPLETED) {
            // Table metadata recreated successfully
            message.info(t('msg.info.metaDataRecreated'))
            await loadTables()
            await loadMetaDiff()
            emit('baseSynced')
            isLoading.value = false
          } else if (status === JobStatus.FAILED) {
            message.error('Failed to sync base metadata')
            isLoading.value = false
          }
        }
      },
    )
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

onMounted(async () => {
  if (metadiff.value.length === 0) {
    await loadMetaDiff()
  }
})

const tableHeaderRenderer = (label: string) => () => h('div', { class: 'text-gray-500' }, label)

const columns = [
  {
    // Models
    title: tableHeaderRenderer(t('labels.models')),
    key: 'table_name',
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
  <div class="flex flex-col w-full">
    <div class="flex flex-col">
      <div class="flex flex-row justify-between items-center w-full mb-4">
        <div class="flex">
          <div v-if="isDifferent">
            <a-button v-e="['a:proj-meta:meta-data:sync']" class="nc-btn-metasync-sync-now" type="primary" @click="syncMetaDiff">
              <div class="flex items-center gap-2">
                <component :is="iconMap.databaseSync" />
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
        <!--        Reload -->
        <a-button
          v-e="['a:proj-meta:meta-data:reload']"
          class="self-start !rounded-md nc-btn-metasync-reload"
          @click="loadMetaDiff"
        >
          <div class="flex items-center gap-2 text-gray-600 font-light">
            <component :is="iconMap.reload" :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />
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

          <template #bodyCell="{ record, column }">
            <div v-if="column.key === 'table_name'">
              <div class="flex items-center gap-1">
                <div class="min-w-5 flex items-center justify-center">
                  <GeneralTableIcon :meta="record" class="text-gray-500" />
                </div>
                <span class="overflow-ellipsis min-w-0 shrink-1">{{ record.title || record.table_name }}</span>
              </div>
            </div>
          </template>
        </a-table>
      </div>
    </div>

    <div class="flex place-content-center item-center">
      <!--      Sync Now -->
    </div>
  </div>
</template>
