<script setup lang="ts">
const props = defineProps<{
  sourceId: string
}>()

const emit = defineEmits(['baseSynced'])

const { $api } = useNuxtApp()

const baseStore = useBase()
const { loadTables } = baseStore
const { base } = storeToRefs(baseStore)

const { t } = useI18n()

const progressRef = ref()

const isLoading = ref(false)

const isDifferent = ref(false)

const triggeredSync = ref(false)

const syncCompleted = ref(false)

const metadiff = ref<any[]>([])

async function loadMetaDiff(afterSync = false) {
  try {
    if (!base.value?.id) return

    if (triggeredSync.value && !syncCompleted.value && !afterSync) return

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
    if (afterSync) syncCompleted.value = true
  }
}

const { $poller } = useNuxtApp()

const onBack = () => {
  triggeredSync.value = false
  syncCompleted.value = false
}

async function syncMetaDiff() {
  try {
    if (!base.value?.id || !isDifferent.value) return

    isLoading.value = true
    triggeredSync.value = true

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
            progressRef.value.pushProgress('Done!', data.status)

            isLoading.value = false

            await loadTables()
            await loadMetaDiff(true)

            emit('baseSynced')
          } else if (data.status === JobStatus.FAILED) {
            progressRef.value.pushProgress(data.data?.error?.message || 'Failed to sync base metadata', data.status)
            syncCompleted.value = true
            isLoading.value = false
          } else {
            // Job is still in progress
            progressRef.value.pushProgress(data.data?.message)
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

const columns = [
  {
    // Models
    title: t('labels.models'),
    key: 'table_name',
    name: 'table_name',
    minWidth: 200,
    padding: '0px 12px',
  },
  {
    // Sync state
    title: t('labels.syncState'),
    dataIndex: 'syncState',
    key: 'syncState',
    minWidth: 200,
    padding: '0px 12px',
  },
]

const customRow = (record: Record<string, any>) => ({
  class: `nc-metasync-row nc-metasync-row-${record.table_name}`,
})
</script>

<template>
  <div class="h-full flex flex-col w-full">
    <div class="h-full flex flex-col">
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
              <a-alert :message="$t('msg.info.tablesMetadataInSync')" type="success" show-icon class="!rounded-md" />
            </span>
          </div>
        </div>
        <!--        Reload -->
        <a-button
          v-e="['a:proj-meta:meta-data:reload']"
          class="self-start !rounded-md nc-btn-metasync-reload"
          @click="loadMetaDiff()"
        >
          <div class="flex items-center gap-2 text-gray-600 font-light">
            <component :is="iconMap.reload" :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />
            {{ $t('general.reload') }}
          </div>
        </a-button>
      </div>
      <div v-if="triggeredSync" class="flex flex-col justify-center items-center h-full overflow-y-auto">
        <GeneralProgressPanel ref="progressRef" class="w-1/2 h-full" />
        <div class="flex justify-center">
          <NcButton
            html-type="submit"
            class="mt-4 mb-8"
            :class="{
              'sync-completed': syncCompleted,
            }"
            size="medium"
            :disabled="!syncCompleted"
            @click="onBack"
          >
            Back
          </NcButton>
        </div>
      </div>
      <NcTable
        v-else
        :columns="columns"
        :data="metadiff ?? []"
        row-height="44px"
        header-row-height="44px"
        :is-data-loading="isLoading"
        :custom-row="customRow"
        class="nc-metasync-table h-[calc(100%_-_58px)] w-full"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'table_name'">
            <div class="flex items-center gap-2 max-w-full">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon :meta="record" class="text-gray-500" />
              </div>

              <NcTooltip class="truncate" show-on-truncate-only>
                <template #title>{{ record.title || record.table_name }}</template>
                {{ record.title || record.table_name }}
              </NcTooltip>
            </div>
          </template>
          <template v-if="column.key === 'syncState'">
            <div class="flex items-center gap-2 max-w-full">
              <NcTooltip class="truncate" show-on-truncate-only>
                <template #title> {{ record?.syncState || $t('msg.info.metaNoChange') }} </template>
                <span
                  :class="{
                    'text-red-500': record?.syncState,
                    'text-gray-500': !record?.syncState,
                  }"
                >
                  {{ record?.syncState || $t('msg.info.metaNoChange') }}
                </span>
              </NcTooltip>
            </div>
          </template>
        </template>
      </NcTable>
    </div>

    <div class="flex place-content-center item-center">
      <!--      Sync Now -->
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
