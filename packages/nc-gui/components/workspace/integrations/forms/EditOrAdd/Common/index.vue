<script lang="ts" setup>
import {
  DefaultEnvironmentKey,
  FormBuilderInputType,
  IntegrationCredentialMode,
  MSSQL_URL_TLS_FIELDS,
  combinedSubTypeForClient,
  integrationSupportsEnvironments,
  isMssqlStrictEncrypt,
  ncIsString,
  sqlAuthConfigFromKnexConfig,
  supportsDataSourceUse,
} from 'nocodb-sdk'
import type { EnvironmentType } from 'nocodb-sdk'
import { type IntegrationCategoryType, SyncDataType, type clientTypes as _clientTypes } from '#imports'

const props = defineProps<{
  open: boolean
  integrationType: IntegrationCategoryType
  integrationSubType: SyncDataType
  loadDatasourceInfo?: boolean
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

const { t } = useI18n()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { isUIAllowed } = useRoles()

// Non-managers (viewers/editors on per-user integrations) get a read-only
// form — their only action here is the per-user connect card.
const canManageIntegrations = computed(() => isUIAllowed('integrationManage'))

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

// Per-user credential mode (EE): mirrored into formState.credential_mode on
// change; declared as its own ref so the schema filter below can depend on it
// without a forward reference into the form-builder helper's state.
const perUserEnabled = ref(false)

const testConnectionResult = ref<{ success: boolean; message?: string } | null>(null)

const testConnectionLoading = ref(false)

const initState = ref({
  type: props.integrationType,
  sub_type: props.integrationSubType,
})

const formSchemaForEnv = computed(() => {
  let schema = activeIntegrationItem.value?.form

  // Per-user mode (edit): the shared OAuth dance is replaced by the
  // "Your connection" card — a config-embedded dance would try to mint a
  // shared credential that per-user mode never stores.
  if (schema && perUserEnabled.value && pageMode.value === IntegrationsPageMode.EDIT) {
    schema = schema.filter((field) => field.type !== FormBuilderInputType.OAuth)
  }

  if (!schema || isProductionEnv.value || pageMode.value === IntegrationsPageMode.ADD) return schema
  return schema.map((field) => (field.model === 'title' ? { ...field, disabled: true } : field))
})

const { form, formState, isLoading, initialState, submit } = useProvideFormBuilderHelper({
  formSchema: formSchemaForEnv,
  initialState: initState,
  disabled: computed(() => !canManageIntegrations.value),
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
          !!props.loadDatasourceInfo,
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
        // The id lets the backend restore masked values from the stored config;
        // an environment tab holds an override, which that config cannot restore.
        integration: {
          ...formState.value,
          id: isEditMode.value && isProductionEnv.value ? activeIntegration.value?.id : undefined,
        },
        key,
      },
    )
  },
})

// Per-user eligibility (EE): package opt-in + the instance configured for
// OAuth. Provided (not prop-drilled) because the toggle renders inside the
// form builder's OAuth field, whose subtree has its own integration store.
const isPerUserEligible = computed(
  () =>
    activeIntegrationItem.value?.type === 'auth' &&
    !!activeIntegrationItem.value?.allowsPerUserCredentials &&
    formState.value?.config?.type === 'oauth',
)

// An app-store install fixes the mode; the toggle then renders locked rather
// than absent, so the installer can see what the app decided.
const requiredCredentialMode = computed(() => activeIntegrationItem.value?.requiredCredentialMode ?? null)

