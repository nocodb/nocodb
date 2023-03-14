<script setup lang="ts">
import type { Socket } from 'socket.io-client'
import io from 'socket.io-client'
import type { Card as AntCard } from 'ant-design-vue'
import {
  Form,
  computed,
  extractSdkResponseErrorMsg,
  fieldRequiredValidator,
  message,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  storeToRefs,
  useGlobal,
  useNuxtApp,
  useProject,
  watch,
} from '#imports'

const { modelValue, baseId } = defineProps<{
  modelValue: boolean
  baseId: string
}>()

const emit = defineEmits(['update:modelValue'])

const { appInfo } = $(useGlobal())

const baseURL = appInfo.ncSiteUrl

const { $state } = useNuxtApp()

const projectStore = useProject()

const { loadTables } = projectStore

const { project } = storeToRefs(projectStore)

const showGoToDashboardButton = ref(false)

const step = ref(1)

const progress = ref<Record<string, any>[]>([])

const logRef = ref<typeof AntCard>()

const enableAbort = ref(false)

let socket: Socket | null

const syncSource = ref({
  id: '',
  type: 'Airtable',
  details: {
    syncInterval: '15mins',
    syncDirection: 'Airtable to NocoDB',
    syncRetryCount: 1,
    apiKey: '',
    shareId: '',
    syncSourceUrlOrId: '',
    options: {
      syncViews: true,
      syncData: true,
      syncRollup: false,
      syncLookup: true,
      syncFormula: false,
      syncAttachment: true,
    },
  },
})

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
      syncSource.value = await $fetch(`/api/v1/db/meta/projects/${project.value.id}/syncs/${baseId}`, {
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

async function loadSyncSrc() {
  const data: any = await $fetch(`/api/v1/db/meta/projects/${project.value.id}/syncs/${baseId}`, {
    baseURL,
    method: 'GET',
    headers: { 'xc-auth': $state.token.value as string },
  })

  const { list: srcs } = data

  if (srcs && srcs[0]) {
    srcs[0].details = srcs[0].details || {}
    syncSource.value = migrateSync(srcs[0])
    syncSource.value.details.syncSourceUrlOrId = srcs[0].details.shareId
    socket?.emit('subscribe', syncSource.value.id)
  } else {
    syncSource.value = {
      id: '',
      type: 'Airtable',
      details: {
        syncInterval: '15mins',
        syncDirection: 'Airtable to NocoDB',
        syncRetryCount: 1,
        apiKey: '',
        shareId: '',
        syncSourceUrlOrId: '',
        options: {
          syncViews: true,
          syncData: true,
          syncRollup: false,
          syncLookup: true,
          syncFormula: false,
          syncAttachment: true,
        },
      },
    }
  }
}

async function sync() {
  try {
    await $fetch(`/api/v1/db/meta/syncs/${syncSource.value.id}/trigger`, {
      baseURL,
      method: 'POST',
      headers: { 'xc-auth': $state.token.value as string },
      params: {
        id: socket?.id,
      },
    })
    socket?.emit('subscribe', syncSource.value.id)
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
          params: {
            id: socket?.id,
          },
        })
        step.value = 1
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
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
    }
  },
)

