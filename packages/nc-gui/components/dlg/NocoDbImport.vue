<script setup lang="ts">
import { JobStatus } from '#imports'

const { modelValue, baseId, transition } = defineProps<{
  modelValue: boolean
  baseId: string
  transition?: string
}>()

const emit = defineEmits(['update:modelValue', 'back'])

const { $api } = useNuxtApp()

const { t } = useI18n()

const { copy } = useCopy()

const { activeWorkspace } = storeToRefs(useWorkspace())

const { appInfo } = useGlobal()

const { ncSiteUrl } = appInfo.value

const { $poller } = useNuxtApp()

const baseStore = useBase()

const basesStore = useBases()

const { refreshCommandPalette } = useCommandPalette()

const showGoToDashboardButton = ref(false)

const step = ref(1)

const progressRef = ref()

const lastProgress = ref()

const listeningImport = ref(false)

const listeningJobId = ref<string | null>(null)

const goBack = ref(false)

const listeningForUpdates = ref(false)

const advancedOptionsCounter = ref(0)

const advancedOptionsEnabled = computed(() => advancedOptionsCounter.value >= 2)

const syncOptions = ref({
  baseId,
  workspaceMode: false,
  newBase: false,
  secretToken: null,
})

const migrationUrl = computed(() => {
  return syncOptions.value.secretToken ? `${ncSiteUrl}/?secret=${syncOptions.value.secretToken}` : ''
})

const onLog = (data: { message: string }) => {
  progressRef.value?.pushProgress(data.message, 'progress')
  lastProgress.value = { msg: data.message, status: 'progress' }
}

const onStatus = async (status: JobStatus, data?: any) => {
  lastProgress.value = { msg: data?.message, status }

  if (status === JobStatus.COMPLETED) {
    showGoToDashboardButton.value = true

    if (syncOptions.value.workspaceMode || syncOptions.value.newBase) {
      await basesStore.loadProjects()
    } else {
      await baseStore.loadProject()
    }

    progressRef.value?.pushProgress('Done!', status)
    refreshCommandPalette()
    // TODO: add tab of the first table
  } else if (status === JobStatus.FAILED) {
    if (syncOptions.value.workspaceMode || syncOptions.value.newBase) {
      await basesStore.loadProjects()
    } else {
      await baseStore.loadProject()
    }
    goBack.value = true
    progressRef.value?.pushProgress(data?.error?.message, status)

    lastProgress.value = { msg: data?.error?.message, status }

    refreshCommandPalette()
  }
}

const dialogShow = computed({
  get: () => modelValue,
  set: (v) => emit('update:modelValue', v),
})

async function startListening() {
  if (!activeWorkspace.value?.id) return

  listeningImport.value = true

  try {
    const res = await $api.internal.postOperation(
      activeWorkspace.value.id,
      baseId,
      {
        operation: 'listenRemoteImport',
      },
      syncOptions.value,
    )

    syncOptions.value.secretToken = res.secret
    listeningJobId.value = res.id

    $poller.subscribe(
      { id: listeningJobId.value },
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
          if (data.status) {
            onStatus(data.status as JobStatus, data.data)
          } else {
            step.value = 2
            onLog(data.data as any)
          }
        } else {
          listeningForUpdates.value = false
        }
      },
    )

    await copy(migrationUrl.value)
    message.info(t('msg.info.copiedToClipboard'))
  } catch (e: any) {
    console.error(e)
    message.error('Failed to start listening')
    listeningImport.value = false
  }

  // await createOrUpdate()
  // await sync()
}

async function abortListening() {
  if (!activeWorkspace.value?.id) return

  if (syncOptions.value.secretToken) {
    await $api.internal.postOperation(
      activeWorkspace.value.id,
      baseId,
      {
        operation: 'abortRemoteImport',
      },
      {
        secret: syncOptions.value.secretToken,
      },
    )
  }

  if (listeningJobId.value) {
    $poller.unsubscribe({ id: listeningJobId.value })
  }

  listeningImport.value = false
  listeningForUpdates.value = false
  dialogShow.value = false
  emit('back')
}

async function retryImport() {
  step.value = 1
  lastProgress.value = null
  syncOptions.value.secretToken = null
  listeningImport.value = false
}

const isInProgress = computed(() => {
  return !lastProgress.value || ![JobStatus.COMPLETED, JobStatus.FAILED].includes(lastProgress.value?.status)
})

const detailsIsShown = ref(false)
const collapseKey = ref('')

