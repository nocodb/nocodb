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
const isCreateModalVisible = ref(false)
const isPublishModalVisible = ref(false)
const isUnpublishModalVisible = ref(false)
const isPublishChangesModalVisible = ref(false)

const sandbox = ref<any | null>(null)

const sandboxForm = reactive({
  title: '',
  description: '',
  category: '',
  tags: [] as string[],
  visibility: 'public',
})

const loadSandbox = async () => {
  if (!baseId.value || !base.value?.fk_workspace_id) return

  try {
    const response = await $api.internal.getOperation(base.value.fk_workspace_id, baseId.value, {
      operation: 'sandboxGet',
      baseId: baseId.value,
    } as any)
    if (response) {
      sandbox.value = response
    }
  } catch (e) {
    // Sandbox doesn't exist yet
    sandbox.value = null
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
    await $api.internal.postOperation(
      base.value.fk_workspace_id,
      baseId.value,
      {
        operation: 'sandboxPublish',
      },
      {
        sandboxId: sandbox.value.id,
      },
    )

    message.success(t('msg.success.sandboxPublished'))

    await loadSandbox()

    isPublishModalVisible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const unpublishSandbox = async () => {
  if (!baseId.value || !sandbox.value || !base.value?.fk_workspace_id) return

  isLoading.value = true
  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id,
      baseId.value,
      {
        operation: 'sandboxUnpublish',
      },
      {
        sandboxId: sandbox.value.id,
      },
    )

    message.success(t('msg.success.sandboxUnpublished'))

    await loadSandbox()

    isUnpublishModalVisible.value = false
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

const publishChanges = async () => {
  if (!baseId.value || !sandbox.value || !base.value?.fk_workspace_id) return

  isLoading.value = true
  try {
    await $api.internal.postOperation(
      base.value.fk_workspace_id,
      baseId.value,
      {
        operation: 'sandboxApplyUpdates',
      },
      {
        sandboxId: sandbox.value.id,
      },
    )

    message.success(t('msg.success.changesPublished'))

    await loadSandbox()

    isPublishChangesModalVisible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const openCreateModal = () => {
  sandboxForm.title = base.value?.title || ''
  sandboxForm.description = ''
  sandboxForm.category = ''
  sandboxForm.tags = []
  sandboxForm.visibility = 'public'
  isCreateModalVisible.value = true
}

const openUpdateForm = () => {
  if (!sandbox.value) return
  sandboxForm.title = sandbox.value.title
  sandboxForm.description = sandbox.value.description || ''
  sandboxForm.category = sandbox.value.category || ''
  sandboxForm.tags = Array.isArray(sandbox.value.tags) ? sandbox.value.tags : []
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
    <div class="text-nc-content-gray-emphasis font-semibold text-lg">{{ $t('labels.sandboxAppStore') }}</div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
      Publish this base to the NocoDB App Store to share it with others as a ready-to-use application template.
      <a href="https://docs.nocodb.com/" target="_blank" rel="noopener noreferrer" class="text-nc-content-brand"> Learn more </a>
    </div>

    <!-- Base not V3 warning -->
    <div v-if="base?.version !== BaseVersion.V3" class="mt-6">
      <div class="bg-orange-50 border-l-4 border-orange-400 p-4">
        <div class="flex items-start gap-2">
          <GeneralIcon icon="alertTriangle" class="flex-none text-orange-500 mt-0.5 w-5 h-5" />
          <div>
            <div class="text-nc-content-gray-emphasis font-semibold text-sm mb-1">{{ $t('labels.baseMustBeV3') }}</div>
            <div class="text-nc-content-gray text-sm">
              Only V3 bases can be published to the App Store. Please migrate this base to V3 first.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Sandbox Created Yet -->
    <div v-else-if="!sandbox" class="mt-6">
      <div class="text-nc-content-gray-emphasis font-semibold mb-3">{{ $t('labels.createSandbox') }}</div>
      <div class="flex flex-col gap-2 mb-6">
        <div class="flex items-start gap-2">
          <span class="text-nc-content-gray text-sm">•</span>
          <span class="text-nc-content-gray text-sm">
            Convert this base into a <span class="font-semibold">sandbox application</span> that can be installed by others
          </span>
        </div>
        <div class="flex items-start gap-2">
          <span class="text-nc-content-gray text-sm">•</span>
          <span class="text-nc-content-gray text-sm">
            Installed instances will be <span class="font-semibold">schema-locked</span> and receive updates from this master base
          </span>
        </div>
        <div class="flex items-start gap-2">
          <span class="text-nc-content-gray text-sm">•</span>
          <span class="text-nc-content-gray text-sm">
            Users can <span class="font-semibold">add data</span> to installed instances without modifying the schema
          </span>
        </div>
      </div>

      <div class="flex gap-2">
        <NcButton size="medium" type="primary" data-testid="nc-create-sandbox-button" @click="openCreateModal">
          {{ $t('labels.createSandbox') }}
        </NcButton>
      </div>
    </div>

    <!-- Sandbox Exists -->
    <div v-else class="mt-6">
      <div class="bg-nc-bg-gray-light border border-nc-border-gray-medium rounded-lg p-4 mb-6">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <div class="text-nc-content-gray-emphasis font-semibold text-base">{{ sandbox.title }}</div>
              <div
                v-if="sandbox.status === 'published'"
                class="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 font-medium"
              >
                {{ $t('labels.published') }}
              </div>
              <div v-else class="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700 font-medium">{{ $t('labels.draft') }}</div>
            </div>
            <div v-if="sandbox.description" class="text-nc-content-gray text-sm mb-2">{{ sandbox.description }}</div>
            <div class="flex gap-3 text-xs text-nc-content-gray-subtle2">
              <div v-if="sandbox.category">{{ $t('labels.sandboxCategory') }}: {{ sandbox.category }}</div>
              <div v-if="sandbox.version">Version: {{ sandbox.version }}</div>
              <div>{{ $t('labels.installs') }}: {{ sandbox.install_count || 0 }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Update Sandbox Form -->
      <div class="mb-6">
        <div class="text-nc-content-gray-emphasis font-semibold mb-3">{{ $t('labels.sandboxDetails') }}</div>
        <div class="flex flex-col gap-4">
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-1 block">{{ $t('labels.sandboxTitle') }}</label>
            <a-input v-model:value="sandboxForm.title" placeholder="Enter sandbox title" />
          </div>
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-1 block">{{ $t('labels.sandboxDescription') }}</label>
            <a-textarea v-model:value="sandboxForm.description" placeholder="Describe what this sandbox app does" :rows="3" />
          </div>
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-1 block">{{ $t('labels.sandboxCategory') }}</label>
            <a-input v-model:value="sandboxForm.category" placeholder="e.g., CRM, Project Management, Inventory" />
          </div>
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-1 block">{{ $t('labels.sandboxTags') }}</label>
            <a-select
              v-model:value="sandboxForm.tags"
              mode="tags"
              placeholder="Add tags for better discoverability"
              class="w-full"
            />
          </div>

          <div class="flex gap-2">
            <NcButton size="medium" type="primary" :loading="isLoading" @click="updateSandbox">
              {{ $t('labels.updateDetails') }}
            </NcButton>
          </div>
        </div>
      </div>

      <!-- Publishing Actions -->
      <div class="border-t border-nc-border-gray-medium pt-6">
        <div class="text-nc-content-gray-emphasis font-semibold mb-3">Publishing</div>

        <div v-if="sandbox.status !== 'published'" class="mb-4">
          <div class="text-nc-content-gray text-sm mb-3">
            Your sandbox is currently in draft mode. Publish it to make it available in the App Store.
          </div>
          <NcButton size="medium" type="primary" data-testid="nc-publish-sandbox-button" @click="isPublishModalVisible = true">
            {{ $t('labels.publishToAppStore') }}
          </NcButton>
        </div>

        <div v-else>
          <div class="text-nc-content-gray text-sm mb-4">
            Your sandbox is published in the App Store. Users can discover and install it.
          </div>

          <!-- Publish Changes Section -->
          <div class="mb-6">
            <div class="text-nc-content-gray-emphasis font-medium mb-2">{{ $t('labels.publishChanges') }}</div>
            <div class="text-nc-content-gray text-sm mb-3">
              Push the current state of this base to all installations. This will synchronize the complete schema, views, hooks, scripts, and dashboards while preserving user data.
            </div>
            <NcButton
              size="medium"
              type="primary"
              data-testid="nc-publish-changes-button"
              @click="isPublishChangesModalVisible = true"
            >
              {{ $t('labels.publishChanges') }}
            </NcButton>
          </div>

          <!-- Unpublish Section -->
          <div class="mb-4">
            <div class="text-nc-content-gray-emphasis font-medium mb-2">{{ $t('labels.unpublish') }}</div>
            <div class="text-nc-content-gray text-sm mb-3">
              Remove this sandbox from the App Store. Existing installations will continue to work, but new installations will not be possible.
            </div>
            <NcButton
              size="medium"
              type="danger"
              data-testid="nc-unpublish-sandbox-button"
              @click="isUnpublishModalVisible = true"
            >
              {{ $t('labels.unpublish') }}
            </NcButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Sandbox Modal -->
    <GeneralModal v-model:visible="isCreateModalVisible" size="medium" centered>
      <div class="flex flex-col p-6">
        <div class="flex flex-row pb-2 mb-4 font-semibold text-lg text-nc-content-gray-emphasis">
          {{ $t('labels.createSandbox') }}
        </div>

        <div class="mb-4 text-nc-content-gray text-sm">
          This will convert your base into a sandbox application that can be shared in the App Store.
        </div>

        <div class="flex flex-col gap-4 mb-4">
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-1 block">{{ $t('labels.sandboxTitle') }} *</label>
            <a-input v-model:value="sandboxForm.title" placeholder="Enter sandbox title" />
          </div>
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-1 block">{{ $t('labels.sandboxDescription') }}</label>
            <a-textarea v-model:value="sandboxForm.description" placeholder="Describe what this sandbox app does" :rows="3" />
          </div>
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-1 block">{{ $t('labels.sandboxCategory') }}</label>
            <a-input v-model:value="sandboxForm.category" placeholder="e.g., CRM, Project Management, Inventory" />
          </div>
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-1 block">{{ $t('labels.sandboxTags') }}</label>
            <a-select
              v-model:value="sandboxForm.tags"
              mode="tags"
              placeholder="Add tags for better discoverability"
              class="w-full"
            />
          </div>
          <div>
            <label class="text-nc-content-gray text-sm font-medium mb-1 block">{{ $t('labels.sandboxVisibility') }}</label>
            <a-select v-model:value="sandboxForm.visibility" class="w-full">
              <a-select-option value="public">Public - Anyone can discover and install</a-select-option>
              <a-select-option value="unlisted">Unlisted - Only accessible via direct link</a-select-option>
              <a-select-option value="private">Private - Only you can see it</a-select-option>
            </a-select>
          </div>
        </div>

        <div class="flex flex-row gap-x-2 mt-2 pt-4 border-t border-nc-border-gray-medium justify-end">
          <NcButton type="secondary" size="small" @click="isCreateModalVisible = false">{{ $t('general.cancel') }}</NcButton>

          <NcButton
            key="submit"
            type="primary"
            size="small"
            html-type="submit"
            :loading="isLoading"
            :disabled="!sandboxForm.title"
            data-testid="nc-create-sandbox-confirm-btn"
            @click="createSandbox"
          >
            {{ $t('labels.createSandbox') }}
            <template #loading>{{ $t('general.creating') }}...</template>
          </NcButton>
        </div>
      </div>
    </GeneralModal>

    <!-- Publish Modal -->
    <GeneralModal v-model:visible="isPublishModalVisible" size="small" centered>
      <div class="flex flex-col p-6">
        <div class="flex flex-row pb-2 mb-4 font-semibold text-lg text-nc-content-gray-emphasis">
          {{ $t('labels.publishToAppStore') }}
        </div>

        <div class="mb-4 text-nc-content-gray text-sm">
          Are you sure you want to publish this sandbox to the App Store? It will become available for others to discover and
          install.
        </div>

        <div class="flex flex-row gap-x-2 mt-2 pt-4 border-t border-nc-border-gray-medium justify-end">
          <NcButton type="secondary" size="small" @click="isPublishModalVisible = false">{{ $t('general.cancel') }}</NcButton>

          <NcButton
            key="submit"
            type="primary"
            size="small"
            html-type="submit"
            :loading="isLoading"
            data-testid="nc-publish-sandbox-confirm-btn"
            @click="publishSandbox"
          >
            {{ $t('general.publish') }}
            <template #loading>{{ $t('labels.publishing') }}...</template>
          </NcButton>
        </div>
      </div>
    </GeneralModal>

    <!-- Publish Changes Modal -->
    <GeneralModal v-model:visible="isPublishChangesModalVisible" size="small" centered>
      <div class="flex flex-col p-6">
        <div class="flex flex-row pb-2 mb-4 font-semibold text-lg text-nc-content-gray-emphasis">
          {{ $t('labels.publishChanges') }}
        </div>

        <div class="mb-4 text-nc-content-gray text-sm">
          This will push the current state of this base to all installations. The complete schema, configuration, views, hooks, and dashboards will be synchronized. User data in installations will be preserved.
        </div>

        <div class="bg-orange-50 border-l-4 border-orange-400 p-3 mb-4">
          <div class="flex items-start gap-2">
            <GeneralIcon icon="alertTriangle" class="flex-none text-orange-500 mt-0.5 w-4 h-4" />
            <div class="text-orange-700 text-xs">
              <div class="font-semibold mb-1">Warning</div>
              <div>
                This will overwrite the schema in all installed bases with the current state of this master base. This action
                cannot be undone.
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-row gap-x-2 mt-2 pt-4 border-t border-nc-border-gray-medium justify-end">
          <NcButton type="secondary" size="small" @click="isPublishChangesModalVisible = false">{{ $t('general.cancel') }}</NcButton>

          <NcButton
            key="submit"
            type="primary"
            size="small"
            html-type="submit"
            :loading="isLoading"
            data-testid="nc-publish-changes-confirm-btn"
            @click="publishChanges"
          >
            {{ $t('labels.publishChanges') }}
            <template #loading>{{ $t('labels.publishingChanges') }}...</template>
          </NcButton>
        </div>
      </div>
    </GeneralModal>

    <!-- Unpublish Modal -->
    <GeneralModal v-model:visible="isUnpublishModalVisible" size="small" centered>
      <div class="flex flex-col p-6">
        <div class="flex flex-row pb-2 mb-4 font-semibold text-lg text-nc-content-gray-emphasis">
          {{ $t('labels.unpublish') }} {{ $t('labels.sandbox') }}
        </div>

        <div class="mb-4 text-nc-content-gray text-sm">
          Are you sure you want to unpublish this sandbox? It will no longer be visible in the App Store, but existing
          installations will continue to work.
        </div>

        <div class="flex flex-row gap-x-2 mt-2 pt-4 border-t border-nc-border-gray-medium justify-end">
          <NcButton type="secondary" size="small" @click="isUnpublishModalVisible = false">{{ $t('general.cancel') }}</NcButton>

          <NcButton
            key="submit"
            type="danger"
            size="small"
            html-type="submit"
            :loading="isLoading"
            data-testid="nc-unpublish-sandbox-confirm-btn"
            @click="unpublishSandbox"
          >
            {{ $t('labels.unpublish') }}
            <template #loading>{{ $t('labels.unpublishing') }}...</template>
          </NcButton>
        </div>
      </div>
    </GeneralModal>
  </div>
</template>
