<script setup lang="ts">
import io from 'socket.io-client'
import { Form } from 'ant-design-vue'
import { useToast } from 'vue-toastification'
import { fieldRequiredValidator } from '~/utils/validation'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'

interface Props {
  modelValue: boolean
}

const { modelValue } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const toast = useToast()
const { sqlUi, project, loadTables } = useProject()
const loading = ref(false)
const step = ref(1)
const progress = ref([])
const syncSourceUrlOrId = ref('')
const syncSource = ref({
  type: 'Airtable',
  details: {
    syncInterval: '15mins',
    syncDirection: 'Airtable to NocoDB',
    syncRetryCount: 1,
    apiKey: '',
    shareId: '',
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

const useForm = Form.useForm

const validators = computed(() => {
  return {
    apiKey: [fieldRequiredValidator],
    syncSourceUrlOrId: [fieldRequiredValidator],
  }
})

const { resetFields, validate, validateInfos } = useForm(syncSource, validators)

const dialogShow = computed({
  get() {
    return modelValue
  },
  set(v) {
    emit('update:modelValue', v)
  },
})

const saveAndSync = async () => {
  await createOrUpdate()
  sync()
}

const createOrUpdate = async () => {
  // TODO: check $axios implementation
  // try {
  //   const { id, ...payload } = syncSource.value;
  //   if (id) {
  //     await $axios.patch(`/api/v1/db/meta/syncs/${id}`, payload);
  //   } else {
  //     syncSource.value = (await $axios.post(`/api/v1/db/meta/projects/${project.value.id}/syncs`, payload)).data;
  //   }
  // } catch (e: any) {
  //   toast.error(await extractSdkResponseErrorMsg(e))
  // }
}

const sync = () => {
  step.value = 2
  // TODO: check $axios implementation
  // $axios.post(`/api/v1/db/meta/syncs/${syncSource.value.id}/trigger`, payload, {
  //   params: {
  //     id: this.socket.id,
  //   },
  // });
}

const loadSyncSrc = async () => {
  // const {
  //   data: { list: srcs },
  // } = await $axios.get(`/api/v1/db/meta/projects/${project.id}/syncs`)
  // if (srcs && srcs[0]) {
  //   srcs[0].details = srcs[0].details || {}
  //   syncSource.value = this.migrateSync(srcs[0])
  //   syncSourceUrlOrId.value = srcs[0].details.shareId
  // } else {
  //   syncSource.value = {
  //     type: 'Airtable',
  //     details: {
  //       syncInterval: '15mins',
  //       syncDirection: 'Airtable to NocoDB',
  //       syncRetryCount: 1,
  //       apiKey: '',
  //       shareId: '',
  //       options: {
  //         syncViews: true,
  //         syncData: true,
  //         syncRollup: false,
  //         syncLookup: true,
  //         syncFormula: false,
  //         syncAttachment: true,
  //       },
  //     },
  //   }
  // }
}

const migrateSync = (src: any) => {
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

// TODO: watch syncSourceUrlOrId

onMounted(() => {
  // socket.value = io(new URL(this.$axios.defaults.baseURL, window.location.href.split(/[?#]/)[0]).href, {
  //   extraHeaders: { 'xc-auth': this.$store.state.users.token },
  // });
  // socket.value.on('connect_error', () => {
  //   socket.value.disconnect();
  //   socket.value = null;
  // });
  //
  // const socket = socket.value;
  // socket.on('connect', function (data: any) {
  //   console.log(socket.id);
  //   console.log('socket connected', data);
  // });
  //
  // socket.on('progress', (d: any) => {
  //   progress.value.push(d);
  //
  //   nextTick(() => {
  //     if ($refs.log) {
  //       const el = $refs.log.$el;
  //       el.scrollTop = el.scrollHeight;
  //     }
  //   });
  //
  //   if (d.status === 'COMPLETED') {
  //     $store
  //         .dispatch('project/_loadTables', {
  //           dbKey: '0.projectJson.envs._noco.db.0',
  //           key: '0.projectJson.envs._noco.db.0.tables',
  //           _nodes: {
  //             dbAlias: 'db',
  //             env: '_noco',
  //             type: 'tableDir',
  //           },
  //         })
  //         .then(() => this.$store.dispatch('tabs/loadFirstTableTab'));
  //   }
  // });
  // loadSyncSrc()
})
</script>

<template>
  <a-modal v-model:visible="dialogShow" width="max(90vw, 600px)" @keydown.esc="dialogShow = false">
    <template #footer>
      <a-button key="back" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>
      <a-button v-t="['c:sync-airtable:save-and-sync']" key="submit" type="primary" @click="saveAndSync">Import</a-button>
    </template>
    <div class="pl-10 pr-10 pt-5">
      <span class="prose-2xl font-bold self-center">{{ $t('title.importFromAirtable') }}</span>
      <a-divider />
      <div class="mb-4">
        <span class="prose-xl font-bold mr-3">Credentials</span>
        <a
          href="https://docs.nocodb.com/setup-and-usages/import-airtable-to-sql-database-within-a-minute-for-free/#get-airtable-credentials"
          class="prose-sm underline text-grey"
          target="_blank"
          >Where to find this?
        </a>
      </div>
      <a-form ref="formValidator" layout="vertical" :model="form">
        <a-form-item ref="form" :model="syncSource" name="quick-import-airtable-form" layout="horizontal" class="ma-0">
          <a-form-item v-bind="validateInfos.apiKey">
            <a-input-password v-model:value="syncSource.details.apiKey" placeholder="Api Key" size="large" />
          </a-form-item>
          <a-form-item v-bind="validateInfos.syncSourceUrlOrId">
            <a-input v-model:value="syncSource.details.syncSourceUrlOrId" placeholder="Shared Base ID / URL" size="large" />
          </a-form-item>
        </a-form-item>
        <span class="prose-xl font-bold self-center my-4">More Options</span>
        <a-divider />
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
          <a-checkbox disabled v-model:checked="syncSource.details.options.syncFormula">Import Formula Columns</a-checkbox>
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
  </a-modal>
</template>

<style scoped lang="scss"></style>
