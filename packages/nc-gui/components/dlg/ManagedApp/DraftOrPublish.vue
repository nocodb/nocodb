<script lang="ts" setup>
interface Props {
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:visible'])

const vVisible = useVModel(props, 'visible', emits)

const { $api } = useNuxtApp()
const baseStore = useBase()

const { loadManagedApp, loadCurrentVersion } = baseStore

const { base, managedApp, managedAppVersionsInfo } = storeToRefs(baseStore)

const isDraft = computed(() => managedAppVersionsInfo.value.current?.status === 'draft')

const isLoading = ref(false)

const title = computed(() => {
  if (isDraft.value) {
    return `Publish v${managedAppVersionsInfo.value.current?.version || '1.0.0'}?`
  } else {
    return `Fork to Draft`
  }
})

const subTitle = computed(() => {
  if (isDraft.value) {
    return managedAppVersionsInfo.value.published
      ? `Replace v${managedAppVersionsInfo.value.published.version || '1.0.0'} and go live`
      : `Go live`
  } else {
    return `Create v${suggestManagedAppNextVersion(managedAppVersionsInfo.value.published?.version || '1.0.0')} to make changes`
  }
})

// Publish form (for draft versions)
const publishForm = reactive({
  releaseNotes: '',
})

// Fork form (for creating new draft from published)
const forkForm = reactive({
  version: '',
})

const loadManagedAppAndCurrentVersion = async () => {
  await loadManagedApp()
  await loadCurrentVersion()
}

const publishCurrentDraft = async () => {
  if (!base.value?.fk_workspace_id || !base.value?.id || !managedAppVersionsInfo.value.current?.id) return

  isLoading.value = true
  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id,
      base.value.id,
      {
        operation: 'managedAppPublish',
      },
      {
        managedAppVersionId: managedAppVersionsInfo.value.current.id,
        releaseNotes: publishForm.releaseNotes,
      },
    )

    // Reload base to get updated managed app version info
    if (base.value?.id) {
      await baseStore.loadProject()
    }

    await loadManagedAppAndCurrentVersion()

    message.success(`Version ${managedAppVersionsInfo.value.current?.version || '1.0.0'} published successfully!`)

    vVisible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const createNewDraft = async () => {
  if (!base.value?.fk_workspace_id || !base.value?.id || !managedApp.value?.id) return
  if (!forkForm.version) {
    message.error('Please provide a version')
    return
  }

  isLoading.value = true
  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id,
      base.value.id,
      {
        operation: 'managedAppCreateDraft',
      },
      {
        managedAppId: managedApp.value.id,
        version: forkForm.version,
      },
    )

    // Reload base to get updated managed app version info
    if (base.value?.id) {
      await baseStore.loadProject()
    }

    await loadManagedAppAndCurrentVersion()

    message.success(`New draft version ${forkForm.version} created successfully!`)

    vVisible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

watch(
  isDraft,
  (newValue) => {
    if (newValue) {
      forkForm.version = managedAppVersionsInfo.value.current?.version || '1.0.0'
    } else {
      forkForm.version = suggestManagedAppNextVersion(managedAppVersionsInfo.value.current?.version)
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="flex flex-col h-full">
    <DlgManagedAppHeader v-model:visible="vVisible" :title="title" :sub-title="subTitle" />

    <div class="flex-1 p-6 nc-scrollbar-thin">
      <NcAlert
        type="info"
        align="top"
        class="!p-3 !items-start bg-nc-bg-blue-light border-1 !border-nc-blue-200 rounded-lg p-3 mb-4"
      >
        <template #icon>
          <GeneralIcon icon="info" class="w-4 h-4 mt-0.5 text-nc-content-blue-dark flex-none" />
        </template>

        <template v-if="isDraft" #description>
          Publishing version <strong>{{ managedAppVersionsInfo.current?.version }}</strong> will make it available in the App
          Store and automatically update all installations.
        </template>
        <template v-else #description>
          Create a new draft version to work on updates. Current published version
          <strong>{{ managedAppVersionsInfo.current?.version }}</strong> will remain unchanged.
        </template>
      </NcAlert>

      <div class="space-y-4">
        <div>
          <label class="text-nc-content-gray text-sm font-medium mb-2 block">
            <template v-if="isDraft"> Version </template>
            <template v-else> New Version <span class="text-nc-content-red-dark">*</span> </template>
          </label>
          <a-input
            v-model:value="forkForm.version"
            placeholder="e.g., 2.0.0"
            size="large"
            :disabled="isDraft"
            class="rounded-lg nc-input-sm nc-input-shadow"
          >
            <template #prefix>
              <span class="text-nc-content-gray-subtle2">v</span>
            </template>
          </a-input>
          <div v-if="!isDraft" class="text-xs text-nc-content-gray-subtle2 mt-1.5">
            Use semantic versioning (e.g., 2.0.0, 2.1.0)
          </div>
        </div>
        <div v-if="isDraft">
          <label class="text-nc-content-gray text-sm font-medium mb-2 block">Changelog</label>
          <div class="nc-changelog-editor-wrapper">
            <LazyCellRichText
              v-model:value="publishForm.releaseNotes"
              class="nc-changelog-editor allow-vertical-resize"
              placeholder="Describe what's new in this version"
              show-menu
              hide-mention
            />
          </div>
        </div>
      </div>
    </div>
    <div class="nc-dlg-managed-app-footer">
      <div class="flex justify-end gap-2">
        <NcButton type="secondary" size="small" @click="vVisible = false">{{ $t('general.cancel') }} </NcButton>

        <NcButton v-if="isDraft" type="primary" size="small" :loading="isLoading" @click="publishCurrentDraft">
          <template #icon>
            <GeneralIcon icon="upload" />
          </template>
          Publish
        </NcButton>

        <NcButton v-else type="primary" size="small" :loading="isLoading" :disabled="!forkForm.version" @click="createNewDraft">
          <template #icon>
            <GeneralIcon icon="plus" />
          </template>
          Create Draft
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-dlg-managed-app-footer {
  @apply px-6 py-3 border-t-1 border-nc-border-gray-medium;
}

.nc-changelog-editor-wrapper {
  @apply relative pt-11 border-1 border-nc-border-gray-medium rounded-lg focus-within:border-nc-border-brand focus-within:shadow-selected transition-all duration-200;
}
</style>

<style lang="scss">
.nc-changelog-editor-wrapper {
  .nc-changelog-editor {
    @apply border-t-1 border-nc-border-gray-medium;
    .nc-textarea-rich-editor {
      .ProseMirror {
        @apply border-0 rounded-none min-h-42 max-h-150 p-3;
      }

      .ProseMirror-focused {
        @apply border-0;
      }
    }
  }
}
</style>