onUnmounted(() => {
  if (listeningJobId.value) {
    $poller.unsubscribe({ id: listeningJobId.value })
  }
})
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    class="!top-[25vh]"
    :class="{ active: dialogShow }"
    :closable="false"
    :transition-name="transition"
    :keyboard="step !== 2"
    :mask-closable="step !== 2"
    width="448px"
    wrap-class-name="nc-modal-nocodb-import"
    hide
    @keydown.esc="dialogShow = false"
  >
    <div class="text-base font-weight-bold flex items-center gap-4 mb-6">
      <GeneralIcon icon="nocodb" class="w-6 h-6" @dblclick="advancedOptionsCounter++" />

      <span v-if="step === 1">
        {{ $t('title.quickImportNocoDB') }}
      </span>
      <span v-else-if="isInProgress"> {{ `${$t('labels.importingFromNocoDB')}...` }} </span>
      <span v-else> {{ $t('labels.nocoDBBaseImported') }} </span>

      <a
        v-if="step === 1"
        href="https://docs.nocodb.com/bases/import-base-from-nocodb#get-nocodb-credentials"
        class="!text-gray-500 prose-sm ml-auto"
        target="_blank"
        rel="noopener"
      >
        Docs
      </a>
      <NcButton v-else-if="step === 2" type="text" size="xs" class="ml-auto" @click="detailsIsShown = !detailsIsShown">
        {{ detailsIsShown ? 'Hide' : 'Show' }} Details
        <GeneralIcon icon="chevronDown" class="ml-2 transition-all transform" :class="{ 'rotate-180': detailsIsShown }" />
      </NcButton>
    </div>

    <div v-if="step === 1">
      <div class="text-gray-600 text-sm px-2">
        <p class="mb-2">Easily migrate your base with the following steps:</p>
        <ol class="list-decimal list-inside mt-2 pl-1">
          <li>Open <strong>settings</strong> in your NocoDB base</li>
          <li>Navigate to <strong>Migrate</strong> tab</li>
          <li>Paste the <strong>URL</strong></li>
          <li>Click <strong>Migrate</strong></li>
        </ol>
      </div>

      <a-form ref="form" :model="syncOptions" name="quick-import-nocodb-form" layout="horizontal" class="!m-0 w-full">
        <a-form-item v-if="listeningImport" class="!mt-0 !pb-2 !mb-0">
          <LazyGeneralCopyInput :model-value="migrationUrl" class="!rounded-lg !mt-2 nc-input-shared-base" />
        </a-form-item>

        <NcButton
          v-if="advancedOptionsEnabled && !listeningImport"
          class="!mt-2"
          type="text"
          size="small"
          @click="collapseKey = !collapseKey ? 'advanced-settings' : ''"
        >
          {{ $t('title.advancedSettings') }}
          <GeneralIcon
            icon="chevronDown"
            class="ml-2 !transition-all !transform"
            :class="{ '!rotate-180': collapseKey === 'advanced-settings' }"
          />
        </NcButton>

        <a-collapse v-if="!listeningImport" v-model:active-key="collapseKey" ghost class="nc-import-collapse">
          <a-collapse-panel key="advanced-settings">
            <div class="mb-2">
              <a-checkbox v-model:checked="syncOptions.newBase"> New Base </a-checkbox>
            </div>

            <div class="mt-2">
              <a-checkbox v-model:checked="syncOptions.workspaceMode" disabled> Workspace Mode </a-checkbox>
            </div>

            <!--
            <div class="my-2">
              <a-checkbox v-model:checked="syncSource.details.options.syncViews">
                Import Workspace Mode
              </a-checkbox>
            </div>
            -->
          </a-collapse-panel>
        </a-collapse>
      </a-form>
    </div>

    <div v-if="step === 2">
      <GeneralProgressPanel v-show="detailsIsShown" ref="progressRef" class="w-full h-[200px]" />
      <div v-show="!detailsIsShown" class="flex items-start gap-2">
        <template v-if="isInProgress">
          <component :is="iconMap.loading" class="text-primary animate-spin mt-1" />
          <span>
            {{ lastProgress?.msg ?? '---' }}
          </span>
        </template>
        <template v-else-if="lastProgress?.status === JobStatus.FAILED">
          <a-alert class="!rounded-lg !bg-transparent !border-gray-200 !p-3 !w-full">
            >
            <template #message>
              <div class="flex flex-row items-center gap-2 mb-2">
                <GeneralIcon icon="ncAlertCircleFilled" class="text-red-500 w-4 h-4" />
                <span class="font-weight-700 text-[14px]">Import error</span>
              </div>
            </template>
            <template #description>
              <div class="text-gray-500 text-[13px] leading-5 ml-6">
                {{ lastProgress?.msg ?? '---' }}
              </div>
            </template>
          </a-alert>
        </template>
        <div v-else class="flex items-start gap-3">
          <GeneralIcon icon="checkFill" class="text-white w-4 h-4 mt-0.75" />
          <span> {{ $t('msg.nocoDBImportSuccess') }} </span>
        </div>
      </div>

      <div v-if="!isInProgress" class="text-right mt-4">
        <NcButton v-if="lastProgress?.status === JobStatus.FAILED" size="small" @click="retryImport"> Retry import </NcButton>
        <NcButton v-else size="small" @click="dialogShow = false">
          {{ syncOptions.workspaceMode || syncOptions.newBase ? 'Go To Dashboard' : 'Go To Base' }}
        </NcButton>
      </div>
    </div>

    <template #footer>
      <div v-if="step === 1" class="flex justify-between mt-2">
        <NcButton
          v-if="!listeningImport"
          key="back"
          type="text"
          size="small"
          @click="
            () => {
              dialogShow = false
              emit('back')
            }
          "
        >
          {{ $t('general.back') }}
        </NcButton>
        <NcButton v-else key="abort" type="danger" size="small" @click="abortListening">
          {{ $t('general.abort') }}
        </NcButton>

        <NcButton
          v-if="listeningImport"
          type="ghost"
          class="nc-btn-nocodb-import"
          size="small"
          :loading="listeningImport"
          @click="startListening"
        >
          Listening
        </NcButton>
        <NcButton v-else type="primary" class="nc-btn-nocodb-import" size="small" @click="startListening">
          Generate & Copy URL
        </NcButton>
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
.nc-modal-nocodb-import .ant-modal-footer {
  @apply !border-none p-0;
}
.nc-modal-nocodb-import .ant-collapse-content-box {
  padding-left: 6px;
}
</style>
