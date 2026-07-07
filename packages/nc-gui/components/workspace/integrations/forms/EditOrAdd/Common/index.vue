<script lang="ts" setup>
import { DefaultEnvironmentKey, integrationSupportsEnvironments } from 'nocodb-sdk'
import type { EnvironmentType } from 'nocodb-sdk'
import { type IntegrationCategoryType, SyncDataType, type clientTypes as _clientTypes } from '#imports'

const props = defineProps<{
  open: boolean
  integrationType: IntegrationCategoryType
  integrationSubType: SyncDataType
  baseId?: string
}>()

const emit = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emit)

const {
  pageMode,
  IntegrationsPageMode,
  activeIntegration,
  activeIntegrationItem,
  saveIntegration,
  updateIntegration,
  testConnection,
} = useIntegrationStore()

const { $api } = useNuxtApp()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { activeProjectId } = storeToRefs(useBases())

const isEditMode = computed(() => pageMode.value === IntegrationsPageMode.EDIT)

const environmentsStore = useEnvironments()

const { environments } = storeToRefs(environmentsStore)

const { loadEnvironments, setIntegrationEnvConfig, deleteIntegrationEnvConfig, createEnvironment } = environmentsStore

const {
  blockCustomEnvironment,
  isEnvironmentBlocked,
  environmentUpgradeFeature,
  showUpgradeToUseStagingEnvironment,
  showUpgradeToUseCustomEnvironment,
} = useEeConfig()

// Which environment tab is being edited.
const activeEnvKey = ref<string>(DefaultEnvironmentKey.PRODUCTION)

// Unsaved per-env config edits, preserved when switching tabs.
const configByEnv = ref<Record<string, any>>({})

const isEnvAddModalOpen = ref(false)

const activeEnv = computed(() => environments.value.find((e) => e.key === activeEnvKey.value))

const isProductionEnv = computed(() => activeEnvKey.value === DefaultEnvironmentKey.PRODUCTION)

// The stored config override for an env id (from the inlined integration.environments).
function envOverrideConfig(envId?: string) {
  return (activeIntegration.value?.environments ?? []).find((e) => e.fk_environment_id === envId)?.config
}

const testConnectionResult = ref<{ success: boolean; message?: string } | null>(null)

const testConnectionLoading = ref(false)

const initState = ref({
  type: props.integrationType,
  sub_type: props.integrationSubType,
})

const formSchemaForEnv = computed(() => {
  const schema = activeIntegrationItem.value?.form
  if (!schema || isProductionEnv.value || pageMode.value === IntegrationsPageMode.ADD) return schema
  return schema.map((field) => (field.model === 'title' ? { ...field, disabled: true } : field))
})

