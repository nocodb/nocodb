<script setup lang="ts">
import { BaseVersion } from 'nocodb-sdk'

const { t } = useI18n()
const { $api } = useNuxtApp()

const baseStore = useBase()
const basesStore = useBases()
const { base } = storeToRefs(baseStore)

const _projectId = inject(ProjectIdInj, undefined)

const baseId = computed(() => _projectId?.value ?? base.value?.id)

const isLoading = ref(false)
const isLoadingVersions = ref(false)
const isCreateModalVisible = ref(false)
const isPublishModalVisible = ref(false)

const sandbox = ref<any | null>(null)
const versions = ref<any[]>([])
const publishResults = ref<any>(null)

const sandboxForm = reactive({
  title: '',
  description: '',
  category: '',
  tags: [] as string[],
  visibility: 'public',
})

const publishForm = reactive({
  version: '',
  releaseNotes: '',
})

const isPublished = computed(() => sandbox.value?.status === 'published')
const isInitialPublish = computed(() => !isPublished.value)

const loadSandbox = async () => {
  if (!baseId.value || !base.value?.fk_workspace_id) return

  try {
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, baseId.value, {
      operation: 'sandboxGet',
      baseId: baseId.value,
    } as any)
    if (response) {
      sandbox.value = response
      // Load versions if published
      if (response.status === 'published') {
        loadVersions()
      }
    }
  } catch (e) {
    // Sandbox doesn't exist yet
    sandbox.value = null
  }
}

const loadVersions = async () => {
  if (!sandbox.value?.id || !base.value?.fk_workspace_id) return

  isLoadingVersions.value = true
  try {
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, baseId.value, {
      operation: 'sandboxVersionsList',
      sandboxId: sandbox.value.id,
    } as any)
    if (response?.list) {
      versions.value = response.list
    }
  } catch (e: any) {
    console.error('Failed to load versions:', e)
  } finally {
    isLoadingVersions.value = false
  }
}

