<script setup lang="ts">
import type { Card as AntCard } from 'ant-design-vue'
import { JobStatus } from '#imports'

const { modelValue, baseId, sourceId } = defineProps<{
  modelValue: boolean
  baseId: string
  sourceId: string
}>()

const emit = defineEmits(['update:modelValue', 'back'])

const { $api } = useNuxtApp()

const baseURL = $api.instance.defaults.baseURL

const { $state, $poller } = useNuxtApp()

const baseStore = useBase()

const { refreshCommandPalette } = useCommandPalette()

const { loadTables } = baseStore

const { getJobsForBase, loadJobsForBase } = useJobs()

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
      syncUsers: false,
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
    await loadTables()
    goBack.value = true
    pushProgress(data.error.message, status)
    refreshCommandPalette()
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

const isLoading = ref(false)

async function saveAndSync() {
  isLoading.value = true
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

  await loadJobsForBase(baseId)

  const jobs = await getJobsForBase(baseId)

  const job = id
    ? { id }
    : jobs
        // sort by created_at desc (latest first)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .find((j) => j.base_id === baseId && j.status !== JobStatus.COMPLETED && j.status !== JobStatus.FAILED)

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
        isLoading.value = false
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
          syncRollup: true,
          syncLookup: true,
          syncFormula: false,
          syncAttachment: true,
          syncUsers: false,
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
    listeningForUpdates.value = false
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

function downloadLogs(filename: string) {
  let text = ''
  for (const o of document.querySelectorAll('.nc-modal-airtable-import .log-message')) {
    text += `${o.textContent}\n`
  }
  const element = document.createElement('a')
  element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`)
  element.setAttribute('download', filename)

  element.style.display = 'none'
  document.body.appendChild(element)

  element.click()

  document.body.removeChild(element)
}

const isInProgress = computed(() => {
  return (
    !progress.value ||
    !progress.value.length ||
    ![JobStatus.COMPLETED, JobStatus.FAILED].includes(progress.value[progress.value.length - 1]?.status)
  );
})

const detailsIsShown = ref(false)
const collapseKey = ref('')
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    class="!top-[25vh]"
    :class="{ active: dialogShow }"
    :closable="false"
    :keyboard="step !== 2"
    :mask-closable="step !== 2"
    width="448px"
    wrap-class-name="nc-modal-airtable-import"
    hide
    @keydown.esc="dialogShow = false">

    <div class="text-base font-weight-bold flex items-center gap-4 mb-6" @dblclick="enableAbort = true">

      <GeneralIcon icon="airtable" class="w-6 h-6" />

      <span v-if="step === 1">
        {{ $t('title.quickImportAirtable') }}
      </span>
      <span v-else-if="isInProgress">
        Importing from Airtable...
      </span>
      <span v-else>
        Airtable Base Imported.
      </span>

      <a
        v-if="step === 1"
        href="https://docs.nocodb.com/bases/import-base-from-airtable#get-airtable-credentials"
        class="!text-gray-500 prose-sm ml-auto !no-underline"
        target="_blank"
        rel="noopener"
      >
        Docs
      </a>
      <nc-button v-else-if="isInProgress" type="text" size="xs" class="ml-auto" @click="detailsIsShown = !detailsIsShown">
        {{ detailsIsShown ? 'Hide' : 'Show' }} Details
        <GeneralIcon icon="chevronDown" class="ml-2 transition-all transform" :class="{ 'rotate-180': detailsIsShown }" />
      </nc-button>

    </div>

    <div v-if="step === 1">

      <a-form ref="form" :model="syncSource" name="quick-import-airtable-form" layout="horizontal" class="m-0">

        <a-form-item v-bind="validateInfos['details.apiKey']">
          <label>
            Personal Access Token
          </label>
          <a-input-password
            v-model:value="syncSource.details.apiKey"
            :placeholder="`${$t('labels.apiKey')} / ${$t('labels.personalAccessToken')}`"
            class="!rounded-lg mt-2"
          />
        </a-form-item>

        <a-form-item v-bind="validateInfos['details.syncSourceUrlOrId']">
          <label>
            Shared Base ID/URL
          </label>
          <a-input
            v-model:value="syncSource.details.syncSourceUrlOrId"
            :placeholder="`${$t('labels.sharedBaseUrl')}`"
            class="!rounded-lg !mt-2"
          />
        </a-form-item>

        <nc-button type="text" size="small" @click="collapseKey = !collapseKey ? 'advanced-settings' : ''">
          {{ $t('title.advancedSettings') }}
          <GeneralIcon icon="chevronDown" class="ml-2 !transition-all !transform" :class="{ '!rotate-180': collapseKey === 'advanced-settings' }" />
        </nc-button>

        <a-collapse ghost class="nc-import-collapse" v-model:active-key="collapseKey">
          <a-collapse-panel key="advanced-settings">

            <div class="mb-2">
              <a-checkbox v-model:checked="syncSource.details.options.syncData">{{ $t('labels.importData') }}</a-checkbox>
            </div>

            <div class="my-2">
              <a-checkbox v-model:checked="syncSource.details.options.syncViews">
                {{ $t('labels.importSecondaryViews') }}
              </a-checkbox>
            </div>

            <div class="my-2">
              <a-checkbox v-model:checked="syncSource.details.options.syncRollup">
                {{ $t('labels.importRollupColumns') }}
              </a-checkbox>
            </div>

            <!--
            <div class="my-2">
              <a-checkbox v-model:checked="syncSource.details.options.syncLookup">
                {{ $t('labels.importLookupColumns') }}
              </a-checkbox>
            </div>
            -->

            <div class="my-2">
              <a-checkbox v-model:checked="syncSource.details.options.syncAttachment">
                {{ $t('labels.importAttachmentColumns') }}
              </a-checkbox>
            </div>

            <div class="my-2">
              <a-checkbox v-model:checked="syncSource.details.options.syncFormula">
                {{ $t('labels.importFormulaColumns') }}
              </a-checkbox>
            </div>

          </a-collapse-panel>
        </a-collapse>

      </a-form>

    </div>

    <div v-if="step === 2">

      <a-card v-if="detailsIsShown" ref="logRef" :body-style="{ backgroundColor: '#101015', height: '200px', overflow: 'auto', borderRadius: '0.5rem', padding: '16px !important' }">

        <a-button
          v-if="showGoToDashboardButton || goBack"
          class="!absolute mr-1 mb-1 z-1 right-0 bottom-0 opacity-40 hover:opacity-100 !rounded-md"
          size="small"
          @click="downloadLogs('at-import-logs.txt')"
        >
          <component :is="iconMap.download" class="text-green-400" />
        </a-button>

        <div v-for="({ msg, status }, i) in progress" :key="i">
          <div v-if="status === JobStatus.FAILED" class="flex items-start">
            <component :is="iconMap.closeCircle" class="text-red-400 mt-1" />

            <span class="text-red-400 ml-2 log-message">{{ msg }}</span>
          </div>

          <div v-else class="flex items-start">
            <MdiCurrencyUsd class="text-green-400 mt-1" />

            <span class="text-green-400 ml-2 log-message">{{ msg }}</span>
          </div>
        </div>

      </a-card>
      <div v-else class="flex items-start gap-2">
        <component v-if="isInProgress" :is="iconMap.loading" class="text-primary animate-spin mt-1" />
        <component v-else-if="progress?.[progress?.length - 1]?.status === JobStatus.FAILED" :is="iconMap.closeCircle" class="text-red-400 mt-1" />
        <MdiCurrencyUsd v-else class="text-green-400 mt-1" />
        <span>
          {{ progress?.[progress?.length - 1]?.msg ?? '---' }}
        </span>
      </div>

      <div v-if="!isInProgress" class="text-right mt-4">
        <nc-button @click="dialogShow = false;">
          Go to base
        </nc-button>
      </div>

    </div>

    <template #footer>
      <div v-if="step === 1" class="flex justify-between mt-2">

        <nc-button type="text" key="back" @click="dialogShow = false; emit('back');">
          {{ $t('general.back') }}
        </nc-button>

        <nc-button
          key="submit"
          v-e="['c:sync-airtable:save-and-sync']"
          type="primary"
          class="nc-btn-airtable-import"
          :loading="isLoading"
          :disabled="disableImportButton"
          @click="saveAndSync">
          {{ $t('activity.import') }} Base
        </nc-button>

      </div>
    </template>

  </a-modal>
</template>

<style lang="scss" scoped>
  .nc-import-collapse :deep(.ant-collapse-header) {
    display: none !important;
  }
</style>

<style>
  .nc-modal-airtable-import .ant-modal-footer {
    @apply !border-none p-0;
  }
</style>