const { form, formState, isLoading, initialState, submit } = useProvideFormBuilderHelper({
  formSchema: formSchemaForEnv,
  initialState: initState,
  onSubmit: async () => {
    // if it is edit mode and activeIntegration id is not present then return
    if (isEditMode.value && !activeIntegration.value?.id) return

    isLoading.value = true

    try {
      if (pageMode.value === IntegrationsPageMode.ADD) {
        // Stash the tab currently being edited so its config isn't lost.
        configByEnv.value[activeEnvKey.value] = formState.value.config

        // Single-call create: production config becomes the integration's own
        // config; each non-production env's config rides along inline and the
        // backend persists every override atomically (no client-side N+1).
        // Omitted entirely when there are no overrides (unsupported integration
        // types never grow env tabs, so they never send the key at all).
        const environmentOverrides = environments.value
          .filter((env) => env.id && env.key !== DefaultEnvironmentKey.PRODUCTION)
          .map((env) => ({ fk_environment_id: env.id!, config: configByEnv.value[env.key] }))
          .filter((e) => e.config && Object.keys(e.config).length)

        await saveIntegration(
          {
            ...formState.value,
            config: configByEnv.value[DefaultEnvironmentKey.PRODUCTION] ?? formState.value.config,
            ...(environmentOverrides.length ? { environments: environmentOverrides } : {}),
          },
          'create',
          false,
          props.baseId,
        )
      } else if (isProductionEnv.value) {
        // Production tab → the integration's own config (title shared here).
        await updateIntegration(
          {
            id: activeIntegration.value?.id,
            ...formState.value,
          },
          props.baseId,
        )
      } else if (activeEnv.value?.id) {
        // Non-production tab → save this environment's config override only.
        // An empty config means "no override" — remove it instead of persisting
        // `{}`, which the backend rejects and which would otherwise silently
        // fall back to production credentials at read time.
        if (formState.value.config && Object.keys(formState.value.config).length) {
          await setIntegrationEnvConfig(activeIntegration.value!.id!, activeEnv.value.id, formState.value.config)
        } else {
          const deleted = await deleteIntegrationEnvConfig(activeIntegration.value!.id!, activeEnv.value.id)
          if (!deleted) throw new Error('Failed to remove environment override')
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      isLoading.value = false
    }
  },
  onChange: () => {
    testConnectionResult.value = null
  },
  fetchOptions: async (key) => {
    const wsId = activeWorkspaceId?.value
    if (!wsId) return []
    return await $api.internal.postOperation(
      wsId,
      activeProjectId.value || NO_SCOPE,
      { operation: activeProjectId.value ? 'baseIntegrationFetchOptions' : 'integrationFetchOptions' },
      {
        integration: formState.value,
        key,
      },
    )
  },
})

// Per-environment overrides only apply to Auth & AI integrations — not Database
// sources, Sync connectors or workflow nodes.
const showEnvTabs = computed(
  () => isEeUI && integrationSupportsEnvironments(props.integrationType) && environments.value.length > 0,
)

function onEnvTabChange(key: string | number) {
  const env = environments.value.find((e) => e.key === key)
  if (env) switchEnv(env)
}

function switchEnv(env: EnvironmentType) {
  if (env.key === activeEnvKey.value) return

  if (isEnvironmentBlocked(env)) {
    if (env.key === DefaultEnvironmentKey.STAGING) {
      showUpgradeToUseStagingEnvironment({ triggerSource: 'integration-env-tab' })
    } else {
      showUpgradeToUseCustomEnvironment({ triggerSource: 'integration-env-tab' })
    }
    return
  }

  // Stash the current tab's (possibly unsaved) edits, then load the target env's
  // config — cache → stored override (production = the integration's own) → empty.
  configByEnv.value[activeEnvKey.value] = formState.value.config
  activeEnvKey.value = env.key
  formState.value.config =
    configByEnv.value[env.key] ??
    (env.key === DefaultEnvironmentKey.PRODUCTION ? activeIntegration.value?.config : envOverrideConfig(env.id)) ??
    {}
}

function applySandboxDefaultEnv() {
  if (pageMode.value !== IntegrationsPageMode.EDIT) return

  const sbxKey = environmentsStore.sandboxEnvironmentKey
  if (!sbxKey || sbxKey === activeEnvKey.value) return

  const env = environments.value.find((e) => e.key === sbxKey)
  if (!env || isEnvironmentBlocked(env)) return

  configByEnv.value[activeEnvKey.value] = formState.value.config
  activeEnvKey.value = sbxKey
  formState.value.config = envOverrideConfig(env.id) ?? {}
}

// Quick "+ New environment" from the tab strip — gate the custom feature.
function openNewEnvironment() {
  if (blockCustomEnvironment.value) {
    showUpgradeToUseCustomEnvironment({ triggerSource: 'integration-env-tab-new' })
    return
  }
  isEnvAddModalOpen.value = true
}

// Workspace-scoped persistence for the quick "+ New environment" modal.
async function saveEnvironment(body: { title: string; description: string; color: string }) {
  await createEnvironment(body)
}

// select and focus title field on load
onMounted(async () => {
  isLoading.value = true

  if (pageMode.value === IntegrationsPageMode.ADD) {
    formState.value.title = activeIntegration.value?.title || ''

    // Load envs so the create form can offer per-environment config tabs too.
    if (isEeUI) {
      activeEnvKey.value = DefaultEnvironmentKey.PRODUCTION
      configByEnv.value = {}
      await loadEnvironments()
      applySandboxDefaultEnv()
    }
  } else {
    if (!activeIntegration.value) return

    formState.value = {
      title: activeIntegration.value.title || '',
      config: activeIntegration.value.config,
      is_private: !!activeIntegration.value?.is_private,
      ...initState.value,
    }
    initialState.value = JSON.parse(JSON.stringify(formState.value))

    // Reset to the production tab and load the workspace's environments.
    if (isEeUI) {
      activeEnvKey.value = DefaultEnvironmentKey.PRODUCTION
      configByEnv.value = {}
      await loadEnvironments()
      applySandboxDefaultEnv()
    }
  }

  nextTick(() => {
    // todo: replace setTimeout and follow better approach
    setTimeout(() => {
      const input = form.value?.$el?.querySelector('input[type=text]')
      input?.setSelectionRange(0, formState.value.title.length)
      input?.focus()
    }, 500)
  })

  isLoading.value = false
})

const onTestConnection = async () => {
  testConnectionLoading.value = true

  testConnectionResult.value = (await testConnection(formState.value)) || null

  testConnectionLoading.value = false
}
</script>

<template>
  <WorkspaceIntegrationsFormsEditOrAddCommonWrapper
    v-if="activeIntegration && activeIntegrationItem?.dynamic"
    v-bind="props"
    @update:open="vOpen = $event"
  >
    <template #headerRight>
      <NcButton
        v-if="activeIntegrationItem.type === 'auth'"
        size="small"
        :type="!testConnectionResult?.success ? 'primary' : 'ghost'"
        :disabled="testConnectionLoading"
        :loading="testConnectionLoading"
        class="nc-extdb-btn-test-connection"
        @click="onTestConnection"
      >
        <div class="flex items-center gap-2">
          <GeneralIcon v-if="testConnectionResult?.success === true" icon="circleCheckSolid" class="text-success w-4 h-4" />
          <NcTooltip v-if="testConnectionResult?.success === false" placement="top">
            <template #title>{{ testConnectionResult?.message }}</template>
            <GeneralIcon icon="alertTriangleSolid" class="text-warning w-4 h-4" />
          </NcTooltip>
          Test connection
        </div>
      </NcButton>
      <NcButton
        size="small"
        type="primary"
        :disabled="isLoading || (!testConnectionResult?.success && activeIntegrationItem.type === 'auth')"
        :loading="isLoading"
        class="nc-extdb-btn-submit"
        @click="submit"
      >
        {{ pageMode === IntegrationsPageMode.ADD ? 'Create integration' : 'Update integration' }}
      </NcButton>
    </template>
    <template #leftPanel="{ class: leftPanelClass }">
      <div :class="leftPanelClass">
        <div v-if="showEnvTabs" class="nc-integration-env-tabs mb-6">
          <NcTabs :active-key="activeEnvKey" @change="onEnvTabChange">
            <a-tab-pane v-for="env in environments" :key="env.key">
              <template #tab>
                <div class="nc-env-tab" :data-testid="`nc-integration-env-tab-${env.key}`">
                  <span
                    class="w-2 h-2 rounded-full flex-none"
                    :style="{
                      backgroundColor: env.key === activeEnvKey ? env.color || '#6a7184' : 'var(--nc-content-gray-muted)',
                    }"
                  />
                  <div>{{ env.title }}</div>
                  <PaymentUpgradeBadge
                    v-if="environmentUpgradeFeature(env)"
                    icon-only
                    :feature="environmentUpgradeFeature(env)"
                    remove-click
                  />
                </div>
              </template>
            </a-tab-pane>
            <template #rightExtra>
              <NcButton type="text" size="xsmall" class="flex-none" @click="openNewEnvironment">
                <div class="flex items-center gap-1 text-nc-content-brand">
                  <GeneralIcon icon="plus" class="h-3.5 w-3.5" />
                  {{ $t('title.newEnvironment') }}
                </div>
              </NcButton>
            </template>
          </NcTabs>

          <div class="mt-4 px-2">
            <div
              class="flex items-center gap-2.5 py-2.5 px-4 rounded-lg text-bodySm border-1"
              :style="{
                backgroundColor: `${activeEnv?.color || '#6a7184'}14`,
                borderColor: `${activeEnv?.color || '#6a7184'}29`,
                color: 'var(--nc-content-gray-subtle)',
              }"
            >
              <span class="w-2 h-2 rounded-full flex-none" :style="{ backgroundColor: activeEnv?.color || '#6a7184' }" />
              <i18n-t keypath="msg.info.editingEnvConfig" tag="span" scope="global">
                <template #env>
                  <strong class="font-weight-700 text-nc-content-gray">{{ activeEnv?.title }}</strong>
                </template>
              </i18n-t>
            </div>
          </div>
        </div>

        <NcFormBuilder :key="activeEnvKey" class="px-2" />
        <WorkspaceIntegrationsSyncPanel v-if="activeIntegrationItem.type === 'sync'" class="px-2" />
        <div class="mt-10"></div>

        <WorkspaceIntegrationsEnvironmentsEditModal
          v-model="isEnvAddModalOpen"
          :save-handler="saveEnvironment"
          @saved="loadEnvironments({ force: true })"
        />
      </div>
    </template>
  </WorkspaceIntegrationsFormsEditOrAddCommonWrapper>
  <WorkspaceIntegrationsConnect
    v-if="activeIntegration && activeIntegration.sub_type === SyncDataType.NOCODB"
    v-bind="props"
    @update:open="vOpen = $event"
  />
  <div v-else></div>
</template>

<style lang="scss" scoped>
.nc-env-tab {
  @apply flex flex-row items-center gap-2 text-bodySm;
}

.nc-form-item {
  padding-right: 24px;
  margin-bottom: 12px;
}

:deep(.ant-collapse-header) {
  @apply !-mt-4 !p-0 flex items-center !cursor-default children:first:flex;
}
:deep(.ant-collapse-icon-position-right > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow) {
  @apply !right-0;
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-3;
}

:deep(.ant-form-item-explain-error) {
  @apply !text-xs;
}

:deep(.ant-divider) {
  @apply m-0;
}

:deep(.ant-form-item-with-help .ant-form-item-explain) {
  @apply !min-h-0;
}

:deep(.ant-select .ant-select-selector .ant-select-selection-item) {
  @apply font-weight-400;
}
</style>

<style lang="scss"></style>