const createSandbox = async () => {
  if (!baseId.value || !base.value?.fk_workspace_id) return

  isLoading.value = true
  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id,
      baseId.value,
      {
        operation: 'sandboxCreate',
      } as any,
      {
        title: sandboxForm.title,
        description: sandboxForm.description,
        category: sandboxForm.category,
        tags: sandboxForm.tags,
        visibility: sandboxForm.visibility,
      },
    )

    message.success(t('msg.success.sandboxCreated'))

    // Reload sandbox and base
    await loadSandbox()
    await basesStore.loadProject(baseId.value, true)

    isCreateModalVisible.value = false

    // Reset form
    sandboxForm.title = ''
    sandboxForm.description = ''
    sandboxForm.category = ''
    sandboxForm.tags = []
    sandboxForm.visibility = 'public'
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const publishSandbox = async () => {
  if (!baseId.value || !sandbox.value || !base.value?.fk_workspace_id) return

  isLoading.value = true
  try {
    const response = await $api.internal.postOperation(
      base.value.fk_workspace_id,
      baseId.value,
      {
        operation: 'sandboxPublish',
      },
      {
        sandboxId: sandbox.value.id,
        version: publishForm.version,
        releaseNotes: publishForm.releaseNotes,
      },
    )

    publishResults.value = response

    if (response.isInitialPublish) {
      message.success(`Version ${publishForm.version} published successfully!`)
    } else {
      const updateMsg = response.updateResults
        ? `Version ${publishForm.version} published and ${response.updateResults.successfulUpdates || 0} installations updated`
        : `Version ${publishForm.version} published`
      message.success(updateMsg)
    }

    await loadSandbox()

    isPublishModalVisible.value = false
    publishForm.version = ''
    publishForm.releaseNotes = ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const updateSandbox = async () => {
  if (!baseId.value || !sandbox.value || !base.value?.fk_workspace_id) return

  isLoading.value = true
  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id,
      baseId.value,
      {
        operation: 'sandboxUpdate',
      },
      {
        sandboxId: sandbox.value.id,
        title: sandboxForm.title,
        description: sandboxForm.description,
        category: sandboxForm.category,
        tags: sandboxForm.tags,
        visibility: sandboxForm.visibility,
      },
    )

    message.success(t('msg.success.sandboxUpdated'))

    await loadSandbox()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const openCreateModal = () => {
  sandboxForm.title = base.value?.title || ''
  sandboxForm.description = ''
  sandboxForm.category = ''
  sandboxForm.tags = []
  sandboxForm.visibility = 'public'
  isCreateModalVisible.value = true
}

const openPublishModal = () => {
  // For initial publish, always use 1.0.0
  // For subsequent publishes, suggest next version
  if (isPublished.value) {
    const currentVersion = sandbox.value.version
    const versionParts = currentVersion.split('.')
    if (versionParts.length === 3) {
      // Increment patch version
      versionParts[2] = String(Number(versionParts[2]) + 1)
      publishForm.version = versionParts.join('.')
    } else {
      publishForm.version = ''
    }
  } else {
    publishForm.version = '1.0.0'
  }
  publishForm.releaseNotes = ''
  isPublishModalVisible.value = true
}

const openUpdateForm = () => {
  if (!sandbox.value) return
  sandboxForm.title = sandbox.value.title
  sandboxForm.description = sandbox.value.description || ''
  sandboxForm.category = sandbox.value.category || ''
  sandboxForm.tags = Array.isArray(sandbox.value.tags) ? sandbox.value.tags : []
  sandboxForm.visibility = sandbox.value.visibility || 'public'
}

onMounted(async () => {
  await loadSandbox()
  if (sandbox.value) {
    openUpdateForm()
  }
})
</script>

<template>
  <div data-testid="nc-settings-subtab-sandbox" class="item-card flex flex-col w-full">
    <!-- Header -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <div class="text-nc-content-gray-emphasis font-semibold text-lg flex items-center gap-2">
          {{ $t('labels.sandboxAppStore') }}
        </div>
        <div class="text-nc-content-gray-subtle2 mt-2 text-sm leading-relaxed max-w-3xl">
          Transform your base into a living, continuously-updated application. Publish to the world's first agentic app store
          where your data structures, automations, and workflows sync automatically to all installations.
          <a
            href="https://docs.nocodb.com/app-store"
            target="_blank"
            rel="noopener noreferrer"
            class="text-nc-content-brand hover:underline ml-1"
          >
            Learn more →
          </a>
        </div>
      </div>
    </div>

    <!-- Base not V3 warning -->
    <div v-if="base?.version !== BaseVersion.V3" class="mt-2">
      <div class="bg-nc-bg-orange-light border border-nc-border-orange rounded-lg p-4">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <div class="w-10 h-10 rounded-full bg-nc-bg-orange-dark flex items-center justify-center">
              <GeneralIcon icon="alertTriangle" class="text-nc-content-orange-dark w-5 h-5" />
            </div>
          </div>
          <div class="flex-1">
            <div class="text-nc-content-gray-emphasis font-semibold mb-1">{{ $t('labels.baseMustBeV3') }}</div>
            <div class="text-nc-content-gray text-sm">
              Only V3 bases can be published to the App Store. Please migrate this base to V3 first to unlock this feature.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Sandbox Created Yet -->
    <div v-else-if="!sandbox" class="mt-2">
      <div class="bg-nc-bg-blue-light border border-nc-border-blue rounded-lg p-6">
        <div class="text-nc-content-gray-emphasis font-semibold text-base mb-4">Publish to the Agentic App Store</div>
        <div class="grid gap-3 mb-6">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0">
              <div class="w-6 h-6 rounded-full bg-nc-bg-blue-dark flex items-center justify-center">
                <GeneralIcon icon="check" class="text-nc-content-blue-dark w-4 h-4" />
              </div>
            </div>
            <div class="text-nc-content-gray text-sm mt-0.5">
              <span class="font-semibold">Full-stack distribution:</span> Share complete applications with data models,
              automations, and workflows
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0">
              <div class="w-6 h-6 rounded-full bg-nc-bg-blue-dark flex items-center justify-center">
                <GeneralIcon icon="check" class="text-nc-content-blue-dark w-4 h-4" />
              </div>
            </div>
            <div class="text-nc-content-gray text-sm mt-0.5">
              <span class="font-semibold">Continuous synchronization:</span> Every update you publish instantly propagates to all
              installations
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0">
              <div class="w-6 h-6 rounded-full bg-nc-bg-blue-dark flex items-center justify-center">
                <GeneralIcon icon="check" class="text-nc-content-blue-dark w-4 h-4" />
              </div>
            </div>
            <div class="text-nc-content-gray text-sm mt-0.5">
              <span class="font-semibold">Protected architecture:</span> Users work with your schema while you maintain complete
              control over the structure
            </div>
          </div>
        </div>

        <NcButton size="medium" type="primary" data-testid="nc-create-sandbox-button" @click="openCreateModal">
          <template #icon>
            <GeneralIcon icon="plus" />
          </template>
          {{ $t('labels.createSandbox') }}
        </NcButton>
      </div>
    </div>

    <!-- Sandbox Exists -->
    <div v-else class="mt-2 space-y-6">
      <!-- Overview Card -->
      <div class="border border-nc-border-gray-medium rounded-lg overflow-hidden">
        <div class="bg-nc-bg-gray-light px-6 py-4 border-b border-nc-border-gray-medium">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div>
                <div class="text-nc-content-gray-emphasis font-semibold text-lg">{{ sandbox.title }}</div>
                <div class="flex items-center gap-2 mt-1">
                  <div
                    v-if="isPublished"
                    class="px-2.5 py-0.5 text-xs rounded-full bg-nc-bg-green-dark text-nc-content-green-dark font-medium flex items-center gap-1"
                  >
                    <div class="w-1.5 h-1.5 rounded-full bg-nc-green-500"></div>
                    {{ $t('labels.published') }}
                  </div>
                  <div v-else class="px-2.5 py-0.5 text-xs rounded-full bg-nc-bg-gray-light text-nc-content-gray font-medium">
                    {{ $t('labels.draft') }}
                  </div>
                  <span class="text-nc-content-gray-subtle2 text-xs">•</span>
                  <span class="text-nc-content-gray-subtle2 text-xs">Version {{ sandbox.version || '0.0.0' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <div v-if="sandbox.description" class="text-nc-content-gray text-sm mb-4">
            {{ sandbox.description }}
          </div>
          <div class="flex flex-wrap gap-4 text-sm">
            <div v-if="sandbox.category" class="flex items-center gap-2 text-nc-content-gray-subtle2">
              <GeneralIcon icon="tag" class="w-4 h-4" />
              <span>{{ sandbox.category }}</span>
            </div>
            <div class="flex items-center gap-2 text-nc-content-gray-subtle2">
              <GeneralIcon icon="download" class="w-4 h-4" />
              <span>{{ sandbox.install_count || 0 }} {{ $t('labels.installs') }}</span>
            </div>
            <div v-if="sandbox.visibility" class="flex items-center gap-2 text-nc-content-gray-subtle2">
              <GeneralIcon :icon="sandbox.visibility === 'public' ? 'eye' : 'eyeSlash'" class="w-4 h-4" />
              <span class="capitalize">{{ sandbox.visibility }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sandbox Details -->
      <div class="border border-nc-border-gray-medium rounded-lg p-6">
        <div class="flex items-center gap-2 mb-4">
          <GeneralIcon icon="edit" class="w-4 h-4 text-nc-content-gray-emphasis" />
          <div class="text-nc-content-gray-emphasis font-semibold">{{ $t('labels.sandboxDetails') }}</div>
        </div>

        <div class="grid gap-4">
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-2 block">
              {{ $t('labels.sandboxTitle') }} <span class="text-nc-content-red-dark">*</span>
            </label>
            <a-input v-model:value="sandboxForm.title" placeholder="Enter a descriptive title" size="large" class="rounded-lg" />
          </div>

          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-2 block">
              {{ $t('labels.sandboxDescription') }}
            </label>
            <a-textarea
              v-model:value="sandboxForm.description"
              placeholder="Describe your application's capabilities and the value it delivers to users"
              :rows="4"
              size="large"
              class="rounded-lg"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-nc-content-gray text-sm font-medium mb-2 block">
                {{ $t('labels.sandboxCategory') }}
              </label>
              <a-input
                v-model:value="sandboxForm.category"
                placeholder="e.g., CRM, Inventory, HR"
                size="large"
                class="rounded-lg"
              />
            </div>

            <div>
              <label class="text-nc-content-gray text-sm font-medium mb-2 block">
                {{ $t('labels.sandboxVisibility') }}
              </label>
              <a-select v-model:value="sandboxForm.visibility" size="large" class="w-full rounded-lg">
                <a-select-option value="public">
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="eye" class="w-4 h-4" />
                    <span>Public</span>
                  </div>
                </a-select-option>
                <a-select-option value="private">
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="lock" class="w-4 h-4" />
                    <span>Private</span>
                  </div>
                </a-select-option>
                <a-select-option value="unlisted">
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="ncEyeOff" class="w-4 h-4" />
                    <span>Unlisted</span>
                  </div>
                </a-select-option>
              </a-select>
            </div>
          </div>

          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-2 block">
              {{ $t('labels.sandboxTags') }}
            </label>
            <a-select
              v-model:value="sandboxForm.tags"
              mode="tags"
              placeholder="Add tags to help users discover this template"
              size="large"
              class="w-full rounded-lg"
            />
          </div>

          <div class="flex justify-end pt-2">
            <NcButton size="medium" type="primary" :loading="isLoading" @click="updateSandbox">
              <template #icon>
                <GeneralIcon icon="save" />
              </template>
              {{ $t('labels.saveChanges') }}
            </NcButton>
          </div>
        </div>
      </div>

      <!-- Publishing Section -->
      <div class="border border-nc-border-gray-medium rounded-lg p-6">
        <div class="flex items-center gap-2 mb-4">
          <div class="text-nc-content-gray-emphasis font-semibold">{{ $t('labels.publishing') }}</div>
        </div>

        <div v-if="!isPublished" class="bg-nc-bg-blue-light border border-nc-border-blue rounded-lg p-4 mb-4">
          <div class="flex items-start gap-3">
            <GeneralIcon icon="info" class="text-nc-content-blue-dark w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <div class="text-nc-content-gray-emphasis font-medium text-sm mb-1">Ready to go live?</div>
              <div class="text-nc-content-gray text-sm">
                Your application is in draft mode. Publish to the App Store and let others install a fully-functional copy that
                stays synchronized with your updates.
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <!-- Publish/Update Version -->
          <div class="flex items-start gap-4">
            <div class="flex-1">
              <div class="text-nc-content-gray-emphasis font-medium text-sm mb-2">
                {{ isPublished ? 'Publish New Version' : 'Initial Publication' }}
              </div>
              <div class="text-nc-content-gray text-sm mb-3">
                <template v-if="isPublished">
                  Release a new version with enhanced features. All installations will automatically receive your improvements,
                  scripts, and workflow updates.
                </template>
                <template v-else> Launch version 1.0.0 and make your application available for worldwide installation. </template>
              </div>
              <NcButton
                size="medium"
                :type="isPublished ? 'primary' : 'primary'"
                data-testid="nc-publish-sandbox-button"
                @click="openPublishModal"
              >
                {{ isPublished ? 'Publish New Version' : $t('labels.publishToAppStore') }}
              </NcButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Version History (Published only) -->
      <div v-if="isPublished">
        <!-- Version History -->
        <div class="border border-nc-border-gray-medium rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="clock" class="w-4 h-4 text-nc-content-gray-emphasis" />
              <div class="text-nc-content-gray-emphasis font-semibold">Version History</div>
            </div>
            <div v-if="versions.length > 0" class="text-xs text-nc-content-gray-subtle2">
              {{ versions.length }} {{ versions.length === 1 ? 'version' : 'versions' }}
            </div>
          </div>

          <div v-if="isLoadingVersions" class="flex items-center justify-center py-8">
            <a-spin size="small" />
          </div>

          <div v-else-if="versions.length === 0" class="text-center py-8 text-nc-content-gray-subtle2 text-sm">
            No versions published yet
          </div>

          <div v-else class="space-y-3 max-h-96 overflow-y-auto">
            <div
              v-for="version in versions"
              :key="version.id"
              class="border border-nc-border-gray-light rounded-lg p-3 hover:border-nc-border-gray-medium transition-colors"
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2">
                  <div class="px-2 py-0.5 bg-nc-bg-blue-dark text-nc-content-blue-dark rounded text-xs font-mono font-semibold">
                    v{{ version.version }}
                  </div>
                  <div
                    v-if="version.version === sandbox.version"
                    class="px-2 py-0.5 bg-nc-bg-green-dark text-nc-content-green-dark rounded text-xs font-medium"
                  >
                    Current
                  </div>
                </div>
                <div class="text-xs text-nc-content-gray-subtle2">
                  {{ formatDate(version.created_at) }}
                </div>
              </div>
              <div v-if="version.release_notes" class="text-sm text-nc-content-gray mt-2">
                {{ version.release_notes }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Sandbox Modal -->
    <GeneralModal v-model:visible="isCreateModalVisible" size="medium" centered>
      <div class="flex flex-col p-6">
        <div class="flex items-center gap-3 pb-4 mb-4 border-b border-nc-border-gray-medium">
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
            <GeneralIcon icon="box" class="w-5 h-5 text-white" />
          </div>
          <div>
            <div class="font-semibold text-lg text-nc-content-gray-emphasis">{{ $t('labels.createSandbox') }}</div>
            <div class="text-xs text-nc-content-gray-subtle2">Configure your application for the App Store</div>
          </div>
        </div>

        <div class="mb-4 bg-nc-bg-blue-light border border-nc-border-blue rounded-lg p-3">
          <div class="flex gap-2 text-sm text-nc-content-gray">
            <GeneralIcon icon="info" class="w-4 h-4 text-nc-content-blue-dark mt-0.5 flex-shrink-0" />
            <div>
              Transform your base into a living application. Every improvement you make will automatically flow to all installed
              copies.
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-4 mb-6">
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-2 block">
              {{ $t('labels.sandboxTitle') }} <span class="text-nc-content-red-dark">*</span>
            </label>
            <a-input v-model:value="sandboxForm.title" placeholder="Enter a descriptive title" size="large" class="rounded-lg" />
          </div>

          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-2 block">
              {{ $t('labels.sandboxDescription') }}
            </label>
            <a-textarea
              v-model:value="sandboxForm.description"
              placeholder="Describe your application's capabilities and the value it delivers to users"
              :rows="3"
              size="large"
              class="rounded-lg"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-nc-content-gray text-sm font-medium mb-2 block">
                {{ $t('labels.sandboxCategory') }}
              </label>
              <a-input v-model:value="sandboxForm.category" placeholder="e.g., CRM, Inventory" size="large" class="rounded-lg" />
            </div>

            <div>
              <label class="text-nc-content-gray text-sm font-medium mb-2 block">
                {{ $t('labels.sandboxVisibility') }}
              </label>
              <a-select v-model:value="sandboxForm.visibility" size="large" class="w-full rounded-lg">
                <a-select-option value="public">
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="eye" class="w-4 h-4" />
                    <span>Public</span>
                  </div>
                </a-select-option>
                <a-select-option value="private">
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="lock" class="w-4 h-4" />
                    <span>Private</span>
                  </div>
                </a-select-option>
                <a-select-option value="unlisted">
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="ncEyeOff" class="w-4 h-4" />
                    <span>Unlisted</span>
                  </div>
                </a-select-option>
              </a-select>
            </div>
          </div>

          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-2 block">
              {{ $t('labels.sandboxTags') }}
            </label>
            <a-select
              v-model:value="sandboxForm.tags"
              mode="tags"
              placeholder="Add tags to help users discover your application"
              size="large"
              class="w-full rounded-lg"
            />
          </div>
        </div>

        <div class="flex flex-row gap-x-2 pt-4 border-t border-nc-border-gray-medium justify-end">
          <NcButton type="secondary" size="medium" @click="isCreateModalVisible = false">
            {{ $t('general.cancel') }}
          </NcButton>

          <NcButton
            key="submit"
            type="primary"
            size="medium"
            html-type="submit"
            :loading="isLoading"
            :disabled="!sandboxForm.title"
            data-testid="nc-create-sandbox-confirm-btn"
            @click="createSandbox"
          >
            <template #icon>
              <GeneralIcon icon="check" />
            </template>
            {{ $t('labels.createSandbox') }}
          </NcButton>
        </div>
      </div>
    </GeneralModal>

    <!-- Publish Modal -->
    <GeneralModal v-model:visible="isPublishModalVisible" size="medium" centered>
      <div class="flex flex-col p-6">
        <div class="flex items-center gap-3 pb-4 mb-4 border-b border-nc-border-gray-medium">
          <div>
            <div class="font-semibold text-lg text-nc-content-gray-emphasis">
              {{ isInitialPublish ? 'Launch Your Application' : 'Release New Version' }}
            </div>
            <div class="text-xs text-nc-content-gray-subtle2">
              {{
                isInitialPublish ? 'Deploy your application to the agentic app store' : 'Push updates to all active installations'
              }}
            </div>
          </div>
        </div>

        <div v-if="!isInitialPublish" class="mb-4 bg-nc-bg-orange-light border border-nc-border-orange rounded-lg p-3">
          <div class="flex gap-2 text-sm">
            <GeneralIcon icon="alertTriangle" class="w-4 h-4 text-nc-content-orange-dark mt-0.5 flex-shrink-0" />
            <div class="text-nc-content-gray">
              <div class="font-semibold mb-1">Live Synchronization</div>
              <div class="text-xs">
                This release will instantly propagate to all installations. Users will receive your schema improvements, new
                automations, and workflow enhancements automatically.
              </div>
            </div>
          </div>
        </div>

        <div v-else class="mb-4 bg-nc-bg-blue-light border border-nc-border-blue rounded-lg p-3">
          <div class="flex gap-2 text-sm text-nc-content-gray">
            <GeneralIcon icon="info" class="w-4 h-4 text-nc-content-blue-dark mt-0.5 flex-shrink-0" />
            <div>
              Your application will go live with the specified version. Users worldwide can discover, install, and benefit from
              continuous updates as you evolve the application.
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-4 mb-6">
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-2 block">
              Version Number <span class="text-nc-content-red-dark">*</span>
            </label>
            <a-input
              v-model:value="publishForm.version"
              placeholder="e.g., 1.0.0, 1.2.3"
              size="large"
              class="rounded-lg font-mono"
              :disabled="isInitialPublish"
            >
              <template #prefix>
                <GeneralIcon icon="tag" class="w-4 h-4 text-nc-content-gray-subtle2" />
              </template>
            </a-input>
            <div class="text-xs text-nc-content-gray-subtle2 mt-1.5">
              {{ isInitialPublish ? 'Initial version is set to 1.0.0' : 'Use semantic versioning (e.g., MAJOR.MINOR.PATCH)' }}
            </div>
          </div>

          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-2 block"> Release Notes </label>
            <a-textarea
              v-model:value="publishForm.releaseNotes"
              placeholder="Describe what's new in this version..."
              :rows="4"
              size="large"
              class="rounded-lg"
            />
            <div class="text-xs text-nc-content-gray-subtle2 mt-1.5">Help users understand what changed in this version</div>
          </div>
        </div>

        <div class="flex flex-row gap-x-2 pt-4 border-t border-nc-border-gray-medium justify-end">
          <NcButton type="secondary" size="medium" @click="isPublishModalVisible = false">
            {{ $t('general.cancel') }}
          </NcButton>

          <NcButton
            key="submit"
            type="primary"
            size="medium"
            html-type="submit"
            :loading="isLoading"
            :disabled="!publishForm.version"
            data-testid="nc-publish-sandbox-confirm-btn"
            @click="publishSandbox"
          >
            <template #icon>
              <GeneralIcon icon="rocket" />
            </template>
            {{ isInitialPublish ? 'Publish' : 'Publish & Update All' }}
          </NcButton>
        </div>
      </div>
    </GeneralModal>
  </div>
</template>
