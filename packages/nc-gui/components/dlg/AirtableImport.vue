<script setup lang="ts">
import type { Card as AntCard } from 'ant-design-vue'
import {
  Form,
  JobStatus,
  computed,
  extractSdkResponseErrorMsg,
  fieldRequiredValidator,
  iconMap,
  message,
  nextTick,
  onMounted,
  ref,
  useNuxtApp,
  watch,
} from '#imports'

const { modelValue, baseId, sourceId } = defineProps<{
  modelValue: boolean
  baseId: string
  sourceId: string
}>()

const emit = defineEmits(['update:modelValue'])

const { $api } = useNuxtApp()

const baseURL = $api.instance.defaults.baseURL

const { $state, $poller } = useNuxtApp()

const baseStore = useBase()

const { refreshCommandPalette } = useCommandPalette()

const { loadTables } = baseStore

const showGoToDashboardButton = ref(false)

const step = ref(1)

const progress = ref<Record<string, any>[]>([])

const logRef = ref<typeof AntCard>()

const enableAbort = ref(false)

const goBack = ref(false)

const listeningForUpdates = ref(false)

const syncSource = ref({
  id: '',
  type: 'Airtable',
  details: {
    syncInterval: '15mins',
    syncDirection: 'Airtable to NocoDB',
    syncRetryCount: 1,
    apiKey: '',
    appId: '',
    shareId: '',
    syncSourceUrlOrId: '',
    options: {
      syncViews: true,
      syncData: true,
      syncRollup: false,
      syncLookup: true,
      syncFormula: false,
      syncAttachment: true,
      syncUsers: true,
    },
  },
})

const pushProgress = async (message: string, status: JobStatus | 'progress') => {
  progress.value.push({ msg: message, status })

  await nextTick(() => {
    const container: HTMLDivElement = logRef.value?.$el?.firstElementChild
    if (!container) return
    container.scrollTop = container.scrollHeight
  })
}

const onStatus = async (status: JobStatus, data?: any) => {
  if (status === JobStatus.COMPLETED) {
    showGoToDashboardButton.value = true
    await loadTables()
    pushProgress('Done!', status)
    refreshCommandPalette()
    // TODO: add tab of the first table
  } else if (status === JobStatus.FAILED) {
    goBack.value = true
    pushProgress(data.error.message, status)
  }
}

const onLog = (data: { message: string }) => {
  pushProgress(data.message, 'progress')
}

const validators = computed(() => ({
  'details.apiKey': [fieldRequiredValidator()],
  'details.syncSourceUrlOrId': [fieldRequiredValidator()],
}))

const dialogShow = computed({
  get: () => modelValue,
  set: (v) => emit('update:modelValue', v),
})

const useForm = Form.useForm

const { validateInfos } = useForm(syncSource, validators)

const disableImportButton = computed(() => !syncSource.value.details.apiKey || !syncSource.value.details.syncSourceUrlOrId)

async function saveAndSync() {
  await createOrUpdate()
  await sync()
}

