<script setup lang="ts">
import { DefaultEnvironmentKey } from 'nocodb-sdk'
import type { EnvironmentType } from 'nocodb-sdk'

const emit = defineEmits(['back'])

const environmentsStore = useEnvironments()

const { environments, isLoading } = storeToRefs(environmentsStore)

const { loadEnvironments, deleteEnvironment, createEnvironment, updateEnvironment } = environmentsStore

const {
  blockCustomEnvironment,
  isEnvironmentBlocked,
  environmentUpgradeFeature,
  showUpgradeToUseStagingEnvironment,
  showUpgradeToUseCustomEnvironment,
} = useEeConfig()

const isEditModalOpen = ref(false)

const editingEnvironment = ref<EnvironmentType | undefined>()

const isDeleteModalOpen = ref(false)

const environmentToDelete = ref<EnvironmentType | undefined>()

function openCreate() {
  // Creating here is always a custom environment — gate by feature.
  if (blockCustomEnvironment.value) {
    showUpgradeToUseCustomEnvironment({ triggerSource: 'manage-environments-new' })
    return
  }
  editingEnvironment.value = undefined
  isEditModalOpen.value = true
}

// Clicking a plan-locked env card opens the matching upgrade prompt.
function onBlockedEnvironmentClick(environment: EnvironmentType) {
  if (environment.key === DefaultEnvironmentKey.STAGING) {
    showUpgradeToUseStagingEnvironment({ triggerSource: 'manage-environments-card' })
  } else {
    showUpgradeToUseCustomEnvironment({ triggerSource: 'manage-environments-card' })
  }
}

function openEdit(environment: EnvironmentType) {
  editingEnvironment.value = environment
  isEditModalOpen.value = true
}

function openDelete(environment: EnvironmentType) {
  environmentToDelete.value = environment
  isDeleteModalOpen.value = true
}

async function onDeleteConfirm() {
  if (environmentToDelete.value?.id) {
    await deleteEnvironment(environmentToDelete.value.id)
  }
}

// Workspace-scoped persistence for the shared EditModal (org uses the v3 routes).
async function saveEnvironment(body: { title: string; description: string; color: string }, environment?: EnvironmentType) {
  if (environment?.id) {
    await updateEnvironment(environment.id, body)
  } else {
    await createEnvironment(body)
  }
}

onMounted(() => loadEnvironments())
</script>

<template>
  <div class="h-full flex flex-col nc-manage-environments">
    <NcButton
      type="link"
      size="small"
      class="!text-nc-content-brand self-start !-ml-1.5 mb-4 !p-0 !h-auto !min-h-0"
      inner-class="hover:underline"
      data-testid="nc-environments-back"
      @click="emit('back')"
    >
      <GeneralIcon icon="arrowLeft" class="mr-1" />
      {{ $t('general.backToIntegrations') }}
    </NcButton>

    <div class="flex items-center justify-between mb-2">
      <h2 class="text-lg font-semibold text-nc-content-gray mb-0">{{ $t('title.environments') }}</h2>
      <div class="flex items-center gap-2">
        <NcButton size="small" data-testid="nc-new-environment-btn" @click="openCreate">
          <GeneralIcon icon="plus" class="h-4 w-4" />
          {{ $t('title.newEnvironment') }}
        </NcButton>
      </div>
    </div>

    <div class="text-sm text-nc-content-gray-subtle2 mb-6 max-w-2xl">{{ $t('msg.info.environmentsShared') }}</div>

    <div v-if="isLoading && !environments.length" class="flex items-center justify-center py-16">
      <GeneralLoader size="large" />
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="environment in environments"
        :key="environment.id"
        class="nc-environment-card flex flex-col gap-3 p-4 rounded-2xl border-1 border-nc-border-gray-medium"
        :class="{ 'cursor-pointer hover:border-nc-border-brand': isEnvironmentBlocked(environment) }"
        :data-testid="`nc-environment-card-${environment.key}`"
        @click="isEnvironmentBlocked(environment) && onBlockedEnvironmentClick(environment)"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-3 h-3 rounded-full flex-none" :style="{ backgroundColor: environment.color || '#6a7184' }" />
            <NcTooltip class="truncate text-nc-content-gray-emphasis font-weight-600" show-on-truncate-only>
              {{ environment.title }}
            </NcTooltip>
            <NcBadge v-if="environment.is_default" :border="false" color="gray" class="!text-captionSm">
              {{ $t('general.default').toUpperCase() }}
            </NcBadge>
            <PaymentUpgradeBadge
              v-if="environmentUpgradeFeature(environment)"
              :feature="environmentUpgradeFeature(environment)"
              remove-click
            />
          </div>

          <!-- Built-ins (locked) and org-scoped envs aren't editable from the workspace -->
          <div v-if="!environment.is_locked && !environment.fk_org_id" class="flex items-center gap-1 flex-none">
            <NcButton
              type="text"
              size="xsmall"
              :data-testid="`nc-environment-edit-${environment.key}`"
              @click.stop="openEdit(environment)"
            >
              <GeneralIcon icon="edit" class="h-4 w-4 text-nc-content-gray-muted" />
            </NcButton>
            <NcButton
              type="text"
              size="xsmall"
              :data-testid="`nc-environment-delete-${environment.key}`"
              @click.stop="openDelete(environment)"
            >
              <GeneralIcon icon="delete" class="h-4 w-4 text-nc-content-red-medium" />
            </NcButton>
          </div>
        </div>

        <div class="text-nc-content-gray-subtle2 text-bodySm min-h-[2.5rem]">
          {{ environment.description }}
        </div>
      </div>
    </div>

    <WorkspaceIntegrationsEnvironmentsEditModal
      v-model="isEditModalOpen"
      :environment="editingEnvironment"
      :save-handler="saveEnvironment"
      @saved="loadEnvironments({ force: true })"
    />

    <GeneralDeleteModal
      v-model:visible="isDeleteModalOpen"
      :entity-name="$t('general.environment')"
      :on-delete="onDeleteConfirm"
      :delete-label="$t('general.delete')"
      :show-default-delete-msg="true"
    >
      <template #entity-preview>
        <div class="flex items-center gap-2 py-2 px-3 bg-nc-bg-gray-extralight rounded-lg">
          <span class="w-3 h-3 rounded-full flex-none" :style="{ backgroundColor: environmentToDelete?.color || '#6a7184' }" />
          <span class="truncate text-nc-content-gray font-weight-500">{{ environmentToDelete?.title }}</span>
        </div>
      </template>
    </GeneralDeleteModal>
  </div>
</template>
