<script setup lang="ts">
import io from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { Form } from 'ant-design-vue'
import { useToast } from 'vue-toastification'
import { fieldRequiredValidator } from '~/utils/validation'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import MdiCloseCircleOutlineIcon from '~icons/mdi/close-circle-outline'
import MdiCurrencyUsdIcon from '~icons/mdi/currency-usd'
import MdiLoadingIcon from '~icons/mdi/loading'

interface Props {
  modelValue: boolean
}

const { modelValue } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

// TODO: handle baseURL
const baseURL = 'http://localhost:8080' // this.$axios.defaults.baseURL

const { $state } = useNuxtApp()
const toast = useToast()
const { sqlUi, project, loadTables } = useProject()
const loading = ref(false)
const step = ref(1)
const progress = ref<Record<string, any>[]>([])
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

const validators = computed(() => {
  return {
    'details.apiKey': [fieldRequiredValidator],
    'details.syncSourceUrlOrId': [fieldRequiredValidator],
  }
})

const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})

const useForm = Form.useForm
const { resetFields, validate, validateInfos } = useForm(syncSource, validators)

const disableImportButton = computed(() => {
  return !syncSource.value.details.apiKey || !syncSource.value.details.syncSourceUrlOrId
})

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
      const data: any = await $fetch(`/api/v1/db/meta/projects/${project.value.id}/syncs`, {
        baseURL,
        method: 'POST',
        headers: { 'xc-auth': $state.token.value as string },
        body: payload,
      })
      syncSource.value = data
    }
  } catch (e: any) {
    toast.error(await extractSdkResponseErrorMsg(e))
  }
}

async function loadSyncSrc() {
  const data: any = await $fetch(`/api/v1/db/meta/projects/${project.value.id}/syncs`, {
    baseURL,
    method: 'GET',
    headers: { 'xc-auth': $state.token.value as string },
  })
  const { list: srcs } = data
  if (srcs && srcs[0]) {
    srcs[0].details = srcs[0].details || {}
    syncSource.value = migrateSync(srcs[0])
    syncSource.value.details.syncSourceUrlOrId = srcs[0].details.shareId
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
  step.value = 2
  try {
    await $fetch(`/api/v1/db/meta/syncs/${syncSource.value.id}/trigger`, {
      baseURL,
      method: 'POST',
      headers: { 'xc-auth': $state.token.value as string },
      params: {
        id: socket.id,
      },
    })
  } catch (e: any) {
    console.log(e)
    toast.error(e)
  }
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
  socket.on('connect_error', () => {
    socket?.disconnect()
    socket = null
  })

  // connect event does not provide data
  socket.on('connect', () => {
    console.log(socket?.id)
    console.log('socket connected')
  })

  socket.on('progress', async (d: Record<string, any>) => {
    progress.value.push(d)
    if (d.status === 'COMPLETED') {
      await loadTables()
      // TODO: add tab of the first table
    }
  })
  await loadSyncSrc()
})

onBeforeUnmount(() => {
  if (socket) {
    socket.disconnect()
  }
})
</script>

<template>
  <a-modal v-model:visible="dialogShow" width="max(30vw, 600px)" @keydown.esc="dialogShow = false">
    <template #footer>
      <div v-if="step === 1">
        <a-button key="back" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>
        <a-button
          key="submit"
          v-t="['c:sync-airtable:save-and-sync']"
          type="primary"
          class="nc-btn-airtable-import"
          :disabled="disableImportButton"
          @click="saveAndSync"
          >Import
        </a-button>
      </div>
    </template>
    <a-typography-title class="ml-5 mt-5" type="secondary" :level="5">QUICK IMPORT - AIRTABLE</a-typography-title>
    <div class="ml-5 mr-5">
      <a-divider />
      <div v-if="step === 1">
        <div class="mb-4">
          <span class="prose-xl font-bold mr-3">Credentials</span>
          <a
            href="https://docs.nocodb.com/setup-and-usages/import-airtable-to-sql-database-within-a-minute-for-free/#get-airtable-credentials"
            class="prose-sm underline text-grey"
            target="_blank"
            >Where to find this?
          </a>
        </div>
        <a-form ref="form" :model="syncSource" name="quick-import-airtable-form" layout="horizontal" class="ma-0">
          <a-form-item v-bind="validateInfos['details.apiKey']">
            <a-input-password
              v-model:value="syncSource.details.apiKey"
              class="nc-input-api-key"
              placeholder="Api Key"
              size="large"
            />
          </a-form-item>
          <a-form-item v-bind="validateInfos['details.syncSourceUrlOrId']">
            <a-input
              v-model:value="syncSource.details.syncSourceUrlOrId"
              class="nc-input-shared-base"
              placeholder="Shared Base ID / URL"
              size="large"
            />
          </a-form-item>
          <span class="prose-xl font-bold self-center my-4">Advanced Settings</span>
          <a-divider class="mt-2 mb-5" />
          <div class="mt-0 my-2">
            <a-checkbox v-model:checked="syncSource.details.options.syncData">Import Data</a-checkbox>
          </div>
          <div class="my-2">
            <a-checkbox v-model:checked="syncSource.details.options.syncViews">Import Secondary Views</a-checkbox>
          </div>
          <div class="my-2">
            <a-checkbox v-model:checked="syncSource.details.options.syncRollup">Import Rollup Columns</a-checkbox>
          </div>
          <div class="my-2">
            <a-checkbox v-model:checked="syncSource.details.options.syncLookup">Import Lookup Columns</a-checkbox>
          </div>
          <div class="my-2">
            <a-checkbox v-model:checked="syncSource.details.options.syncAttachment">Import Attachment Columns</a-checkbox>
          </div>
          <a-tooltip placement="top">
            <template #title>
              <span>Coming Soon!</span>
            </template>
            <a-checkbox v-model:checked="syncSource.details.options.syncFormula" disabled>Import Formula Columns</a-checkbox>
          </a-tooltip>
        </a-form>
        <a-divider />
        <div>
          <a href="https://github.com/nocodb/nocodb/issues/2052" target="_blank">Questions / Help - Reach out here</a>
          <br />
          <div>
            This feature is currently in beta and more information can be found
            <a class="prose-sm" href="https://github.com/nocodb/nocodb/discussions/2122" target="_blank">here</a>.
          </div>
        </div>
      </div>
      <div v-if="step === 2">
        <div class="mb-4 prose-xl font-bold">Logs</div>
        <a-card body-style="background-color: #000000; height:400px; overflow: auto;">
          <div v-for="({ msg, status }, i) in progress" :key="i">
            <div v-if="status === 'FAILED'" class="flex items-center">
              <MdiCloseCircleOutlineIcon class="text-red-500" />
              <span class="text-red-500 ml-2">{{ msg }}</span>
            </div>
            <div v-else class="flex items-center">
              <MdiCurrencyUsdIcon class="text-green-500" />
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
            <MdiLoadingIcon class="text-green-500 animate-spin" />
            <span class="text-green-500 ml-2"> Importing</span>
          </div>
        </a-card>
      </div>
    </div>
  </a-modal>
</template>

<style scoped lang="scss"></style>