async function createOrUpdate() {
  try {
    const { id, ...payload } = syncSource.value

    if (id !== '') {
      await $fetch(`/api/v1/db/meta/syncs/${id}`, {
        baseURL,
        method: 'PATCH',
        headers: { 'xc-auth': $state.token.value as string },
        body: payload,
      })
    } else {
      syncSource.value = await $fetch(`/api/v1/db/meta/projects/${baseId}/syncs/${sourceId}`, {
        baseURL,
        method: 'POST',
        headers: { 'xc-auth': $state.token.value as string },
        body: payload,
      })
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

async function listenForUpdates(id?: string) {
  if (listeningForUpdates.value) return

  listeningForUpdates.value = true

  const job = id ? { id } : await $api.jobs.status({ syncId: syncSource.value.id })

  if (!job) {
    listeningForUpdates.value = false
    return
  }

  $poller.subscribe(
    { id: job.id },
    (data: {
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
        step.value = 2
        if (data.status) {
          onStatus(data.status as JobStatus, data.data)
        } else {
          onLog(data.data as any)
        }
      } else {
        listeningForUpdates.value = false
      }
    },
  )
}

async function loadSyncSrc() {
  const data: any = await $fetch(`/api/v1/db/meta/projects/${baseId}/syncs/${sourceId}`, {
    baseURL,
    method: 'GET',
    headers: { 'xc-auth': $state.token.value as string },
  })

  const { list: srcs } = data

  if (srcs && srcs[0]) {
    srcs[0].details = srcs[0].details || {}
    syncSource.value = migrateSync(srcs[0])
    syncSource.value.details.syncSourceUrlOrId =
      srcs[0].details.appId && srcs[0].details.appId.length > 0 ? srcs[0].details.syncSourceUrlOrId : srcs[0].details.shareId
    listenForUpdates()
  } else {
    syncSource.value = {
      id: '',
      type: 'Airtable',
      details: {
        syncInterval: '15mins',
        syncDirection: 'Airtable to NocoDB',
        syncRetryCount: 1,
        apiKey: '',
        appId: '',
        shareId: '',
        syncSourceUrlOrId: '',
        options: {
          syncViews: true,
          syncData: true,
          syncRollup: false,
          syncLookup: true,
          syncFormula: false,
          syncAttachment: true,
          syncUsers: true,
        },
      },
    }
  }
}

async function sync() {
  try {
    const jobData: any = await $fetch(`/api/v1/db/meta/syncs/${syncSource.value.id}/trigger`, {
      baseURL,
      method: 'POST',
      headers: { 'xc-auth': $state.token.value as string },
    })
    listenForUpdates(jobData.id)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

async function abort() {
  Modal.confirm({
    title: 'Are you sure you want to abort this job?',
    type: 'warn',
    content:
      "This is a highly experimental feature and only marks job as not started, please don't abort the job unless you are sure job is stuck.",
    onOk: async () => {
      try {
        await $fetch(`/api/v1/db/meta/syncs/${syncSource.value.id}/abort`, {
          baseURL,
          method: 'POST',
          headers: { 'xc-auth': $state.token.value as string },
        })
        step.value = 1
        progress.value = []
        goBack.value = false
        enableAbort.value = false
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

function cancel() {
  step.value = 1
  progress.value = []
  goBack.value = false
  enableAbort.value = false
}

function migrateSync(src: any) {
  if (!src.details?.options) {
    src.details.options = {
      syncViews: false,
      syncData: true,
      syncRollup: false,
      syncLookup: true,
      syncFormula: false,
      syncAttachment: true,
    }
    src.details.options.syncViews = src.syncViews
    delete src.syncViews
  }

  return src
}

watch(
  () => syncSource.value.details.syncSourceUrlOrId,
  (v) => {
    if (syncSource.value.details) {
      const m = v && v.match(/(exp|shr).{14}/g)
      syncSource.value.details.shareId = m ? m[0] : ''
      const m2 = v && v.match(/(app).{14}/g)
      syncSource.value.details.appId = m2 ? m2[0] : ''
    }
  },
)

onMounted(async () => {
  if (syncSource.value.id) {
    listenForUpdates()
  }
  await loadSyncSrc()
})
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    :closable="step !== 2"
    :keyboard="step !== 2"
    :mask-closable="step !== 2"
    width="max(30vw, 600px)"
    class="p-2"
    wrap-class-name="nc-modal-airtable-import"
    @keydown.esc="dialogShow = false"
  >
    <div class="px-5">
      <!--      Quick Import -->
      <div class="mt-5 prose-xl font-weight-bold" @dblclick="enableAbort = true">{{ $t('title.quickImportAirtable') }}</div>

      <div v-if="step === 1">
        <div class="mb-4">
          <!--          Credentials -->
          <span class="mr-3 pt-2 text-gray-500 text-xs">{{ $t('general.credentials') }}</span>
          <!--          Where to find this? -->
          <a
            href="https://docs.nocodb.com/bases/import-base-from-airtable#get-airtable-credentials"
            class="prose-sm underline text-grey text-xs"
            target="_blank"
            rel="noopener"
          >
            {{ $t('msg.info.airtable.credentials') }}
          </a>
        </div>

        <a-form ref="form" :model="syncSource" name="quick-import-airtable-form" layout="horizontal" class="m-0">
          <a-form-item v-bind="validateInfos['details.apiKey']">
            <a-input-password
              v-model:value="syncSource.details.apiKey"
              class="nc-input-api-key"
              :placeholder="`${$t('labels.apiKey')} / ${$t('labels.personalAccessToken')}`"
              size="large"
            />
          </a-form-item>

          <a-form-item v-bind="validateInfos['details.syncSourceUrlOrId']">
            <a-input
              v-model:value="syncSource.details.syncSourceUrlOrId"
              class="nc-input-shared-base"
              :placeholder="`${$t('labels.sharedBaseUrl')}`"
              size="large"
            />
          </a-form-item>

          <!--          Advanced Settings -->
          <div class="prose-lg self-center my-4 text-gray-500">{{ $t('title.advancedSettings') }}</div>

          <a-divider class="mt-2 mb-5" />

          <!--          Import Data -->
          <div class="mt-0 my-2">
            <a-checkbox v-model:checked="syncSource.details.options.syncData">{{ $t('labels.importData') }}</a-checkbox>
          </div>

          <!--          Import Secondary Views -->
          <div class="my-2">
            <a-checkbox v-model:checked="syncSource.details.options.syncViews">
              {{ $t('labels.importSecondaryViews') }}
            </a-checkbox>
          </div>

          <!--          Import Rollup Columns -->
          <div class="my-2">
            <a-checkbox v-model:checked="syncSource.details.options.syncRollup">
              {{ $t('labels.importRollupColumns') }}
            </a-checkbox>
          </div>

          <!--          Import Lookup Columns -->
          <div class="my-2">
            <a-checkbox v-model:checked="syncSource.details.options.syncLookup">
              {{ $t('labels.importLookupColumns') }}
            </a-checkbox>
          </div>

          <!--          Import Attachment Columns -->
          <div class="my-2">
            <a-checkbox v-model:checked="syncSource.details.options.syncAttachment">
              {{ $t('labels.importAttachmentColumns') }}
            </a-checkbox>
          </div>

          <!--          Import Users Columns -->
          <div class="my-2">
            <a-checkbox v-model:checked="syncSource.details.options.syncUsers">
              {{ $t('labels.importUsers') }}
            </a-checkbox>
          </div>

          <!--          Import Formula Columns -->
          <a-tooltip placement="top">
            <template #title>
              <span>{{ $t('title.comingSoon') }}</span>
            </template>
            <a-checkbox v-model:checked="syncSource.details.options.syncFormula" disabled>
              {{ $t('labels.importFormulaColumns') }}
            </a-checkbox>
          </a-tooltip>
        </a-form>

        <a-divider />

        <!--        Questions / Help - Reach out here -->
        <div>
          <a href="https://github.com/nocodb/nocodb/issues/2052" target="_blank" rel="noopener noreferrer">
            {{ $t('general.questions') }} / {{ $t('general.help') }} - {{ $t('general.reachOut') }}</a
          >

          <br />
          <!--          This feature is currently in beta and more information can be found here -->
          <div>
            {{ $t('general.betaNote') }}
            <a
              class="prose-sm"
              href="https://github.com/nocodb/nocodb/discussions/2122"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ $t('general.moreInfo') }}
            </a>
            .
          </div>
        </div>
      </div>

      <div v-if="step === 2">
        <!--        Logs -->
        <div class="mb-4 prose-xl font-bold">{{ $t('general.logs') }}</div>

        <a-card ref="logRef" :body-style="{ backgroundColor: '#000000', height: '400px', overflow: 'auto' }">
          <div v-for="({ msg, status }, i) in progress" :key="i">
            <div v-if="status === JobStatus.FAILED" class="flex items-center">
              <component :is="iconMap.closeCircle" class="text-red-500" />

              <span class="text-red-500 ml-2">{{ msg }}</span>
            </div>

            <div v-else class="flex items-center">
              <MdiCurrencyUsd class="text-green-500" />

              <span class="text-green-500 ml-2">{{ msg }}</span>
            </div>
          </div>

          <div
            v-if="
              !progress ||
              !progress.length ||
              (progress[progress.length - 1].status !== JobStatus.COMPLETED &&
                progress[progress.length - 1].status !== JobStatus.FAILED)
            "
            class="flex items-center"
          >
            <!--            Importing -->
            <component :is="iconMap.loading" class="text-green-500 animate-spin" />
            <span class="text-green-500 ml-2"> {{ $t('labels.importing') }}</span>
          </div>
        </a-card>

        <!--        Go to Dashboard -->
        <div class="flex justify-center items-center">
          <a-button v-if="showGoToDashboardButton" class="mt-4" size="large" @click="dialogShow = false">
            {{ $t('labels.goToDashboard') }}
          </a-button>
          <a-button v-else-if="goBack" class="mt-4 uppercase" size="large" danger @click="cancel()">{{
            $t('general.cancel')
          }}</a-button>
          <a-button v-else-if="enableAbort" class="mt-4 uppercase" size="large" danger @click="abort()">{{
            $t('general.abort')
          }}</a-button>
        </div>
      </div>
    </div>

    <template #footer>
      <div v-if="step === 1">
        <a-button key="back" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>
        <!--        Import -->
        <a-button
          key="submit"
          v-e="['c:sync-airtable:save-and-sync']"
          type="primary"
          class="nc-btn-airtable-import"
          :disabled="disableImportButton"
          @click="saveAndSync"
        >
          {{ $t('activity.import') }}
        </a-button>
      </div>
    </template>
  </a-modal>
</template>