onMounted(async () => {
  socket = io(new URL(baseURL, window.location.href.split(/[?#]/)[0]).href, {
    extraHeaders: { 'xc-auth': $state.token.value as string },
  })

  socket.on('progress', async (d: Record<string, any>) => {
    progress.value.push(d)

    await nextTick(() => {
      const container: HTMLDivElement = logRef.value?.$el?.firstElementChild
      if (!container) return
      container.scrollTop = container.scrollHeight
    })

    if (d.status === 'COMPLETED') {
      showGoToDashboardButton.value = true
      await loadTables()
      // TODO: add tab of the first table
    }
  })

  socket.on('disconnect', () => {
    console.log('socket disconnected')
    const rcInterval = setInterval(() => {
      if (socket?.connected) {
        clearInterval(rcInterval)
        socket?.emit('subscribe', syncSource.value.id)
      } else {
        socket?.connect()
      }
    }, 2000)
  })

  socket.on('job', () => {
    step.value = 2
  })

  // connect event does not provide data
  socket.on('connect', () => {
    console.log('socket connected')
    if (syncSource.value.id) {
      socket?.emit('subscribe', syncSource.value.id)
    }
  })

  socket?.io.on('reconnect', () => {
    console.log('socket reconnected')
    if (syncSource.value.id) {
      socket?.emit('subscribe', syncSource.value.id)
    }
  })

  await loadSyncSrc()
})

onBeforeUnmount(() => {
  if (socket) {
    socket.off('disconnect')
    socket.disconnect()
    socket.removeAllListeners()
  }
})
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    width="max(30vw, 600px)"
    class="p-2"
    wrap-class-name="nc-modal-airtable-import"
    @keydown.esc="dialogShow = false"
  >
    <div class="px-5">
      <!--      Quick Import -->
      <div class="mt-5 prose-xl font-weight-bold" @dblclick="enableAbort = true">{{ $t('title.quickImport') }} - AIRTABLE</div>

      <div v-if="step === 1">
        <div class="mb-4">
          <!--          Credentials -->
          <span class="mr-3 pt-2 text-gray-500 text-xs">{{ $t('general.credentials') }}</span>
          <!--          Where to find this? -->
          <a
            href="https://docs.nocodb.com/setup-and-usages/import-airtable-to-sql-database-within-a-minute-for-free/#get-airtable-credentials"
            class="prose-sm underline text-grey text-xs"
            target="_blank"
          >
            {{ $t('msg.info.airtable.credentials') }}
          </a>
        </div>

        <a-form ref="form" :model="syncSource" name="quick-import-airtable-form" layout="horizontal" class="m-0">
          <a-form-item v-bind="validateInfos['details.apiKey']">
            <a-input-password
              v-model:value="syncSource.details.apiKey"
              class="nc-input-api-key"
              :placeholder="$t('labels.apiKey')"
              size="large"
            />
          </a-form-item>

          <a-form-item v-bind="validateInfos['details.syncSourceUrlOrId']">
            <a-input
              v-model:value="syncSource.details.syncSourceUrlOrId"
              class="nc-input-shared-base"
              :placeholder="`${$t('labels.sharedBase')} ID / URL`"
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

          <!--          Import Formula Columns -->
          <a-tooltip placement="top">
            <template #title>
              <span>Coming Soon!</span>
            </template>
            <a-checkbox v-model:checked="syncSource.details.options.syncFormula" disabled>
              {{ $t('labels.importFormulaColumns') }}
            </a-checkbox>
          </a-tooltip>
        </a-form>

        <a-divider />

        <!--        Questions / Help - Reach out here -->
        <div>
          <a href="https://github.com/nocodb/nocodb/issues/2052" target="_blank">
            {{ $t('general.questions') }} / {{ $t('general.help') }} - {{ $t('general.reachOut') }}</a
          >

          <br />
          <!--          This feature is currently in beta and more information can be found here -->
          <div>
            {{ $t('general.betaNote') }}
            <a class="prose-sm" href="https://github.com/nocodb/nocodb/discussions/2122" target="_blank">
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
            <div v-if="status === 'FAILED'" class="flex items-center">
              <MdiCloseCircleOutline class="text-red-500" />

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
              (progress[progress.length - 1].status !== 'COMPLETED' && progress[progress.length - 1].status !== 'FAILED')
            "
            class="flex items-center"
          >
            <!--            Importing -->
            <MdiLoading class="text-green-500 animate-spin" />
            <span class="text-green-500 ml-2"> {{ $t('labels.importing') }}</span>
          </div>
        </a-card>

        <!--        Go to Dashboard -->
        <div class="flex justify-center items-center">
          <a-button v-if="showGoToDashboardButton" class="mt-4" size="large" @click="dialogShow = false">
            {{ $t('labels.goToDashboard') }}
          </a-button>
          <a-button v-else-if="enableAbort" class="mt-4" size="large" danger @click="abort()">ABORT</a-button>
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