provide(IntegrationPerUserStateInj, {
  perUserEnabled,
  isEligible: isPerUserEligible,
  requiredMode: requiredCredentialMode,
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
  setEnvConfig(
    configByEnv.value[env.key] ??
      (env.key === DefaultEnvironmentKey.PRODUCTION ? activeIntegration.value?.config : envOverrideConfig(env.id)) ??
      {},
  )
}

// SQL connections that also back data sources take a connection URL, like the Database form.
const supportsConnectionUrl = computed(() => supportsDataSourceUse(props.integrationType, props.integrationSubType))

// Every `config.*` field this form defines describes the connection, so a URL import replaces all of them.
// The base keys are cleared on every SQL form, even one that does not define them (e.g. SQL Server's SSL keys).
const BASE_CONNECTION_KEYS = [
  'host',
  'port',
  'username',
  'password',
  'database',
  'sslMode',
  'sslCa',
  'sslCert',
  'sslKey',
  'extraParams',
]

// The form's `config.*` fields, by their path under `config`.
const connectionFields = computed(() =>
  (activeIntegrationItem.value?.form ?? []).flatMap((field) =>
    'model' in field && ncIsString(field.model) && field.model.startsWith('config.')
      ? [{ path: field.model.slice('config.'.length), field }]
      : [],
  ),
)

const connectionConfigKeys = computed(
  () => new Set([...BASE_CONNECTION_KEYS, ...connectionFields.value.map(({ path }) => path.split('.')[0]!)]),
)

// What a new form starts with, so a cleared field shows what the connection will use (e.g. SQL Server's TLS switches).
const connectionDefaults = computed(() =>
  Object.fromEntries(
    connectionFields.value.flatMap(({ path, field }) =>
      !path.includes('.') && 'defaultValue' in field && field.defaultValue !== undefined ? [[path, field.defaultValue]] : [],
    ),
  ),
)

const importUrl = ref('')

const isImportUrlOpen = ref(false)

async function importConnectionUrl() {
  const url = importUrl.value.trim()
  if (!url) return

  try {
    const parsed = await $api.utils.urlToConfig({ url })
    if (!parsed?.client) {
      message.error(t('msg.error.invalidURL'))
      return
    }
    if (combinedSubTypeForClient(parsed.client) !== props.integrationSubType) {
      message.error(t('msg.error.connectionUrlWrongDatabase'))
      return
    }
    // No connection field the URL leaves out survives (an old password must never reach a new host): it goes
    // back to the form default. Other config keys are kept, and so are SQL Server's TLS switches unless the URL
    // sets them, so an import never quietly lowers TLS.
    const current = formState.value.config ?? {}
    const kept = Object.fromEntries(Object.entries(current).filter(([key]) => !connectionConfigKeys.value.has(key)))
    const keptTls = Object.fromEntries(
      MSSQL_URL_TLS_FIELDS.filter((field) => current[field] !== undefined).map((field) => [field, current[field]]),
    )
    const imported = sqlAuthConfigFromKnexConfig(parsed)
    formState.value.config = { ...kept, ...connectionDefaults.value, ...keptTls, ...imported }
    if (isMssqlStrictEncrypt(imported)) message.warning(t('msg.warning.mssqlStrictEncryptNotSupported'))
    testConnectionResult.value = null
    isImportUrlOpen.value = false
    importUrl.value = ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

function setEnvConfig(config: Record<string, any>) {
  formState.value.config = config
  // Leaving production changes the schema, and the form builder then resets from the production config.
  nextTick(() => {
    formState.value.config = config
  })
}

function applyLaneDefaultEnv() {
  if (pageMode.value !== IntegrationsPageMode.EDIT) return

  const sbxKey = environmentsStore.laneEnvironmentKey
  if (!sbxKey || sbxKey === activeEnvKey.value) return

  const env = environments.value.find((e) => e.key === sbxKey)
  if (!env || isEnvironmentBlocked(env)) return

  configByEnv.value[activeEnvKey.value] = formState.value.config
  activeEnvKey.value = sbxKey
  setEnvConfig(envOverrideConfig(env.id) ?? {})
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

// The toggle drives the persisted credential mode. Written only on change so
// integrations that never touched the axis keep sending nothing.
watch(perUserEnabled, (enabled) => {
  formState.value.credential_mode = enabled ? 'per_user' : 'shared'

  if (formState.value.config && typeof formState.value.config === 'object') {
    // A pending OAuth dance must not carry across a mode flip — its meaning
    // changes with the mode (shared credential vs the caller's own connection),
    // so the user re-authenticates explicitly under the new mode.
    delete formState.value.config.oauth

    // In edit mode, reset the config to the stored one for the env being
    // edited: flipping back and forth must not end up saving a config that
    // lost its masked sentinels — they're what the update path restores the
    // real stored tokens from.
    if (isEditMode.value) {
      const stored = isProductionEnv.value ? activeIntegration.value?.config : envOverrideConfig(activeEnv.value?.id)
      if (stored && typeof stored === 'object') {
        formState.value.config = JSON.parse(JSON.stringify(stored))
        delete formState.value.config.oauth
      }
    }
  }

  testConnectionResult.value = null
})

// select and focus title field on load
onMounted(async () => {
  isLoading.value = true

  if (pageMode.value === IntegrationsPageMode.ADD) {
    formState.value.title = activeIntegration.value?.title || ''

    if (requiredCredentialMode.value) {
      perUserEnabled.value = requiredCredentialMode.value === IntegrationCredentialMode.PER_USER
    }

    // Load envs so the create form can offer per-environment config tabs too.
    if (isEeUI) {
      activeEnvKey.value = DefaultEnvironmentKey.PRODUCTION
      configByEnv.value = {}
      await loadEnvironments()
      applyLaneDefaultEnv()
    }
  } else {
    if (!activeIntegration.value) return

    formState.value = {
      title: activeIntegration.value.title || '',
      config: activeIntegration.value.config,
      is_private: !!activeIntegration.value?.is_private,
      credential_mode: activeIntegration.value?.credential_mode,
      meta: activeIntegration.value?.meta ?? {},
      ...initState.value,
    }
    perUserEnabled.value = activeIntegration.value?.credential_mode === 'per_user'
    initialState.value = JSON.parse(JSON.stringify(formState.value))

    // Reset to the production tab and load the workspace's environments.
    if (isEeUI) {
      activeEnvKey.value = DefaultEnvironmentKey.PRODUCTION
      configByEnv.value = {}
      await loadEnvironments()
      applyLaneDefaultEnv()
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

// Stored secrets come back masked (`********`) — a test with sentinels would
// fail at the provider, and requiring a fresh dance just to rename an
// integration would be absurd. Sentinel-bearing configs were verified when
// they were stored, so they satisfy the test requirement.
const hasMaskedSecrets = computed(() => isEditMode.value && JSON.stringify(formState.value?.config ?? {}).includes('********'))

const onTestConnection = async () => {
  if (hasMaskedSecrets.value) {
    message.info(t('msg.info.reAuthenticateToTest'))
    return
  }

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
      <!-- Per-user mode stores no shared credential — there is nothing to test;
           members verify their own connection via the connect card instead. -->
      <NcButton
        v-if="activeIntegrationItem.type === 'auth' && !perUserEnabled && canManageIntegrations"
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
          {{ $t('labels.testConnection') }}
        </div>
      </NcButton>
      <NcButton
        v-if="canManageIntegrations"
        size="small"
        type="primary"
        :disabled="
          isLoading ||
          (!testConnectionResult?.success && activeIntegrationItem.type === 'auth' && !perUserEnabled && !hasMaskedSecrets)
        "
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
              <NcButton
                v-if="isUIAllowed('environmentCreate')"
                type="text"
                size="xsmall"
                class="flex-none"
                @click="openNewEnvironment"
              >
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

        <WorkspaceIntegrationsFormsEditOrAddPerUserSection
          v-if="isEeUI"
          v-model:per-user-enabled="perUserEnabled"
          :active-env="activeEnv"
          :base-id="baseId"
          class="px-2"
        />
        <WorkspaceIntegrationsFormsEditOrAddInstallerLabelSection v-if="isEeUI && isProductionEnv" class="px-2" />
        <div v-if="supportsConnectionUrl && canManageIntegrations" class="flex justify-end px-2 -mb-2">
          <NcDropdown v-model:visible="isImportUrlOpen" placement="bottomRight">
            <NcButton
              type="text"
              size="small"
              class="nc-integration-btn-import-url !rounded-md !px-2"
              data-testid="nc-integration-import-url"
              @click.stop="isImportUrlOpen = true"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="ncLink" class="flex-none" />
                {{ $t('activity.useConnectionUrl') }}
              </div>
            </NcButton>
            <template #overlay>
              <div class="p-4 w-[448px] flex flex-col gap-3">
                <div class="text-sm text-nc-content-gray-subtle">
                  {{ $t('msg.info.autoPopulateConnectionFromUrl') }}
                </div>
                <a-textarea
                  v-model:value="importUrl"
                  class="!rounded-lg !min-h-[120px] !max-h-[250px] nc-scrollbar-thin"
                  data-testid="nc-integration-import-url-input"
                />
                <div class="flex items-center gap-2 justify-end">
                  <NcButton
                    size="small"
                    type="secondary"
                    @click="
                      () => {
                        isImportUrlOpen = false
                        importUrl = ''
                      }
                    "
                  >
                    {{ $t('general.cancel') }}
                  </NcButton>
                  <NcButton size="small" data-testid="nc-integration-import-url-submit" @click="importConnectionUrl">
                    {{ $t('general.import') }}
                  </NcButton>
                </div>
              </div>
            </template>
          </NcDropdown>
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
